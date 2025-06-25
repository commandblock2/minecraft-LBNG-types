import { Box } from "jvm-types/net/minecraft/util/math/Box";
import { Vec3d } from "jvm-types/net/minecraft/util/math/Vec3d";
import { Color4b } from "jvm-types/net/ccbluex/liquidbounce/render/engine/type/Color4b";
import { MatrixStack } from "jvm-types/net/minecraft/client/util/math/MatrixStack";
import { renderBoxes } from "./render-utils";
import { RenderShortcutsKt } from "jvm-types/net/ccbluex/liquidbounce/render/RenderShortcutsKt";
import { WorldRenderEnvironment } from "jvm-types/net/ccbluex/liquidbounce/render/WorldRenderEnvironment";
import { EventListener } from "jvm-types/net/ccbluex/liquidbounce/event/EventListener";
import { Object } from "jvm-types/java/lang/Object";
import { Unit } from "jvm-types/kotlin/Unit";
import { ScriptModule } from "jvm-types/net/ccbluex/liquidbounce/script/bindings/features/ScriptModule";
import { EventManager } from "jvm-types/net/ccbluex/liquidbounce/event/EventManager";
import { DrawOutlinesEvent } from "jvm-types/net/ccbluex/liquidbounce/event/events/DrawOutlinesEvent";
import { EventHook } from "jvm-types/net/ccbluex/liquidbounce/event/EventHook";
import { Priority } from "jvm-types/net/ccbluex/liquidbounce/utils/kotlin/Priority";
import { GameTickEvent } from "jvm-types/net/ccbluex/liquidbounce/event/events/GameTickEvent";
import { DrawOutlinesEvent$OutlineType } from "jvm-types/net/ccbluex/liquidbounce/event/events/DrawOutlinesEvent$OutlineType";

// --- Enums and Interfaces ---

export enum TextPosition {
    TOP_CENTER,
    BOTTOM_CENTER,
    CENTER,
    CUSTOM_OFFSET,
}

export type ColorInterpolator = (progress: number) => Color4b;

export interface BoxData {
    box: Box;
    position: Vec3d;
    glow: boolean;
    outlineInterpolator?: ColorInterpolator;
    fillInterpolator?: ColorInterpolator;
}

export interface TextData {
    textProvider: () => string;
    position: Vec3d; // Base world position for the text
    textPositionEnum: TextPosition;
    textOffsetVec3d?: Vec3d; // Optional custom offset
}

export interface Visualization {
    id: string;
    creationTick: number;
    durationTicks: number;
    boxData?: BoxData;
    textData?: TextData;
}

// --- Default Interpolation Functions ---

export function rainbowInterpolatorWithAlpha(alpha: number): ColorInterpolator {
    return (progress: number): Color4b => {
        // A proper rainbow would cycle through hues.
        // HSV to RGB conversion (simplified for hue only)
        const hue = progress * 360; // Cycle through 360 degrees of hue
        const saturation = 1;
        const value = 1;

        // Convert HSV to RGB
        const i = Math.floor(hue / 60);
        const f = hue / 60 - i;
        const p = value * (1 - saturation);
        const q = value * (1 - f * saturation);
        const t = value * (1 - (1 - f) * saturation);

        let r = 0, g = 0, b = 0;
        switch (i % 6) {
            case 0: r = value; g = t; b = p; break;
            case 1: r = q; g = value; b = p; break;
            case 2: r = p; g = value; b = t; break;
            case 3: r = p; g = q; b = value; break;
            case 4: r = t; g = p; b = value; break;
            case 5: r = value; g = p; b = q; break;
        }

        return new Color4b(Math.floor(r * 255), Math.floor(g * 255), Math.floor(b * 255), alpha);
    };
}

export const defaultRainbowInterpolator: ColorInterpolator = rainbowInterpolatorWithAlpha(255);

export function fadeOutInterpolatorFrom(baseColor: Color4b): ColorInterpolator {
    return (progress: number): Color4b => {
        const alpha = baseColor.a() * (1 - progress);
        return new Color4b(baseColor.r(), baseColor.g(), baseColor.b(), Math.floor(alpha));
    };
}

// --- VisualizationManager Class ---

// TODO: actually test this

export class VisualizationManager {

    private visualizations: Map<string, Visualization> = new Map();
    private currentTick: number = 0;
    private nextId: number = 0;

    private scriptModule: ScriptModule;

    constructor(scriptModule: ScriptModule) {
        this.scriptModule = scriptModule
        // @ts-expect-error
        EventManager.INSTANCE.registerEventHook(DrawOutlinesEvent.class, new EventHook(scriptModule, (event: DrawOutlinesEvent) => {
            this.onWorldRender(event)
        }, Priority.NORMAL.ordinal()))

        // @ts-expect-error
        EventManager.INSTANCE.registerEventHook(GameTickEvent.class, new EventHook(scriptModule, (event: GameTickEvent) => {
            this.onTick()
        }, Priority.NORMAL.ordinal()))
    }

    public onTick(): void {
        this.currentTick++;
        this.cleanUpExpiredVisualizations();
    }

    private cleanUpExpiredVisualizations(): void {
        const expiredIds: string[] = [];
        this.visualizations.forEach((viz, id) => {
            if (this.currentTick >= viz.creationTick + viz.durationTicks) {
                expiredIds.push(id);
            }
        });
        expiredIds.forEach(id => this.visualizations.delete(id));
    }

