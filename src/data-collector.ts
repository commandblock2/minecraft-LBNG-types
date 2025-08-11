import { File } from "jvm-types/java/io/File";
import { FileOutputStream } from "jvm-types/java/io/FileOutputStream";
import { OutputStreamWriter } from "jvm-types/java/io/OutputStreamWriter";
import { BufferedWriter } from "jvm-types/java/io/BufferedWriter";
import { ProcessBuilder } from "jvm-types/java/lang/ProcessBuilder";
import { Process } from "jvm-types/java/lang/Process";
import { OutputStream } from "jvm-types/java/io/OutputStream";
import { VisualizationManager, fadeOutInterpolatorFrom, defaultRainbowInterpolator } from "../packages/lbng-utils-typed/src/visualization-utils";
import { Color4b } from "jvm-types/net/ccbluex/liquidbounce/render/engine/type/Color4b";

import { GameTickEvent } from "jvm-types/net/ccbluex/liquidbounce/event/events/GameTickEvent";
import { EntityPose } from "jvm-types/net/minecraft/entity/EntityPose";
import { BlockPos } from "jvm-types/net/minecraft/util/math/BlockPos";
import { Box } from "jvm-types/net/minecraft/util/math/Box";
import { Vec3d } from "jvm-types/net/minecraft/util/math/Vec3d";

import { BaritoneAPI } from "jvm-types/baritone/api/BaritoneAPI";
import { IPath } from "jvm-types/baritone/api/pathing/calc/IPath";
import { PlayerInput } from "jvm-types/net/minecraft/util/PlayerInput";

import {
    CombinedInputAndOutputDataSchema,
    TickData,
    PlayerState,
    Coordinates3D,
    Velocity3D,
    LookDirection,
    PlayerPose as SchemaPlayerPose,
    BoundingBoxCoordinates,
    BoxDimensions,
    TraversabilityData,
    AreaSourceType,
    CollisionBox,
    HistoricalPlayerState,
    BaritoneAction
} from "../packages/deep-learning-bot-utils/mvp/combined_schema";
import { BlockView } from "jvm-types/net/minecraft/world/BlockView";
// @ts-expect-error
import { HashSet } from "jvm-types/java/util/HashSet";
import { Vec3i } from "jvm-types/net/minecraft/util/math/Vec3i";

const script = registerScript.apply({
    name: "data-collector",
    version: "1.0.0",
    authors: ["Roo"]
});

let logWriter: BufferedWriter | null = null;
let zstdProcess: Process | null = null;
let collectedData: TickData[] = [];
const HISTORY_SIZE = 40; // Last N ticks for historical player states
const historicalPlayerStates: HistoricalPlayerState[] = [];
let lastYaw: number | null = null;
let lastPitch: number | null = null;

// Helper to convert Minecraft Vec3d to Coordinates3D
function toCoordinates3D(vec: Vec3d): Coordinates3D {
    return { x: vec.getX(), y: vec.getY(), z: vec.getZ() };
}

// Helper to convert Minecraft Box to BoundingBoxCoordinates
function toBoundingBoxCoordinates(box: Box): BoundingBoxCoordinates {
    return { min_x: box.minX, min_y: box.minY, min_z: box.minZ, max_x: box.maxX, max_y: box.maxY, max_z: box.maxZ };
}

// Helper to convert BoundingBoxCoordinates to Minecraft Box
function toMinecraftBox(coords: BoundingBoxCoordinates): Box {
    return new Box(coords.min_x, coords.min_y, coords.min_z, coords.max_x, coords.max_y, coords.max_z);
}

// Helper to convert RelativePosition to absolute Vec3d
function toAbsoluteVec3d(relativePos: Coordinates3D, playerPos: Vec3d): Vec3d {
    return new Vec3d(playerPos.getX() + relativePos.x, playerPos.getY() + relativePos.y, playerPos.getZ() + relativePos.z);
}

// Helper to get PlayerPose from Minecraft EntityPose
function getPlayerPose(pose: EntityPose): SchemaPlayerPose {
    switch (pose) {
        case EntityPose.STANDING: return 'STANDING';
        case EntityPose.CROUCHING: return 'SNEAKING'; // Map CROUCHING to SNEAKING
        case EntityPose.SWIMMING: return 'SWIMMING';
        // Add other poses if needed and available in SchemaPlayerPose
        default: return 'STANDING'; // Default to standing if unknown or not explicitly mapped
    }
}

// Helper to calculate BoxDimensions
function calculateBoxDimensions(box: Box): BoxDimensions {
    return {
        length: box.maxX - box.minX,
        width: box.maxZ - box.minZ,
        height: box.maxY - box.minY
    };
}

