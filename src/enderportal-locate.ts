import { EyeOfEnderEntity } from "jvm-types/net/minecraft/entity/EyeOfEnderEntity";
import { Vec3d } from "jvm-types/net/minecraft/util/math/Vec3d";
import { MinecraftClient } from "jvm-types/net/minecraft/client/MinecraftClient";
import { ClientWorld } from "jvm-types/net/minecraft/client/world/ClientWorld";
import { GameTickEvent } from "jvm-types/net/ccbluex/liquidbounce/event/events/GameTickEvent";

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
    let completedEyePaths: Vec3d[][] = [];
    let lastLocation: [number, number] | null = null;

    const resetAllState = () => {
        activeEyePaths.clear();
        completedEyePaths = [];
        lastLocation = null;
    };

    mod.on("enable", () => {
        resetAllState();
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
                if (completedEyePaths.length < 2) { // Only store up to two completed paths
                    completedEyePaths.push(path);
                }
            }
            activeEyePaths.delete(eye);
        }

        // Step 2: Add new eyes and record positions for active eyes
        for (const eye of currentEyesInWorld) {
            if (!activeEyePaths.has(eye)) {
                activeEyePaths.set(eye, []);
            }
            activeEyePaths.get(eye)!.push(eye.getPos());
        }

        // Step 3: Check for calculation trigger
        if (completedEyePaths.length === 2) {
            const firstPath = completedEyePaths[0];
            const secondPath = completedEyePaths[1];

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
            resetAllState(); // Instantly reset after detection
        }
    });

    mod.on("disable", () => {
        resetAllState();
    });
});
