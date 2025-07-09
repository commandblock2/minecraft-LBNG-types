import { EyeOfEnderEntity } from "jvm-types/net/minecraft/entity/EyeOfEnderEntity";
import { Vec3d } from "jvm-types/net/minecraft/util/math/Vec3d";
import { ClientWorld } from "jvm-types/net/minecraft/client/world/ClientWorld";
import { GameTickEvent } from "jvm-types/net/ccbluex/liquidbounce/event/events/GameTickEvent";
import { DrawOutlinesEvent } from "jvm-types/net/ccbluex/liquidbounce/event/events/DrawOutlinesEvent";
import { OverlayRenderEvent } from "jvm-types/net/ccbluex/liquidbounce/event/events/OverlayRenderEvent";
import { Color4b } from "jvm-types/net/ccbluex/liquidbounce/render/engine/type/Color4b";
import { Vec3 } from "jvm-types/net/ccbluex/liquidbounce/render/engine/type/Vec3";
import { calculateScreenPosExtended, drawLineStripFromVec3d } from "lbng-utils-typed/dist/render-utils";
import { VisualizationManager, fadeOutInterpolatorFrom, TextPosition } from "lbng-utils-typed/dist/visualization-utils";
import { WorldToScreen } from "jvm-types/net/ccbluex/liquidbounce/utils/render/WorldToScreen";
import { RenderShortcutsKt } from "jvm-types/net/ccbluex/liquidbounce/render/RenderShortcutsKt";
import { MatrixStack } from "jvm-types/net/minecraft/client/util/math/MatrixStack";
import { RenderEnvironment } from "jvm-types/net/ccbluex/liquidbounce/render/RenderEnvironment";
import { WorldRenderEvent } from "jvm-types/net/ccbluex/liquidbounce/event/events/WorldRenderEvent";
import { Matrix4f } from "jvm-types/org/joml/Matrix4f";
import { RenderSystem } from "jvm-types/com/mojang/blaze3d/systems/RenderSystem";

const script = registerScript.apply({
    name: "endportal-locate",
    version: "1.0.0",
    authors: ["commandblock2"]
});

