import { Box } from "jvm-types/net/minecraft/util/math/Box";
import { Vec3d } from "jvm-types/net/minecraft/util/math/Vec3d";
import { Color4b } from "jvm-types/net/ccbluex/liquidbounce/render/engine/type/Color4b";
import { drawTextWithBackground, renderBoxes, drawLineStripFromVec3d } from "./render-utils";
import { RenderShortcutsKt } from "jvm-types/net/ccbluex/liquidbounce/render/RenderShortcutsKt";
import { ScriptModule } from "jvm-types/net/ccbluex/liquidbounce/script/bindings/features/ScriptModule";
import { EventManager } from "jvm-types/net/ccbluex/liquidbounce/event/EventManager";
import { DrawOutlinesEvent } from "jvm-types/net/ccbluex/liquidbounce/event/events/DrawOutlinesEvent";
import { EventHook } from "jvm-types/net/ccbluex/liquidbounce/event/EventHook";
import { Priority } from "jvm-types/net/ccbluex/liquidbounce/utils/kotlin/Priority";
import { GameTickEvent } from "jvm-types/net/ccbluex/liquidbounce/event/events/GameTickEvent";
import { DrawOutlinesEvent$OutlineType } from "jvm-types/net/ccbluex/liquidbounce/event/events/DrawOutlinesEvent$OutlineType";
import { RenderEnvironment } from "jvm-types/net/ccbluex/liquidbounce/render/RenderEnvironment";
import { FontManager } from "jvm-types/net/ccbluex/liquidbounce/render/FontManager";
import { WorldToScreen } from "jvm-types/net/ccbluex/liquidbounce/utils/render/WorldToScreen";
import { OverlayRenderEvent } from "jvm-types/net/ccbluex/liquidbounce/event/events/OverlayRenderEvent";
import { MatrixStack } from "jvm-types/net/minecraft/client/util/math/MatrixStack";
import { RenderBufferBuilder } from "jvm-types/net/ccbluex/liquidbounce/render/RenderBufferBuilder";
import { FontRendererBuffers } from "jvm-types/net/ccbluex/liquidbounce/render/engine/font/FontRendererBuffers";
import { VertexFormat$DrawMode } from "jvm-types/net/minecraft/client/render/VertexFormat$DrawMode";
import { VertexInputType$Pos } from "jvm-types/net/ccbluex/liquidbounce/render/VertexInputType$Pos";
import { GL11 } from "jvm-types/org/lwjgl/opengl/GL11";
import { RenderSystem } from "jvm-types/com/mojang/blaze3d/systems/RenderSystem";
import { Vec3 } from "jvm-types/net/ccbluex/liquidbounce/render/engine/type/Vec3";
import { MinecraftClient } from "jvm-types/net/minecraft/client/MinecraftClient";
import { WorldRenderEvent } from "jvm-types/net/ccbluex/liquidbounce/event/events/WorldRenderEvent";

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
    fillInterpolator: ColorInterpolator;
}

export interface LineData {
    positions: Array<Vec3d>;
    colorInterpolator: ColorInterpolator;
}

export interface TextData {
    textProvider: (durationTicks: number, ticksRemaining: number) => Array<string>;
    position: Vec3d; // Base world position for the text
    textPositionEnum: TextPosition;
    textOffsetVec3d?: Vec3d; // Optional custom offset
    colorInterpolator: ColorInterpolator;
}

export interface Visualization {
    id: string;
    creationTick: number;
    durationTicks: number;
    boxData?: BoxData;
    textData?: TextData;
    lineData?: LineData;
}

export interface AddVisualizationOptions {
    durationTicks: number;
    boxData?: Partial<BoxData>;
    textData?: Partial<TextData>;
    lineData?: Partial<LineData>;
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


