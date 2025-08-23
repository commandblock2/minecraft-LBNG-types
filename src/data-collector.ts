import { File } from "jvm-types/java/io/File";
import { FileOutputStream } from "jvm-types/java/io/FileOutputStream";
import { OutputStreamWriter } from "jvm-types/java/io/OutputStreamWriter";
import { BufferedWriter } from "jvm-types/java/io/BufferedWriter";
import { InputStreamReader } from "jvm-types/java/io/InputStreamReader";
import { BufferedReader } from "jvm-types/java/io/BufferedReader";
import { ProcessBuilder } from "jvm-types/java/lang/ProcessBuilder";
import { Process } from "jvm-types/java/lang/Process";
import { OutputStream } from "jvm-types/java/io/OutputStream";
import { VisualizationManager, fadeOutInterpolatorFrom, defaultRainbowInterpolator } from "lbng-utils-typed/dist/visualization-utils";
import { Color4b } from "jvm-types/net/ccbluex/liquidbounce/render/engine/type/Color4b";

import { RotationManager } from "jvm-types/net/ccbluex/liquidbounce/utils/aiming/RotationManager";
import { Rotation } from "jvm-types/net/ccbluex/liquidbounce/utils/aiming/data/Rotation";
import { KillAuraRotationsConfigurable } from "jvm-types/net/ccbluex/liquidbounce/features/module/modules/combat/killaura/KillAuraRotationsConfigurable";
import { Priority } from "jvm-types/net/ccbluex/liquidbounce/utils/kotlin/Priority";

import { GameTickEvent } from "jvm-types/net/ccbluex/liquidbounce/event/events/GameTickEvent";
import { EntityPose } from "jvm-types/net/minecraft/entity/EntityPose";
import { BlockPos } from "jvm-types/net/minecraft/util/math/BlockPos";
import { Box } from "jvm-types/net/minecraft/util/math/Box";
import { Vec3d } from "jvm-types/net/minecraft/util/math/Vec3d";

import { BaritoneAPI } from "jvm-types/baritone/api/BaritoneAPI";
import { IPath } from "jvm-types/baritone/api/pathing/calc/IPath";
import { GoalBlock } from "jvm-types/baritone/api/pathing/goals/GoalBlock";
import { PlayerInput } from "jvm-types/net/minecraft/util/PlayerInput";
import { BetterBlockPos } from "jvm-types/baritone/api/utils/BetterBlockPos";
import { AStarPathFinder } from "jvm-types/baritone/pathing/calc/AStarPathFinder";
import { Favoring } from "jvm-types/baritone/utils/pathing/Favoring";
import { CalculationContext } from "jvm-types/baritone/pathing/movement/CalculationContext";
import { PathCalculationResult$Type } from "jvm-types/baritone/api/utils/PathCalculationResult$Type";

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
import { Goal } from "jvm-types/baritone/api/pathing/goals/Goal";
import { MovementInputEvent } from "jvm-types/net/ccbluex/liquidbounce/event/events/MovementInputEvent";
import { DirectionalInput } from "jvm-types/net/ccbluex/liquidbounce/utils/movement/DirectionalInput";