    public onWorldRender(outlinesEvent: DrawOutlinesEvent): void {
        const matrixStack = outlinesEvent.matrixStack
        this.visualizations.forEach(viz => {
            const ticksRemaining = (viz.creationTick + viz.durationTicks) - this.currentTick;
            const progress = 1 - (ticksRemaining / viz.durationTicks); // 0 at start, 1 at end

            if (viz.boxData) {
                if (!viz.boxData.glow || outlinesEvent.type == DrawOutlinesEvent$OutlineType.MINECRAFT_GLOW) {

                    const currentOutlineColor = (viz.boxData.outlineInterpolator || defaultRainbowInterpolator)(progress);
                    const currentFillColor = (viz.boxData.fillInterpolator || defaultRainbowInterpolator)(progress);

                    if (renderBoxes(
                        [[viz.boxData.box, viz.boxData.position]],
                        matrixStack,
                        currentOutlineColor,
                        currentFillColor
                    ))
                        outlinesEvent.markDirty();
                }
            }

            if (viz.textData) {
                // TODO: Implement text rendering here.
                // For now, we'll just log the text and its calculated position.
                const text = viz.textData.textProvider();
                let textRenderPos = viz.textData.position;

                // Calculate text position based on enum and offset
                if (viz.boxData) { // If text is associated with a box, calculate relative to box
                    const boxCenter = new Vec3d(
                        viz.boxData.box.minX + (viz.boxData.box.maxX - viz.boxData.box.minX) / 2,
                        viz.boxData.box.minY + (viz.boxData.box.maxY - viz.boxData.box.minY) / 2,
                        viz.boxData.box.minZ + (viz.boxData.box.maxZ - viz.boxData.box.minZ) / 2
                    );

                    switch (viz.textData.textPositionEnum) {
                        case TextPosition.TOP_CENTER:
                            textRenderPos = new Vec3d(boxCenter.getX(), viz.boxData.box.maxY + 0.2, boxCenter.getZ());
                            break;
                        case TextPosition.BOTTOM_CENTER:
                            textRenderPos = new Vec3d(boxCenter.getX(), viz.boxData.box.minY - 0.2, boxCenter.getZ());
                            break;
                        case TextPosition.CENTER:
                            textRenderPos = boxCenter;
                            break;
                        case TextPosition.CUSTOM_OFFSET:
                            // textRenderPos is already the base position, apply offset
                            if (viz.textData.textOffsetVec3d) {
                                textRenderPos = textRenderPos.add(viz.textData.textOffsetVec3d);
                            }
                            break;
                    }
                } else { // If text is standalone, use its provided position as base
                    if (viz.textData.textPositionEnum === TextPosition.CUSTOM_OFFSET && viz.textData.textOffsetVec3d) {
                        textRenderPos = textRenderPos.add(viz.textData.textOffsetVec3d);
                    }
                }

                // Apply custom offset if provided and not handled by enum logic
                if (viz.textData.textPositionEnum !== TextPosition.CUSTOM_OFFSET && viz.textData.textOffsetVec3d) {
                    textRenderPos = textRenderPos.add(viz.textData.textOffsetVec3d);
                }

                // This part would involve actual text rendering using LiquidBounce's API
                // For now, just a placeholder.
                // console.log(`Rendering text: "${text}" at ${textRenderPos.getX()}, ${textRenderPos.getY()}, ${textRenderPos.getZ()}`);
            }
        });
    }

    public addBoxVisualization(
        box: Box,
        position: Vec3d,
        durationTicks: number,
        glow: boolean = true,
        outlineInterpolator?: ColorInterpolator,
        fillInterpolator?: ColorInterpolator
    ): string {
        const id = `viz-${this.nextId++}`;
        this.visualizations.set(id, {
            id,
            creationTick: this.currentTick,
            durationTicks,
            boxData: {
                box,
                position,
                glow,
                outlineInterpolator,
                fillInterpolator,
            },
        });
        return id;
    }

    public addTextVisualization(
        textProvider: () => string,
        position: Vec3d,
        durationTicks: number,
        textPositionEnum: TextPosition = TextPosition.CUSTOM_OFFSET,
        textOffsetVec3d?: Vec3d
    ): string {
        const id = `viz-${this.nextId++}`;
        this.visualizations.set(id, {
            id,
            creationTick: this.currentTick,
            durationTicks,
            textData: {
                textProvider,
                position,
                textPositionEnum,
                textOffsetVec3d,
            },
        });
        return id;
    }

    public addBoxAndTextVisualization(
        box: Box,
        boxPosition: Vec3d,
        textProvider: () => string,
        durationTicks: number,
        textPositionEnum: TextPosition = TextPosition.TOP_CENTER,
        textOffsetVec3d?: Vec3d,
        glow: boolean = true,
        outlineInterpolator?: ColorInterpolator,
        fillInterpolator?: ColorInterpolator
    ): string {
        const id = `viz-${this.nextId++}`;
        this.visualizations.set(id, {
            id,
            creationTick: this.currentTick,
            durationTicks,
            boxData: {
                box,
                position: boxPosition,
                glow,
                outlineInterpolator,
                fillInterpolator,
            },
            textData: {
                textProvider,
                position: boxPosition, // Base text position is box position
                textPositionEnum,
                textOffsetVec3d,
            },
        });
        return id;
    }

    public removeVisualization(id: string): boolean {
        return this.visualizations.delete(id);
    }

    public clearAllVisualizations(): void {
        this.visualizations.clear();
    }
}