    constructor(scriptModule: ScriptModule) {
        // @ts-expect-error
        EventManager.INSTANCE.registerEventHook(DrawOutlinesEvent.class, new EventHook(scriptModule, (event: DrawOutlinesEvent) => {
            this.onOutlineRender(event)
        }, Priority.NORMAL.ordinal()))

        // @ts-expect-error
        EventManager.INSTANCE.registerEventHook(GameTickEvent.class, new EventHook(scriptModule, (event: GameTickEvent) => {
            this.onTick()
        }, Priority.NORMAL.ordinal()))

        // @ts-expect-error
        EventManager.INSTANCE.registerEventHook(OverlayRenderEvent.class, new EventHook(scriptModule, (event: OverlayRenderEvent) => {
            this.onGUIRender(event)
        }, Priority.NORMAL.ordinal()))

        // @ts-expect-error
        EventManager.INSTANCE.registerEventHook(WorldRenderEvent.class, new EventHook(scriptModule, (event: WorldRenderEvent) => {
            this.onWorldRender(event)
        }, Priority.NORMAL.ordinal()))
    }
    private onWorldRender(event: WorldRenderEvent) {
        this.visualizations.forEach(viz => {
            if (viz.lineData) {
                const ticksRemaining = (viz.creationTick + viz.durationTicks) - this.currentTick;
                const progress = 1 - (ticksRemaining / viz.durationTicks); // 0 at start, 1 at end
                const currentLineColor = viz.lineData.colorInterpolator(progress);
                drawLineStripFromVec3d(event.matrixStack, viz.lineData.positions, currentLineColor);
            }
        })
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

    public onOutlineRender(outlinesEvent: DrawOutlinesEvent): void {
        const matrixStack = outlinesEvent.matrixStack
        this.visualizations.forEach(viz => {
            const ticksRemaining = (viz.creationTick + viz.durationTicks) - this.currentTick;
            const progress = 1 - (ticksRemaining / viz.durationTicks); // 0 at start, 1 at end

            if (viz.boxData) {
                if (!viz.boxData.glow || outlinesEvent.type == DrawOutlinesEvent$OutlineType.MINECRAFT_GLOW) {

                    const currentOutlineColor = viz.boxData.outlineInterpolator ? viz.boxData.outlineInterpolator(progress) : null;
                    const currentFillColor = (viz.boxData.fillInterpolator || defaultRainbowInterpolator)(progress);

                    if (renderBoxes(
                        [[viz.boxData.box, viz.boxData.position]],
                        matrixStack,
                        currentFillColor,
                        currentOutlineColor
                    ))
                        outlinesEvent.markDirty();
                }
            }

        });
    }

    public onGUIRender(overlayRenderEvent: OverlayRenderEvent) {
        const quadBuffers = new RenderBufferBuilder(
            VertexFormat$DrawMode.QUADS,
            VertexInputType$Pos.INSTANCE,
            RenderBufferBuilder.Companion.TESSELATOR_A
        )

        const lineBuffers = new RenderBufferBuilder(
            VertexFormat$DrawMode.DEBUG_LINES,
            VertexInputType$Pos.INSTANCE,
            RenderBufferBuilder.Companion.TESSELATOR_B
        )

        const fontBuffers = new FontRendererBuffers()
        RenderShortcutsKt.renderEnvironmentForGUI(new MatrixStack(),
            // @ts-expect-error
            (env: RenderEnvironment) => {

                const cameraPos = MinecraftClient.instance.gameRenderer.getCamera().getPos();

                try {
                    const allTextViz = [...this.visualizations.values()]
                        .map((viz) => {
                            const ticksRemaining = (viz.creationTick + viz.durationTicks) - this.currentTick;
                            const progress = 1 - (ticksRemaining / viz.durationTicks); // 0 at start, 1 at end
                            if (viz.textData) {

                                const lines = viz.textData.textProvider(viz.durationTicks, ticksRemaining);
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


                                return [
                                    WorldToScreen.INSTANCE.calculateScreenPos(textRenderPos, cameraPos),
                                    lines,
                                    viz.textData.colorInterpolator(progress)
                                ] as [Vec3 | null, string[], Color4b];
                            }
                            return undefined
                        })
                        .filter((data) => data != undefined && data != null && data[0] != null && data[0] != undefined)
                        .sort((a, b) => a![0]!.x() - b![0]!.x());

                    allTextViz
                        .forEach((data, index) => {
                            const [pos, lines, textColor] = data!
                            drawTextWithBackground(
                                env,
                                lines,
                                pos!.x(),
                                pos!.y(),
                                index * 1000 / allTextViz.length,
                                textColor,
                                FontManager.INSTANCE.FONT_RENDERER,
                                quadBuffers,
                                lineBuffers,
                                fontBuffers
                            )
                        });
                } finally {
                    // commit
                    GL11.glClear(GL11.GL_DEPTH_BUFFER_BIT)
                    GL11.glEnable(GL11.GL_DEPTH_TEST)

                    RenderSystem.enableBlend()
                    RenderSystem.blendFuncSeparate(
                        GL11.GL_SRC_ALPHA,
                        GL11.GL_ONE_MINUS_SRC_ALPHA,
                        GL11.GL_ONE,
                        GL11.GL_ZERO
                    )

                    RenderShortcutsKt.withColor(
                        env,
                        new Color4b(30, 30, 30, 120),
                        // @ts-expect-error
                        (env_: RenderEnvironment) => {
                            quadBuffers.draw()
                        }
                    )

                    RenderShortcutsKt.withColor(
                        env,
                        new Color4b(255, 255, 255, 255),
                        // @ts-expect-error
                        (env_: RenderEnvironment) => {
                            lineBuffers.draw()
                        }
                    )

                    RenderShortcutsKt.withColor(
                        env,
                        new Color4b(255, 255, 255, 255), // Default color for font buffers if not specified
                        // @ts-expect-error
                        (env_: RenderEnvironment) => {
                            fontBuffers.draw()
                        }
                    )
                }
            })
    }

    public addVisualization(options: AddVisualizationOptions): string {
        const id = `viz-${this.nextId++}`;
        const visualization: Visualization = {
            id,
            creationTick: this.currentTick,
            durationTicks: options.durationTicks,
            boxData: options.boxData ? {
                box: options.boxData.box!, // Use non-null assertion as Partial<BoxData> makes it optional
                position: options.boxData.position!, // Use non-null assertion
                glow: options.boxData.glow ?? true, // Default to true
                outlineInterpolator: options.boxData.outlineInterpolator,
                fillInterpolator: options.boxData.fillInterpolator || defaultRainbowInterpolator,
            } : undefined,
            textData: options.textData ? {
                textProvider: options.textData.textProvider!, // Use non-null assertion
                position: options.textData.position!, // Use non-null assertion
                textPositionEnum: options.textData.textPositionEnum ?? TextPosition.CUSTOM_OFFSET,
                textOffsetVec3d: options.textData.textOffsetVec3d,
                colorInterpolator: options.textData.colorInterpolator || defaultRainbowInterpolator,
            } : undefined,
            lineData: options.lineData ? {
                positions: options.lineData.positions!,
                colorInterpolator: options.lineData.colorInterpolator || defaultRainbowInterpolator,
            } : undefined,
        };
        this.visualizations.set(id, visualization);
        return id;
    }
    public removeVisualization(id: string): boolean {
        return this.visualizations.delete(id);
    }

    public clearAllVisualizations(): void {
        this.visualizations.clear();
    }
}