const script = registerScript.apply({
    name: "data-collector",
    version: "1.0.0",
    authors: ["Roo"]
});


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
            name: "GoalX",
            default: 0,
            range: [-10000, 10000]
        }),
        goalY: Setting.float({
            name: "GoalY",
            default: 0,
            range: [-10000, 10000]
        }),
        goalZ: Setting.float({
            name: "GoalZ",
            default: 0,
            range: [-10000, 10000]
        }),
        visualizeBoxes: Setting.boolean({
            name: "Visualize Collected Boxes",
            default: false
        }),
        setBaritoneGoal: Setting.boolean({
            name: "Set Baritone Goal",
            default: false
        }),
        launchCustomInferenceProcess: Setting.boolean({
            name: "Launch Custom Inference Process",
            default: false
        }),
        customInferenceProcessCommand: Setting.text({
            name: "Custom Inference Process Command",
            default: ""
        })
    }
}, (mod) => {
    let processWriter: BufferedWriter | null = null;
    let externalProcess: Process | null = null;
    let processReader: BufferedReader | null = null; // New BufferedReader for process stdout
    let collectedData: TickData[] = [];
    const HISTORY_SIZE = 40; // Last N ticks for historical player states
    const historicalPlayerStates: HistoricalPlayerState[] = [];
    let lastYaw: number | null = null;
    let lastPitch: number | null = null;
    let lastCollectionTick = 0;

    const visualizationManager = new VisualizationManager(mod);
    let tickCounter = 0;
    // Internal tick counter that is stable across player deaths/world changes.
    // mc.player.age resets when the player dies or changes world; use this counter
    // to represent monotonically increasing gameticks while this module is enabled.
    let internalTick = 0;
    let prevPath: IPath | null = null;
    let latestComputedPath: IPath | null = null;
    let lastAStarTick = 0;
    const ASTAR_RECALC_INTERVAL = 20;
    // let dynamicInterestScan: CollisionBox[] = [];
    let dynamicInterestBlockSet: HashSet<Vec3i> = new HashSet();

    mod.on("enable", () => {
        try {
            if (mod.settings.launchCustomInferenceProcess.get()) {
                const commandString = mod.settings.customInferenceProcessCommand.get();
                if (commandString) {
                    const parts = commandString.split(" ");
                    const customProcessBuilder = new ProcessBuilder(parts);
                    externalProcess = customProcessBuilder.start();
                    // Initialize BufferedReader for stdout
                    processReader = new BufferedReader(new InputStreamReader(externalProcess.getInputStream()));
                    // Initialize processWriter for stdin of the inference engine
                    // @ts-expect-error
                    processWriter = new BufferedWriter(new OutputStreamWriter(externalProcess.getOutputStream()));
                    Client.displayChatMessage(`[DataCollector] Launched custom inference process: ${commandString}`);
                } else {
                    Client.displayChatMessage(`[DataCollector] Custom inference process command is empty. Not launching.`);
                }
            } else {
                const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
                const logFileName = `${mod.settings.outputFilePrefix.get()}_${timestamp}.jsonl.zst`;
                const processBuilder = new ProcessBuilder(["zstd", "-o", logFileName]);
                externalProcess = processBuilder.start();
                const outputStream = externalProcess.getOutputStream();
                // @ts-expect-error
                processWriter = new BufferedWriter(new OutputStreamWriter(outputStream)); // Renamed from processWriter
                Client.displayChatMessage(`DataCollector enabled. Logging to ${logFileName}`);
            }

            collectedData = []; // Clear previous data
            historicalPlayerStates.length = 0; // Clear historical data
            lastYaw = mc.player?.yaw ?? null;
            lastPitch = mc.player?.pitch ?? null;

            if (mod.settings.setBaritoneGoal.get()) {
                const goalX = mod.settings.goalX.get();
                const goalY = mod.settings.goalY.get();
                const goalZ = mod.settings.goalZ.get();
                const baritone = BaritoneAPI.getProvider().getPrimaryBaritone();
                baritone.getCustomGoalProcess().setGoalAndPath(new GoalBlock(goalX, goalY, goalZ));
                Client.displayChatMessage(`[DataCollector] Baritone goal set to X:${goalX}, Y:${goalY}, Z:${goalZ}`);
            }

        } catch (e) {
            Client.displayChatMessage(`[DataCollector] Failed to enable: ${e}`);
            processWriter = null;
            externalProcess = null;
            processReader = null; // Ensure reader is nullified on error
        }
    });

    mod.on("disable", () => {
        if (processWriter) {
            try {
                // Write any remaining collected data before closing
                collectedData.forEach(data => {
                    if (processWriter) { // Ensure processWriter is not null before writing
                        // @ts-expect-error
                        processWriter.write(JSON.stringify(data));
                        processWriter.newLine();
                    }
                });
                if (processWriter) { // Ensure processWriter is not null before closing
                    processWriter.close();
                }
                Client.displayChatMessage("DataCollector disabled. Waiting for external process to finish...");
            } catch (e) {
                Client.displayChatMessage(`[DataCollector] Failed to close log file: ${e}`);
            }
            processWriter = null;
        }
    
        if (processReader) {
            try {
                processReader.close();
            } catch (e) {
                Client.displayChatMessage(`[DataCollector] Failed to close process reader: ${e}`);
            }
            processReader = null;
        }
    
        if (externalProcess) {
            try {
                const exitCode = externalProcess.waitFor();
                Client.displayChatMessage(`[DataCollector] External process exited with code: ${exitCode}`);
            } catch (e) {
                Client.displayChatMessage(`[DataCollector] Failed to wait for external process: ${e}`);
            }
            externalProcess.destroy(); // Ensure process is terminated
            externalProcess = null;
        }
    
        if (visualizationManager) {
            visualizationManager.clearAllVisualizations();
        }
    
        // Clear retained caches and path references so GC can reclaim memory
        try {
            if (dynamicInterestBlockSet) {
                try {
                    dynamicInterestBlockSet.clear();
                } catch (e) { /* ignore */ }
                dynamicInterestBlockSet = new HashSet();
            }
        } catch (e) { /* ignore */ }
    
        // Drop cached path references so large path graphs can be GC'd
        latestComputedPath = null;
        prevPath = null;
    
        // Clear Baritone goal on disable
        if (mod.settings.setBaritoneGoal.get()) {
            const baritone = BaritoneAPI.getProvider().getPrimaryBaritone();
            baritone.getCustomGoalProcess().setGoalAndPath(null as unknown as Goal); // Clear the goal
            Client.displayChatMessage(`[DataCollector] Baritone goal cleared.`);
        }
    });

    

    mod.on("movementinput", (event: MovementInputEvent) => {

        if (!mc.player)
            return;

        // Handle inference process output if enabled
        if (mod.settings.launchCustomInferenceProcess.get() && processReader) {
            try {
                while (processReader.ready()) {
                    const line = processReader.readLine();
                    if (line) {
                        try {
                            const inferenceOutput: BaritoneAction = JSON.parse(line);
                            // Apply inferred actions to the player
                            if (inferenceOutput.look_change) {
                                const targetYaw = mc.player.yaw + inferenceOutput.look_change.yaw;
                                const targetPitch = mc.player.pitch + inferenceOutput.look_change.pitch;
                                RotationManager.INSTANCE.setRotationTarget(
                                    new Rotation(Primitives.float(targetYaw), Primitives.float(targetPitch), true),
                                    false,
                                    KillAuraRotationsConfigurable.INSTANCE,
                                    Priority.IMPORTANT_FOR_USAGE_2,
                                    mod,
                                    null
                                );
                            }

                            let currentForward = mc.player.input.playerInput.forward();
                            let currentBackward = mc.player.input.playerInput.backward();
                            let currentLeft = mc.player.input.playerInput.left();
                            let currentRight = mc.player.input.playerInput.right();
                            let currentJump = mc.player.input.playerInput.jump();
                            let currentSneak = mc.player.input.playerInput.sneak();
                            let currentSprint = mc.player.input.playerInput.sprint();

                            if (inferenceOutput.move_direction) {
                                currentForward = false;
                                currentBackward = false;
                                currentLeft = false;
                                currentRight = false;

                                switch (inferenceOutput.move_direction) {
                                    case 'FORWARD': currentForward = true; break;
                                    case 'BACKWARD': currentBackward = true; break;
                                    case 'LEFT': currentLeft = true; break;
                                    case 'RIGHT': currentRight = true; break;
                                    case 'FORWARD_LEFT': currentForward = true; currentLeft = true; break;
                                    case 'FORWARD_RIGHT': currentForward = true; currentRight = true; break;
                                    case 'BACKWARD_LEFT': currentBackward = true; currentLeft = true; break;
                                    case 'BACKWARD_RIGHT': currentBackward = true; currentRight = true; break;
                                }
                            }

                            if (inferenceOutput.jump !== undefined && mc.player.onGround) {
                                currentJump = inferenceOutput.jump;
                            }
                            if (inferenceOutput.sneak !== undefined && !currentJump) {
                                currentSneak = inferenceOutput.sneak;
                            }
                            if (inferenceOutput.sprint !== undefined) {
                                currentSprint = inferenceOutput.sprint;
                            }

                            // Reconstruct PlayerInput
                            event.jump = currentJump;
                            event.sneak = currentSneak;
                            event.directionalInput = new DirectionalInput(
                                currentForward,
                                currentBackward,
                                currentLeft,
                                currentRight
                            );

                            // mc.player.setSprinting(currentSprint)

                        } catch (parseError) {
                            Client.displayChatMessage(`[DataCollector] Error parsing inference output: ${parseError} - Line: ${line}`);
                            console.error(parseError);
                        }
                    }
                }
            } catch (readError) {
                Client.displayChatMessage(`[DataCollector] Error reading from inference process stdout: ${readError}`);
                console.error(readError);
            }
        }

    });

    mod.on("gametick", (event: GameTickEvent) => {
        if (!mc.player || !mc.world) {
            return;
        }


        // Data collection logic (only if not launching custom inference process, or if you want to log both)
        if (processWriter) {
            // increment our internal tick counter for each processed gametick when player/world are available
            internalTick++;
            if ((internalTick - lastCollectionTick) < (mod.settings.collectionInterval.get() as unknown as number)) {
                return;
            }
            lastCollectionTick = internalTick;

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
                const startScan = new BlockPos(playerBlockPos.getX() - scanRadius, playerBlockPos.getY() - scanRadius, playerBlockPos.getZ() - scanRadius);
                const endScan = new BlockPos(playerBlockPos.getX() + scanRadius, playerBlockPos.getY() + scanRadius, playerBlockPos.getZ() + scanRadius);
                for (const blockPos of BlockPos.iterate(startScan, endScan)) {
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
                                area_source_type: 'FIXED_RADIUS'
                            });
                        }
                    }
                }

                // Collect DYNAMIC_INTEREST blocks along a path.
                // When a custom inference process is launched (online inference mode), we compute an A* path
                // asynchronously and use it as the source of dynamic interest blocks. Otherwise fall back to
                // Baritone's current path.
                let computedPath: IPath | null = null;
                if (mod.settings.launchCustomInferenceProcess.get()) {
                    // Periodically schedule an asynchronous A* path calculation so we don't block the client thread.
                    if ((internalTick - lastAStarTick) >= ASTAR_RECALC_INTERVAL) {
                        lastAStarTick = internalTick;
                        try {
                            const baritone = BaritoneAPI.getProvider().getPrimaryBaritone();
                            const playerPos = baritone.getPlayerContext().playerFeet();
                            const start = new BetterBlockPos(playerPos.getX(), playerPos.getY(), playerPos.getZ());
                            const context = new CalculationContext(baritone, true);
                            const favoring = new Favoring(baritone.getPlayerContext(), prevPath as unknown as IPath, context);
                            const goal = new GoalBlock(mod.settings.goalX.get(), mod.settings.goalY.get(), mod.settings.goalZ.get());
                            const pathfinder = new AStarPathFinder(
                                start,
                                start.getX(),
                                start.getY(),
                                start.getZ(),
                                goal,
                                favoring,
                                context
                            );
                            // @ts-expect-error
                            UnsafeThread.run(() => {
                                const result = pathfinder.calculate(Primitives.long(2000), Primitives.long(5000));
                                if (result.getType() != PathCalculationResult$Type.CANCELLATION) {
                                    const path = result.getPath().get();
                                    mc.execute(() => {
                                        // Store latest computed path for this gametick handler to pick up
                                        latestComputedPath = path;
                                    });
                                }
                            });
                        } catch (e) {
                            console.error(e);
                        }
                    }
                    computedPath = latestComputedPath;
                } else {
                    const baritone = BaritoneAPI.getProvider().getPrimaryBaritone();
                    // @ts-expect-error
                    computedPath = baritone.getPathingBehavior().getPath().orElseGet(() => null);
                }
 
                if (computedPath && computedPath != prevPath) {
                    dynamicInterestBlockSet = new HashSet();
                    prevPath = computedPath;
                    const pathPositions = computedPath.positions();
                    const horizontalExpand = 1;
                    const downwardExpand = 1;
                    const upwardExpand = 2;
 
                    for (const pathBlock of pathPositions) {
                        const start = new BlockPos(pathBlock.getX() - horizontalExpand, pathBlock.getY() - downwardExpand, pathBlock.getZ() - horizontalExpand);
                        const end = new BlockPos(pathBlock.getX() + horizontalExpand, pathBlock.getY() + upwardExpand, pathBlock.getZ() + horizontalExpand);
                        for (const blockPos of BlockPos.iterate(start, end)) {
                            // BlockPos.iterate typically reuses a mutable BlockPos instance for performance.
                            // Create a fresh immutable BlockPos copy before storing/checking in the HashSet so
                            // we don't insert a repeatedly-mutated object (which breaks set semantics).
                            const blockCopy = new BlockPos(blockPos.getX(), blockPos.getY(), blockPos.getZ());
                            if (dynamicInterestBlockSet.contains(blockCopy)) continue;
                            dynamicInterestBlockSet.add(blockCopy);
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
                                area_source_type: 'DYNAMIC_INTEREST'
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
                baritoneAction.sprint = mc.player.isSprinting(); // TODO: special care for the bot when inferencing.

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
                    // Use our internal tick counter instead of mc.player.age to avoid resets when player dies/changes world.
                    tick_id: internalTick,
                    timestamp_ms: Date.now(),
                    player_state: playerState,
                    local_environment_scan: localEnvironmentScan,
                    historical_player_states: [...historicalPlayerStates], // Clone to avoid mutation
                    baritone_action: baritoneAction
                };

                // @ts-expect-error
                processWriter.write(JSON.stringify(tickData));
                processWriter.newLine();

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
        }
    });
});

export { }