// Helper to determine TraversabilityData (simplified for now, needs more detailed logic)
function getTraversabilityData(blockState: any): TraversabilityData {
    // This is a simplified example. A real implementation would need to check block properties.
    if (blockState.isAir()) return 'AIR';
    if (blockState.isLiquid()) return 'FLUID';
    // More sophisticated checks for SOLID_WALKABLE, OBSTRUCTION, etc.
    // For now, a basic check:
    if (blockState.isSolidBlock(mc.world, new BlockPos(0, 0, 0))) return 'SOLID_WALKABLE'; // Placeholder blockpos
    return 'SOLID_WALKABLE';
}

script.registerModule({
    name: "DataCollector",
    description: "Collects observation and Baritone action data for training.",
    category: "Misc",
    settings: {
        outputFilePrefix: Setting.text({
            name: "Output File Prefix",
            default: "session_data"
        }),
        collectionInterval: Setting.int({
            name: "Collection Interval (ticks)",
            default: 1,
            range: [1, 20]
        }),
        scanRadius: Setting.int({
            name: "Environment Scan Radius",
            default: 3,
            range: [1, 32]
        }),
        goalX: Setting.float({
            name: "Goal X",
            default: 0,
            range: [-10000, 10000]
        }),
        goalY: Setting.float({
            name: "Goal Y",
            default: 0,
            range: [-10000, 10000]
        }),
        goalZ: Setting.float({
            name: "Goal Z",
            default: 0,
            range: [-10000, 10000]
        }),
        visualizeBoxes: Setting.boolean({
            name: "Visualize Collected Boxes",
            default: false
        })
    }
}, (mod) => {
    let lastCollectionTick = 0;

    const visualizationManager = new VisualizationManager(mod);
    let tickCounter = 0;
    let prevPath: IPath | null = null;
    // let dynamicInterestScan: CollisionBox[] = [];
    let dynamicInterestBlockSet: HashSet<Vec3i> = new HashSet();

    mod.on("enable", () => {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const logFileName = `${mod.settings.outputFilePrefix.get()}_${timestamp}.jsonl.zst`;
            const processBuilder = new ProcessBuilder(["zstd", "-o", logFileName]);
            zstdProcess = processBuilder.start();
            const outputStream = zstdProcess.getOutputStream();
            // @ts-expect-error
            logWriter = new BufferedWriter(new OutputStreamWriter(outputStream));
            collectedData = []; // Clear previous data
            historicalPlayerStates.length = 0; // Clear historical data
            lastYaw = mc.player?.yaw ?? null;
            lastPitch = mc.player?.pitch ?? null;
            Client.displayChatMessage(`DataCollector enabled. Logging to ${logFileName}`);

        } catch (e) {
            Client.displayChatMessage(`[DataCollector] Failed to start zstd process or open log file: ${e}`);
            logWriter = null;
            zstdProcess = null;
        }
    });

    mod.on("disable", () => {
        if (logWriter) {
            try {
                // Write any remaining collected data before closing
                collectedData.forEach(data => {
                    if (logWriter) { // Ensure logWriter is not null before writing
                        // @ts-expect-error
                        logWriter.write(JSON.stringify(data));
                        logWriter.newLine();
                    }
                });
                if (logWriter) { // Ensure logWriter is not null before closing
                    logWriter.close();
                }
                Client.displayChatMessage("DataCollector disabled. Waiting for zstd to finish compression...");
                if (zstdProcess) {
                    const exitCode = zstdProcess.waitFor();
                    Client.displayChatMessage(`zstd process exited with code: ${exitCode}`);
                }
                Client.displayChatMessage("Data file closed and compressed.");
            } catch (e) {
                Client.displayChatMessage(`[DataCollector] Failed to close log file or wait for zstd: ${e}`);
            }
            logWriter = null;
            zstdProcess = null;
        }
        if (visualizationManager) {
            visualizationManager.clearAllVisualizations();
        }
    });

    mod.on("gametick", (event: GameTickEvent) => {
        if (!logWriter || !mc.player || !mc.world) {
            return;
        }

        if ((mc.player.age - lastCollectionTick) < (mod.settings.collectionInterval.get() as unknown as number)) {
            return;
        }
        lastCollectionTick = mc.player.age;

        try {
            // 1. Player State
            const playerState: PlayerState = {
                position: toCoordinates3D(mc.player.getPos()),
                velocity: { vx: mc.player.getVelocity().x, vy: mc.player.getVelocity().y, vz: mc.player.getVelocity().z },
                look_direction: { yaw: mc.player.yaw, pitch: mc.player.pitch },
                player_pose: getPlayerPose(mc.player.getPose()),
                ground_proximity: mc.player.isOnGround(),
                predicted_passive_next_tick_state: {
                    // Simplified prediction: assumes constant velocity for one tick
                    predicted_pos: {
                        x: mc.player.getX() + mc.player.getVelocity().x,
                        y: mc.player.getY() + mc.player.getVelocity().y,
                        z: mc.player.getZ() + mc.player.getVelocity().z,
                    },
                    predicted_vel: {
                        vx: mc.player.getVelocity().x,
                        vy: mc.player.getVelocity().y,
                        vz: mc.player.getVelocity().z,
                    }
                }
            };

            // 2. Historical Player States
            const currentHistoricalState: HistoricalPlayerState = {
                position: toCoordinates3D(mc.player.getPos()),
                velocity: { vx: mc.player.getVelocity().x, vy: mc.player.getVelocity().y, vz: mc.player.getVelocity().z },
                look_direction: { yaw: mc.player.yaw, pitch: mc.player.pitch },
                player_pose: getPlayerPose(mc.player.getPose()),
                fall_distance: mc.player.fallDistance // Assuming fallDistance is directly accessible
            };
            historicalPlayerStates.push(currentHistoricalState);
            if (historicalPlayerStates.length > HISTORY_SIZE) {
                historicalPlayerStates.shift(); // Remove oldest entry
            }

            // 3. Local Environment Scan
            const fixedRadiusScan: CollisionBox[] = [];
            const dynamicInterestScan: CollisionBox[] = [];

            const playerBlockPos = mc.player.getBlockPos();
            const scanRadius = mod.settings.scanRadius.get() as unknown as number;

            // Collect FIXED_RADIUS blocks
            for (let x = -scanRadius; x <= scanRadius; x++) {
                for (let y = -scanRadius; y <= scanRadius; y++) {
                    for (let z = -scanRadius; z <= scanRadius; z++) {
                        const blockPos = new BlockPos(playerBlockPos.getX() + x, playerBlockPos.getY() + y, playerBlockPos.getZ() + z);
                        const blockState = mc.world.getBlockState(blockPos);

                        if (blockState && !blockState.isAir()) {
                            const blockBoxes = blockState.getCollisionShape(mc.world as unknown as BlockView, blockPos).getBoundingBoxes();
                            for (const blockBox of blockBoxes) {
                                const relativePos = {
                                    x: blockPos.getX() - mc.player.getX(),
                                    y: blockPos.getY() - mc.player.getY(),
                                    z: blockPos.getZ() - mc.player.getZ()
                                };

                                fixedRadiusScan.push({
                                    bounding_box_coordinates: toBoundingBoxCoordinates(blockBox),
                                    relative_position: relativePos,
                                    box_dimensions: calculateBoxDimensions(blockBox),
                                    element_identifier: blockState.getBlock().getName().getString(),
                                    traversability_data: getTraversabilityData(blockState),
                                    element_state_properties: {},
                                    area_source_type: 'FIXED_RADIUS',
                                    box_validity: true
                                });
                            }
                        }
                    }
                }
            }

            // Collect DYNAMIC_INTEREST blocks along Baritone's path with expansion
            const baritone = BaritoneAPI.getProvider().getPrimaryBaritone();
            // @ts-expect-error
            const currentPath: IPath | null = baritone.getPathingBehavior().getPath().orElseGet(() => null);



            if (currentPath && currentPath != prevPath) {
                dynamicInterestBlockSet = new HashSet();
                prevPath = currentPath;
                const pathPositions = currentPath.positions();
                const horizontalExpand = 1;
                const downwardExpand = 1;
                const upwardExpand = 2;

                for (const pathBlock of pathPositions) {
                    for (let x = -horizontalExpand; x <= horizontalExpand; x++) {
                        for (let y = -downwardExpand; y <= upwardExpand; y++) {
                            for (let z = -horizontalExpand; z <= horizontalExpand; z++) {
                                const blockPos = new BlockPos(pathBlock.getX() + x, pathBlock.getY() + y, pathBlock.getZ() + z);
                                if (dynamicInterestBlockSet.contains(blockPos))
                                    continue
                                else
                                    dynamicInterestBlockSet.add(blockPos)
                            }
                        }
                    }
                }
            }

            dynamicInterestBlockSet.forEach((blockPos: BlockPos) => {
                let blockState = mc.world.getBlockState(blockPos);
                if (blockState && !blockState.isAir()) {
                    if (!mc.player)
                        return;
                    const blockBoxes = blockState.getCollisionShape(mc.world as unknown as BlockView, blockPos).getBoundingBoxes();
                    for (const blockBox of blockBoxes) {
                        const relativePos = {
                            x: blockPos.getX() - mc.player.getX(),
                            y: blockPos.getY() - mc.player.getY(),
                            z: blockPos.getZ() - mc.player.getZ()
                        };

                        const collisionBox: CollisionBox = {
                            bounding_box_coordinates: toBoundingBoxCoordinates(blockBox),
                            relative_position: relativePos,
                            box_dimensions: calculateBoxDimensions(blockBox),
                            element_identifier: blockState.getBlock().getName().getString(),
                            traversability_data: getTraversabilityData(blockState),
                            element_state_properties: {},
                            area_source_type: 'DYNAMIC_INTEREST',
                            box_validity: true
                        };
                        dynamicInterestScan.push(collisionBox);
                    }
                }
            });
            const localEnvironmentScan: CollisionBox[] = [...fixedRadiusScan, ...dynamicInterestScan];

            // 4. Baritone Action (This is the most challenging part without direct API)
            // This will require introspection into Baritone's internal state or inferring from its movement.
            // For MVP, we might need to simplify or make assumptions.
            // Let's try to infer based on Baritone's current movement state.
            // This is a placeholder and needs significant refinement.
            const baritoneAction: BaritoneAction = {
                move_direction: 'NONE',
                look_change: { yaw: 0, pitch: 0 },
                jump: false,
                sneak: false,
                sprint: false
            };

            // Infer Baritone's action based on mc.player.input
            const playerInput: PlayerInput = mc.player.input.playerInput;


            if (playerInput.forward() && playerInput.left()) {
                baritoneAction.move_direction = 'FORWARD_LEFT';
            } else if (playerInput.forward() && playerInput.right()) {
                baritoneAction.move_direction = 'FORWARD_RIGHT';
            } else if (playerInput.backward() && playerInput.left()) {
                baritoneAction.move_direction = 'BACKWARD_LEFT';
            } else if (playerInput.backward() && playerInput.right()) {
                baritoneAction.move_direction = 'BACKWARD_RIGHT';
            } else if (playerInput.forward()) {
                baritoneAction.move_direction = 'FORWARD';
            } else if (playerInput.backward()) {
                baritoneAction.move_direction = 'BACKWARD';
            } else if (playerInput.left()) {
                baritoneAction.move_direction = 'LEFT';
            } else if (playerInput.right()) {
                baritoneAction.move_direction = 'RIGHT';
            } else {
                baritoneAction.move_direction = 'NONE';
            }

            baritoneAction.jump = playerInput.jump();
            baritoneAction.sneak = playerInput.sneak();
            baritoneAction.sprint = playerInput.sprint();

            let yawDiff = 0;
            let pitchDiff = 0;

            if (lastYaw !== null && lastPitch !== null) {
                yawDiff = mc.player.yaw - lastYaw;
                pitchDiff = mc.player.pitch - lastPitch;
            }

            baritoneAction.look_change = { yaw: yawDiff, pitch: pitchDiff };

            lastYaw = mc.player.yaw;
            lastPitch = mc.player.pitch;



            const tickData: TickData = {
                tick_id: mc.player.age,
                timestamp_ms: Date.now(),
                player_state: playerState,
                local_environment_scan: localEnvironmentScan,
                historical_player_states: [...historicalPlayerStates], // Clone to avoid mutation
                baritone_action: baritoneAction
            };

            // @ts-expect-error
            logWriter.write(JSON.stringify(tickData));
            logWriter.newLine();

            // Visualize collected boxes if enabled
            tickCounter++;
            if (mod.settings.visualizeBoxes.get() && !(tickCounter % 5)) {
                localEnvironmentScan.forEach(collisionBox => {
                    const box = toMinecraftBox(collisionBox.bounding_box_coordinates);
                    const position = toAbsoluteVec3d(collisionBox.relative_position, mc.player!.getPos());
                    const fillColor = collisionBox.area_source_type === 'DYNAMIC_INTEREST'
                        ? new Color4b(150, 255, 150, 150) // Lighter Green for DYNAMIC_INTEREST
                        : new Color4b(150, 150, 255, 150); // Lighter Blue for FIXED_RADIUS

                    visualizationManager.addVisualization({
                        durationTicks: 5, // Display for 2 ticks
                        boxData: {
                            box: box,
                            position: position,
                            glow: true, // No glow
                            fillInterpolator: fadeOutInterpolatorFrom(fillColor),
                            outlineInterpolator: fadeOutInterpolatorFrom(new Color4b(fillColor.r(), fillColor.g(), fillColor.b(), 255))
                        }
                    });
                });
            }

        } catch (e) {
            Client.displayChatMessage(`[DataCollector] Error writing to log: ${e}`);
            console.error(e); // Log to console for more details
        }
    });
});

export { }