script.registerModule({
    name: "endportal-locate",
    description: "This triangulates the endportal with just 2 eyes",
    category: "Misc",
}, (mod) => {
    // Module-specific state
    let activeEyePaths: Map<EyeOfEnderEntity, Vec3d[]> = new Map();
    let completedEyePaths: Map<EyeOfEnderEntity, Vec3d[]> = new Map();
    let eyeColorMapping: Map<EyeOfEnderEntity, number> = new Map();
    let nextColorIndex: number = 0;
    let lastLocation: [number, number] | null = null;


    // Visualization manager for rendering eye paths and portal location
    const visualizationManager = new VisualizationManager(mod);

    // Colors for different eye paths
    const eyeColors = [
        new Color4b(255, 100, 100, 255), // Red for first eye
        new Color4b(100, 100, 255, 255), // Blue for second eye
    ];

    const portalFoundColor = new Color4b(0, 255, 0, 255); // Green for portal location
    const extendedPathColor = new Color4b(255, 255, 0, 200); // Yellow for extended paths

    const resetAllState = () => {
        activeEyePaths.clear();
        completedEyePaths.clear();
        eyeColorMapping.clear();
        nextColorIndex = 0;
        visualizationManager.clearAllVisualizations();
    };

    mod.on("enable", () => {
        resetAllState();
    });

    // World rendering event for drawing eye paths
    mod.on("worldrender", (event: WorldRenderEvent) => {
        const matrixStack = event.matrixStack;

        // Render active eye paths in real-time
        for (const [eye, path] of activeEyePaths.entries()) {
            if (path.length > 1) {
                const colorIndex = eyeColorMapping.get(eye) || 0;
                const color = eyeColors[colorIndex % eyeColors.length];
                drawLineStripFromVec3d(matrixStack, path, color);
            }
        }

        // Render completed eye paths that are still being tracked
        for (const [eye, path] of completedEyePaths.entries()) {
            if (path.length > 1) {
                const colorIndex = eyeColorMapping.get(eye) || 0;
                const color = eyeColors[colorIndex % eyeColors.length];
                drawLineStripFromVec3d(matrixStack, path, color);
            }
        }
    });



    mod.on("gametick", (event: GameTickEvent) => {
        const world: ClientWorld | null = mc.world;
        if (!world) return;

        // @ts-expect-error
        const currentEyesInWorld: EyeOfEnderEntity[] = world.getEntities().toList().filter((elem: any) => {
            return elem instanceof EyeOfEnderEntity;
        }) as EyeOfEnderEntity[];

        // Step 1: Identify disappeared eyes and move their paths to completedEyePaths
        const disappearedEyes: EyeOfEnderEntity[] = [];
        for (const eye of activeEyePaths.keys()) {
            if (!currentEyesInWorld.includes(eye)) {
                disappearedEyes.push(eye);
            }
        }

        for (const eye of disappearedEyes) {
            const path = activeEyePaths.get(eye);
            if (path && path.length > 0) {
                if (completedEyePaths.size < 2) { // Only store up to two completed paths
                    completedEyePaths.set(eye, path);
                }
            }
            activeEyePaths.delete(eye);
        }

        // Step 2: Add new eyes and record positions for active eyes
        for (const eye of currentEyesInWorld) {
            if (!activeEyePaths.has(eye)) {
                activeEyePaths.set(eye, []);
                // Assign a consistent color to this eye
                if (!eyeColorMapping.has(eye)) {
                    eyeColorMapping.set(eye, nextColorIndex % eyeColors.length);
                    nextColorIndex++;
                }
            }
            activeEyePaths.get(eye)!.push(eye.getPos());
        }

        // Step 3: Check for calculation trigger
        if (completedEyePaths.size === 2) {
            const pathsArray = Array.from(completedEyePaths.values());
            const firstPath = pathsArray[0];
            const secondPath = pathsArray[1];

            if (firstPath.length === 0 || secondPath.length === 0) {
                Client.displayChatMessage("§c[EndPortalLocate] Not enough data for one or both eye paths.");
                resetAllState(); // Reset all state if data is insufficient
                return;
            }

            // Extract start and end points for each path
            const firstBeginXZ = { x: firstPath[0].x, z: firstPath[0].z };
            const firstEndXZ = { x: firstPath[firstPath.length - 1].x, z: firstPath[firstPath.length - 1].z };

            const secondBeginXZ = { x: secondPath[0].x, z: secondPath[0].z };
            const secondEndXZ = { x: secondPath[secondPath.length - 1].x, z: secondPath[secondPath.length - 1].z };

            // Calculate coefficients for the line equation: A*x + B*z = C
            const firstA = firstEndXZ.z - firstBeginXZ.z;
            const firstB = firstBeginXZ.x - firstEndXZ.x;
            const firstC = firstA * firstBeginXZ.x + firstB * firstBeginXZ.z;

            const secondA = secondEndXZ.z - secondBeginXZ.z;
            const secondB = secondBeginXZ.x - secondEndXZ.x;
            const secondC = secondA * secondBeginXZ.x + secondB * secondBeginXZ.z;

            // Calculate determinant of the coefficient matrix for the system of equations
            const det = firstA * secondB - firstB * secondA;

            if (Math.abs(det) < 1e-6) { // Check for parallel or nearly parallel lines
                Client.displayChatMessage("§c[EndPortalLocate] Lines are parallel or nearly parallel. Cannot determine intersection.");
                resetAllState(); // Reset all state if lines are parallel
                return;
            }

            // Solve for intersection point (x, z) using Cramer's rule
            const intersectX = (secondB * firstC - firstB * secondC) / det;
            const intersectZ = (firstA * secondC - secondA * firstC) / det;

            Client.displayChatMessage(`§a[EndPortalLocate] The portal is around X = ${intersectX.toFixed(2)} Z = ${intersectZ.toFixed(2)}`);
            lastLocation = [intersectX, intersectZ];

            // Create extended path visualizations that continue beyond the eye landing points
            const portalPos = new Vec3d(intersectX, firstPath[firstPath.length - 1].y, intersectZ);

            // Extend first path to portal location
            const firstExtendedPath = [...firstPath];
            const firstLastPos = firstPath[firstPath.length - 1];
            const firstDirection = new Vec3d(
                intersectX - firstLastPos.x,
                0,
                intersectZ - firstLastPos.z
            ).normalize();

            // Add extended points along the direction to the portal
            for (let i = 1; i <= 10; i++) {
                const extendedPoint = firstLastPos.add(firstDirection.multiply(i * 5));
                firstExtendedPath.push(extendedPoint);
            }

            // Extend second path to portal location
            const secondExtendedPath = [...secondPath];
            const secondLastPos = secondPath[secondPath.length - 1];
            const secondDirection = new Vec3d(
                intersectX - secondLastPos.x,
                0,
                intersectZ - secondLastPos.z
            ).normalize();

            // Add extended points along the direction to the portal
            for (let i = 1; i <= 10; i++) {
                const extendedPoint = secondLastPos.add(secondDirection.multiply(i * 5));
                secondExtendedPath.push(extendedPoint);
            }

            // Add extended path visualizations using VisualizationManager
            visualizationManager.addVisualization({
                durationTicks: 200, // Show for 10 seconds (200 ticks)
                lineData: {
                    positions: firstExtendedPath,
                    colorInterpolator: fadeOutInterpolatorFrom(extendedPathColor)
                }
            });

            visualizationManager.addVisualization({
                durationTicks: 200, // Show for 10 seconds (200 ticks)
                lineData: {
                    positions: secondExtendedPath,
                    colorInterpolator: fadeOutInterpolatorFrom(extendedPathColor)
                }
            });

            // Add a visualization for the portal location itself
            visualizationManager.addVisualization({
                durationTicks: 20 * 60 * 10,
                textData: {
                    textProvider: (durationTicks: number, ticksRemaining: number) => [
                        `§aEnder Portal`,
                        `§fX: ${intersectX.toFixed(1)}`,
                        `§fZ: ${intersectZ.toFixed(1)}`,
                        `§7${Math.floor(ticksRemaining / 20)}s remaining`
                    ],
                    position: portalPos,
                    textPositionEnum: TextPosition.TOP_CENTER,
                    colorInterpolator: fadeOutInterpolatorFrom(portalFoundColor)
                }
            });

            // Clear only the tracking state, but keep visualizations and color mappings
            activeEyePaths.clear();
            completedEyePaths.clear();
        }
    });

    mod.on("disable", () => {
        resetAllState();
    });
});
