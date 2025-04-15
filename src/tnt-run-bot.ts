import {
    Setting,
    Vec3i,
    Vec3d,
    MathHelper,
    BlockPos,
    Hand,
    RotationAxis,
    mc,
    Client,
    RotationUtil,
    ItemUtil,
    NetworkUtil,
    InteractionUtil,
    BlockUtil,
    MovementUtil,
    ReflectionUtil,
    ParameterValidator,
    UnsafeThread,
    localStorage,
    registerScript,
} from "@embedded";
import { Rotation } from "@minecraft-yarn-definitions/types/net/ccbluex/liquidbounce/utils/aiming/data/Rotation";
import { Blocks } from "@minecraft-yarn-definitions/types/net/minecraft/block/Blocks";
import { RenderShortcutsKt } from "@minecraft-yarn-definitions/types/net/ccbluex/liquidbounce/render/RenderShortcutsKt"
import { WorldRenderEnvironment } from "@minecraft-yarn-definitions/types/net/ccbluex/liquidbounce/render/WorldRenderEnvironment";
import { BoxRenderer } from "@minecraft-yarn-definitions/types/net/ccbluex/liquidbounce/render/BoxRenderer"
import { Box } from "@minecraft-yarn-definitions/types/net/minecraft/util/math/Box";
import { Color4b } from "@minecraft-yarn-definitions/types/net/ccbluex/liquidbounce/render/engine/Color4b";
import { SimulatedPlayer } from "@minecraft-yarn-definitions/types/net/ccbluex/liquidbounce/utils/entity/SimulatedPlayer";
import { SimulatedPlayer$SimulatedPlayerInput } from "@minecraft-yarn-definitions/types/net/ccbluex/liquidbounce/utils/entity/SimulatedPlayer$SimulatedPlayerInput";
import { MovementInputEvent } from "@minecraft-yarn-definitions/types/net/ccbluex/liquidbounce/event/events/MovementInputEvent";
import { DirectionalInput } from "@minecraft-yarn-definitions/types/net/ccbluex/liquidbounce/utils/movement/DirectionalInput";
import { PlayerEntity } from "@minecraft-yarn-definitions/types/net/minecraft/entity/player/PlayerEntity";
/* eslint-enable unused-imports/no-unused-imports */
// DO NOT TOUCH ANYTHING ABOVE THIS LINE

const script = registerScript.apply({
    name: "tnt-run-bot",
    version: "1.1.0",
    authors: ["YourName"]
});

// Enhanced class to track disappearing blocks with risk assessment
class BlockTracker {
    private disappearingBlocks: Map<string, { time: number, risk: number }>;
    private blocksPlayerSteppedOn: Map<string, number>;

    constructor() {
        this.disappearingBlocks = new Map();
        this.blocksPlayerSteppedOn = new Map();
    }

    // Track a block that changed to air
    trackBlock(pos: BlockPos): void {
        const key = `${pos.x},${pos.y},${pos.z}`;
        this.disappearingBlocks.set(key, {
            time: mc.world?.getTime() || 0,
            risk: 1.0 // Max risk for blocks that have disappeared
        });
    }

    // Track a block that the player stood on
    trackPlayerBlock(pos: BlockPos): void {
        if (!mc.world) return;

        const key = `${pos.x},${pos.y},${pos.z}`;
        this.blocksPlayerSteppedOn.set(key, mc.world?.getTime());

        // Increase risk for surrounding blocks
        this.updateSurroundingBlockRisk(pos);
    }

    // Update risk for blocks surrounding a position
    private updateSurroundingBlockRisk(pos: BlockPos): void {
        for (let x = -1; x <= 1; x++) {
            for (let z = -1; z <= 1; z++) {
                if (x === 0 && z === 0) continue; // Skip the center block

                const checkPos = new BlockPos(pos.x + x, pos.y, pos.z + z);
                const key = `${checkPos.x},${checkPos.y},${checkPos.z}`;

                if (!this.disappearingBlocks.has(key)) {
                    const currentBlock = this.blocksPlayerSteppedOn.get(key);
                    const currentTime = mc.world?.getTime() || 0;

                    // Calculate distance from center block
                    const distance = Math.sqrt(x * x + z * z);

                    // Calculate risk factor based on proximity and time
                    let risk = 0.2 / distance;

                    if (currentBlock) {
                        // If the block has been stepped on before, increase risk based on time
                        const timeFactor = (currentTime - currentBlock) / 1000; // Normalize by expected lifetime
                        risk += Math.min(0.6, timeFactor * 0.3); // Cap at 0.6 for time-based risk
                    }

                    // Update the risk value in the map
                    const existing = this.blocksPlayerSteppedOn.get(key);
                    if (existing) {
                        this.blocksPlayerSteppedOn.set(key, Math.max(existing, risk));
                    } else {
                        this.blocksPlayerSteppedOn.set(key, risk);
                    }
                }
            }
        }
    }

    // Get the risk factor for a block position (0.0 to 1.0)
    getBlockRisk(pos: BlockPos): number {
        const key = `${pos.x},${pos.y},${pos.z}`;

        // If block has disappeared, it's maximum risk
        if (this.disappearingBlocks.has(key)) {
            return 1.0;
        }

        // Check if it's a block the player has stepped on
        if (this.blocksPlayerSteppedOn.has(key)) {
            const stepTime = this.blocksPlayerSteppedOn.get(key) || 0;
            const currentTime = mc.world?.getTime() || 0;

            // Calculate risk based on time since stepped on
            // Blocks get riskier the longer ago they were stepped on
            const timeSinceStep = currentTime - stepTime;
            const timeBasedRisk = Math.min(0.8, timeSinceStep / 2000); // Cap at 0.8, normalize by expected lifetime

            return timeBasedRisk;
        }

        // Default risk for unknown blocks
        return 0.1;
    }

    // Check if a block is gone (disappeared)
    isBlockGone(pos: BlockPos): boolean {
        const key = `${pos.x},${pos.y},${pos.z}`;
        return this.disappearingBlocks.has(key);
    }

    // Clean up old tracked blocks
    clearOldBlocks(maxAgeMs: number): void {
        const currentTime = mc.world?.getTime() || 0;

        // Clear old disappeared blocks
        for (const [key, data] of this.disappearingBlocks.entries()) {
            if (currentTime - data.time > maxAgeMs) {
                this.disappearingBlocks.delete(key);
            }
        }

        // Clear very old stepped on blocks
        for (const [key, time] of this.blocksPlayerSteppedOn.entries()) {
            if (currentTime - time > maxAgeMs * 2) { // Keep stepped on blocks longer for better risk assessment
                this.blocksPlayerSteppedOn.delete(key);
            }
        }
    }
}

// Class to detect and manage arena boundaries
class ArenaDetector {
    private boundaries: {
        minX: number, maxX: number,
        minY: number, maxY: number,
        minZ: number, maxZ: number
    } | null = null;

    detectArenaBoundaries(): void {
        if (!mc.player || !mc.world) return;

        const player = mc.player;
        const scanRadius = 50;
        const floorY = Math.floor(player.pos.y) - 1;

        let minX = Infinity, maxX = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;

        for (let x = Math.floor(player.pos.x) - scanRadius; x <= Math.floor(player.pos.x) + scanRadius; x++) {
            for (let z = Math.floor(player.pos.z) - scanRadius; z <= Math.floor(player.pos.z) + scanRadius; z++) {
                const blockPos = new BlockPos(x, floorY, z);
                const block = mc.world.getBlockState(blockPos);

                if (block && BlockUtil.getBlock(blockPos) !== Blocks.AIR) {
                    minX = Math.min(minX, x);
                    maxX = Math.max(maxX, x);
                    minZ = Math.min(minZ, z);
                    maxZ = Math.max(maxZ, z);
                }
            }
        }

        if (minX !== Infinity) {
            this.boundaries = {
                minX: minX + 0.5, maxX: maxX + 0.5,
                minY: floorY, maxY: floorY + 10, // Approximate height
                minZ: minZ + 0.5, maxZ: maxZ + 0.5
            };
        }
    }

    isInBounds(position: Vec3d, margin: number = 1.0): boolean {
        if (!this.boundaries) return true; // Assume in bounds if not detected yet

        return position.x >= this.boundaries.minX + margin &&
            position.x <= this.boundaries.maxX - margin &&
            position.y >= this.boundaries.minY &&
            position.y <= this.boundaries.maxY &&
            position.z >= this.boundaries.minZ + margin &&
            position.z <= this.boundaries.maxZ - margin;
    }

    getBoundaries() {
        return this.boundaries;
    }
}

// Simulation-based path planning system
class PathPlanner {
    private blockTracker: BlockTracker;
    private arenaDetector: ArenaDetector;
    private lastSimulationTime: number = 0;
    private simulationCooldown: number = 5; // Ticks between simulations
    private currentPath: Vec3d[] = [];
    private behaviorMode: 'conservative' | 'balanced' | 'aggressive' | 'survival' = 'balanced';

    constructor(blockTracker: BlockTracker, arenaDetector: ArenaDetector) {
        this.blockTracker = blockTracker;
        this.arenaDetector = arenaDetector;
    }

    // Generate and evaluate potential paths
    updatePath(): void {
        if (!mc.player || !mc.world) return;

        const currentTime = mc.world?.getTime();
        if (currentTime - this.lastSimulationTime < this.simulationCooldown) {
            return; // Don't simulate too frequently
        }

        this.lastSimulationTime = currentTime;

        // Generate potential movement directions based on current behavior mode
        const potentialPaths = this.generatePotentialPaths();

        // Simulate and score each path
        const scoredPaths = this.simulateAndScorePaths(potentialPaths);

        // Select the best path
        if (scoredPaths.length > 0) {
            // Sort paths by score (highest first)
            scoredPaths.sort((a, b) => b.score - a.score);

            // Select the best path
            this.currentPath = scoredPaths[0].path;

            // Update behavior mode based on current conditions
            this.updateBehaviorMode();
        }
    }

    // Generate potential movement paths based on behavior mode
    private generatePotentialPaths(): { direction: Vec3d, jumps: boolean[] }[] {
        if (!mc.player) return [];

        const player = mc.player;
        const paths: { direction: Vec3d, jumps: boolean[] }[] = [];

        // Generate directions based on behavior mode
        const directions: Vec3d[] = [];

        // Add cardinal directions
        directions.push(new Vec3d(1, 0, 0));  // East
        directions.push(new Vec3d(-1, 0, 0)); // West
        directions.push(new Vec3d(0, 0, 1));  // South
        directions.push(new Vec3d(0, 0, -1)); // North

        // Add diagonal directions
        directions.push(new Vec3d(0.7, 0, 0.7));   // Southeast
        directions.push(new Vec3d(0.7, 0, -0.7));  // Northeast
        directions.push(new Vec3d(-0.7, 0, 0.7));  // Southwest
        directions.push(new Vec3d(-0.7, 0, -0.7)); // Northwest

        // Add circular movement patterns for the aggressive mode
        if (this.behaviorMode === 'aggressive') {
            for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
                directions.push(new Vec3d(
                    Math.cos(angle) * 0.8,
                    0,
                    Math.sin(angle) * 0.8
                ));
            }
        }

        // Create paths with different jumping patterns
        for (const direction of directions) {
            // Normal walking path
            paths.push({
                direction: direction,
                jumps: Array(10).fill(false)
            });

            // Regular jumping path (jump every 5 ticks)
            paths.push({
                direction: direction,
                jumps: Array(10).fill(false).map((_, i) => i % 5 === 0)
            });

            // Frequent jumping path
            if (this.behaviorMode === 'aggressive' || this.behaviorMode === 'survival') {
                paths.push({
                    direction: direction,
                    jumps: Array(10).fill(false).map((_, i) => i % 3 === 0)
                });
            }
        }

        return paths;
    }

    // Simulate paths and assign scores
    private simulateAndScorePaths(potentialPaths: { direction: Vec3d, jumps: boolean[] }[]): { path: Vec3d[], score: number }[] {
        if (!mc.player || !mc.world) return [];

        const scoredPaths: { path: Vec3d[], score: number }[] = [];
        const simulationDepth = 15; // How many ticks to simulate

        for (const pathData of potentialPaths) {
            try {
                // Create a simulated player clone
                // Convert world direction to local movement input based on player yaw
                const yawRad = (mc.player.yaw || 0) * Math.PI / 180;
                const forwardVec = { x: -Math.sin(yawRad), z: Math.cos(yawRad) };
                const rightVec = { x: Math.cos(yawRad), z: Math.sin(yawRad) };
                const dir = pathData.direction;

                // Project direction onto local axes
                const forwardMag = dir.x * forwardVec.x + dir.z * forwardVec.z;
                const rightMag = dir.x * rightVec.x + dir.z * rightVec.z;

                const forwards = forwardMag > 0.1;
                const backwards = forwardMag < -0.1;
                const right = rightMag > 0.1;
                const left = rightMag < -0.1;

                const directionalInput = new DirectionalInput(forwards, backwards, left, right);
                const playerInput = new SimulatedPlayer$SimulatedPlayerInput(
                    directionalInput,
                    false, // jumping (handled per-tick)
                    mc.player.isSprinting(),
                    false  // sneaking
                );

                // Create the simulated player
                const simulatedPlayer = new SimulatedPlayer(
                    mc.player as unknown as PlayerEntity,
                    playerInput,
                    mc.player.pos,
                    mc.player.velocity,
                    mc.player.boundingBox,
                    mc.player.yaw,
                    mc.player.pitch,
                    mc.player.isSprinting(),
                    mc.player.fallDistance,
                    0, // jumpingCooldown
                    false, // isJumping
                    false, // isFallFlying
                    mc.player.onGround,
                    false, // horizontalCollision
                    false, // verticalCollision
                    mc.player.isTouchingWater(),
                    mc.player.isSwimming(),
                    mc.player.isSubmergedInWater(),
                    null, // fluidHeight - not needed for our simulation
                    []    // submergedFluidTag - not needed for our simulation
                );

                // Track path positions
                const pathPositions: Vec3d[] = [simulatedPlayer.pos];
                let totalRisk = 0;
                let blocksCovered = new Set<string>();
                let airTime = 0;

                // Run simulation for several ticks
                for (let tick = 0; tick < simulationDepth; tick++) {
                    // Apply jump if needed
                    if (pathData.jumps[tick % pathData.jumps.length] && simulatedPlayer.onGround) {
                        simulatedPlayer.jump();
                    }

                    // Tick the simulation forward
                    simulatedPlayer.tick();

                    // Record position
                    pathPositions.push(simulatedPlayer.pos);

                    // Track air time
                    if (!simulatedPlayer.onGround) {
                        airTime++;
                    }

                    // Check block beneath player
                    const blockPos = new BlockPos(
                        Math.floor(simulatedPlayer.pos.x),
                        Math.floor(simulatedPlayer.pos.y) - 1,
                        Math.floor(simulatedPlayer.pos.z)
                    );

                    // Skip if block is already gone
                    if (this.blockTracker.isBlockGone(blockPos)) {
                        totalRisk += 10; // Heavy penalty for stepping on missing blocks
                        continue;
                    }

                    // Calculate risk for this position
                    const positionRisk = this.blockTracker.getBlockRisk(blockPos);
                    totalRisk += positionRisk;

                    // Mark block as covered
                    blocksCovered.add(`${blockPos.x},${blockPos.y},${blockPos.z}`);

                    // Check if within arena bounds
                    if (!this.arenaDetector.isInBounds(simulatedPlayer.pos)) {
                        totalRisk += 20; // Heavy penalty for going out of bounds
                        break;
                    }
                }

                // Score the path based on various factors
                let pathScore = 0;

                // Reward paths with lower risk
                pathScore += 100 - (totalRisk * 5);

                // Reward paths that cover more unique blocks
                pathScore += blocksCovered.size * 2;

                // Reward paths with more air time (when in aggressive mode)
                if (this.behaviorMode === 'aggressive') {
                    pathScore += airTime * 0.5;
                }

                // Reward paths that stay in the arena (safety factor)
                const finalPos = pathPositions[pathPositions.length - 1];
                if (this.arenaDetector.isInBounds(finalPos, 2.0)) {
                    pathScore += 20;
                }

                // Adjust score based on behavior mode
                switch (this.behaviorMode) {
                    case 'conservative':
                        pathScore *= (100 - totalRisk) / 100; // Scale down score based on risk
                        break;
                    case 'aggressive':
                        pathScore *= 1.2; // Boost scores in aggressive mode
                        break;
                    case 'survival':
                        pathScore = 100 - totalRisk; // In survival, only care about risk
                        break;
                }

                // Add to scored paths
                scoredPaths.push({
                    path: pathPositions,
                    score: pathScore
                });
            } catch (e) {
                // Skip failed simulations
                Client.displayChatMessage(`§c[TNTRunBot] Simulation error: ${e}`);
            }
        }

        return scoredPaths;
    }

    // Update behavior mode based on game conditions
    private updateBehaviorMode(): void {
        if (!mc.player || !mc.world) return;

        // Count safe blocks around player
        let safeBlockCount = 0;
        const scanRadius = 10;

        const playerX = Math.floor(mc.player.pos.x);
        const playerY = Math.floor(mc.player.pos.y) - 1;
        const playerZ = Math.floor(mc.player.pos.z);

        for (let x = playerX - scanRadius; x <= playerX + scanRadius; x++) {
            for (let z = playerZ - scanRadius; z <= playerZ + scanRadius; z++) {
                const blockPos = new BlockPos(x, playerY, z);
                if (!this.blockTracker.isBlockGone(blockPos)) {
                    safeBlockCount++;
                }
            }
        }

        // Count nearby players
        let nearbyPlayerCount = 0;
        if (mc.world && mc.world.players) {
            for (const player of mc.world.players) {
                if (player === mc.player as unknown) continue;
                const dx = player.pos.x - mc.player.pos.x;
                const dz = player.pos.z - mc.player.pos.z;
                const distSq = dx * dx + dz * dz;

                if (distSq < 25) { // Within 5 blocks
                    nearbyPlayerCount++;
                }
            }
        }

        // Determine behavior mode based on conditions
        if (safeBlockCount < 20) {
            this.behaviorMode = 'survival';
        } else if (nearbyPlayerCount > 3) {
            this.behaviorMode = 'aggressive'; // Try to escape crowded areas
        } else if (safeBlockCount > 100) {
            this.behaviorMode = 'balanced'; // Default when plenty of blocks
        } else {
            this.behaviorMode = 'conservative'; // Be careful when blocks are getting sparse
        }
    }

    // Get the current best path
    getCurrentPath(): Vec3d[] {
        return this.currentPath;
    }

    // Get the current behavior mode
    getBehaviorMode(): string {
        return this.behaviorMode;
    }
}

// Movement executor to control player movement
class MovementExecutor {
    private currentPath: Vec3d[] = [];
    private pathIndex: number = 0;
    private lastJumpTime: number = 0;
    private blockTracker: BlockTracker;
    private pathPlanner: PathPlanner;

    constructor(blockTracker: BlockTracker, pathPlanner: PathPlanner) {
        this.blockTracker = blockTracker;
        this.pathPlanner = pathPlanner;
    }

    // Update the current path
    updatePath(newPath: Vec3d[]): void {
        this.currentPath = newPath;
        this.pathIndex = 0;
    }

    // Process movement input event
    handleMovementInput(event: MovementInputEvent): void {
        if (!mc.player || this.currentPath.length === 0) return;

        // Get current target position from path
        const targetPos = this.getCurrentTargetPosition();
        if (!targetPos) return;

        // Calculate direction to target
        const dx = targetPos.x - mc.player.pos.x;
        const dz = targetPos.z - mc.player.pos.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        // If close enough to current target, advance to next position
        if (distance < 0.5) {
            this.pathIndex = Math.min(this.pathIndex + 1, this.currentPath.length - 1);
        }

        // Calculate movement input
        const forward = dx > 0;
        const backward = dx < 0;
        const right = dz > 0;
        const left = dz < 0;

        // Check block beneath player for emergency jump
        const playerPos = new BlockPos(
            Math.floor(mc.player.pos.x),
            Math.floor(mc.player.pos.y) - 1,
            Math.floor(mc.player.pos.z)
        );

        // Determine if we should jump
        const shouldJump = this.shouldJump(playerPos);

        // Update movement inputs
        event.directionalInput = new DirectionalInput(forward, backward, left, right);
        event.jump = shouldJump;
        event.sneak = false; // We don't need sneaking in TNT Run
    }

    // Get current target position from path
    private getCurrentTargetPosition(): Vec3d | null {
        if (this.currentPath.length === 0) return null;

        // Keep index in bounds
        this.pathIndex = Math.min(this.pathIndex, this.currentPath.length - 1);

        return this.currentPath[this.pathIndex];
    }

    // Determine if the player should jump
    private shouldJump(blockPos: BlockPos): boolean {
        if (!mc.player || !mc.world) return false;

        const currentTime = mc.world?.getTime();

        // Don't jump too frequently
        if (currentTime - this.lastJumpTime < 10) return false;

        // If not on ground, don't jump
        if (!mc.player.onGround) return false;

        // Emergency jump if current block has high risk
        const blockRisk = this.blockTracker.getBlockRisk(blockPos);
        if (blockRisk > 0.7) {
            this.lastJumpTime = currentTime;
            return true;
        }

        // Jump if the simulation suggests jumping here
        // Get the current behavior mode from path planner
        const behaviorMode = this.pathPlanner.getBehaviorMode();

        // Adjust jump probability based on behavior mode
        let jumpProbability = 0.2; // Default

        switch (behaviorMode) {
            case 'conservative':
                jumpProbability = 0.15;
                break;
            case 'balanced':
                jumpProbability = 0.25;
                break;
            case 'aggressive':
                jumpProbability = 0.4;
                break;
            case 'survival':
                jumpProbability = 0.5; // Jump more in survival mode
                break;
        }

        // Random jumping with probability
        if (Math.random() < jumpProbability) {
            this.lastJumpTime = currentTime;
            return true;
        }

        return false;
    }

    // Track blocks that the player steps on
    trackPlayerBlocks(): void {
        if (!mc.player) return;

        // Track the block beneath the player
        const blockPos = new BlockPos(
            Math.floor(mc.player.pos.x),
            Math.floor(mc.player.pos.y) - 1,
            Math.floor(mc.player.pos.z)
        );

        this.blockTracker.trackPlayerBlock(blockPos);
    }
}

// Main TNT Run bot module
script.registerModule({
    name: "TNTRunBot",
    description: "Automatically plays TNT Run minigame with advanced simulation",
    category: "Fun",
    settings: {
        jumpProbability: Setting.float({
            name: "JumpProbability",
            default: 0.3,
            range: [0, 1.0],
            suffix: "%"
        }),

        randomMovement: Setting.boolean({
            name: "RandomMovement",
            default: true
        }),

        avoidPlayers: Setting.boolean({
            name: "AvoidPlayers",
            default: true
        }),

        avoidDistance: Setting.float({
            name: "AvoidDistance",
            default: 3.0,
            range: [1.0, 10.0],
            suffix: "blocks"
        }),

        predictiveJumping: Setting.boolean({
            name: "PredictiveJumping",
            default: true
        }),

        debug: Setting.boolean({
            name: "DebugInfo",
            default: false
        })
    }
}, (mod) => {
    // Class instances
    const blockTracker = new BlockTracker();
    const arenaDetector = new ArenaDetector();
    const pathPlanner = new PathPlanner(blockTracker, arenaDetector);
    const movementExecutor = new MovementExecutor(blockTracker, pathPlanner);

    // State variables
    let tickCounter = 0;
    let planUpdateCounter = 0;

    // Listen for block changes
    const handleBlockChange = (x: number, y: number, z: number, blockState: any) => {
        // If block changed to air, track it
        if (blockState && BlockUtil.getBlock(new BlockPos(x, y, z)) === Blocks.AIR) {
            blockTracker.trackBlock(new BlockPos(x, y, z));
        }
    };

    // Module event handlers
    mod.on("enable", () => {
        if (!mc.player) {
            Client.displayChatMessage("§c[TNTRunBot] Player not found. Please join a game first.");
            mod.disable()
            return;
        }

        Client.displayChatMessage("§a[TNTRunBot] Enabled! Advanced TNT Run bot is now active.");

        // Initialize arena detection
        arenaDetector.detectArenaBoundaries();

        // Reset counters
        tickCounter = 0;
        planUpdateCounter = 0;
    });

    mod.on("disable", () => {
        Client.displayChatMessage("§c[TNTRunBot] Disabled.");
    });

    mod.on("gametick", () => {
        if (!mc.player || !mc.world) return;

        tickCounter++;
        planUpdateCounter++;

        // Clean up old tracked blocks every 100 ticks
        if (tickCounter % 100 === 0) {
            blockTracker.clearOldBlocks(5000); // Clear blocks older than 5 seconds
        }

        // Re-detect arena boundaries occasionally
        if (tickCounter % 200 === 0) {
            arenaDetector.detectArenaBoundaries();
        }

        // Track blocks the player steps on
        movementExecutor.trackPlayerBlocks();

        // Update path planning regularly
        if (planUpdateCounter >= 10) { // Update path every 10 ticks
            pathPlanner.updatePath();
            movementExecutor.updatePath(pathPlanner.getCurrentPath());
            planUpdateCounter = 0;

            // Debug info
            if (mod.settings.debug.getValue()) {
                const behaviorMode = pathPlanner.getBehaviorMode();
                Client.displayChatMessage(`§b[TNTRunBot] Behavior mode: §a${behaviorMode}`);
            }
        }
    });

    mod.on('movementinput', (event) => {
        if (mod.enabled) {
            // Let movement executor handle the input event
            movementExecutor.handleMovementInput(event);
        }
    });

    // We need to monitor block changes by hooking into the appropriate event
    mod.on("blockchange", (event) => {
        if (mod.enabled && event) {
            handleBlockChange(event.blockPos.x, event.blockPos.y, event.blockPos.z, event.newState);
        }
    });

    const box = new Box(-0.1, -0.1, -0.1, 0.1, 0.1, 0.1)

    mod.on("worldrender", (event) => {
        if (!mc.player) return;

        // Render path
        if (mod.settings.renderPath.getValue()) {
            const path = pathPlanner.getCurrentPath();

            // Render each point in the path
            for (let i = 0; i < path.length; i++) {
                const pos = path[i];

                // Calculate color (green to red based on position in path)
                const progress = i / Math.max(1, path.length - 1);
                const red = Math.min(1.0, progress * 2);
                const green = Math.max(0, 1 - progress);

                // @ts-expect-error
                RenderShortcutsKt.renderEnvironmentForGUI(event.matrixStack, (env: WorldRenderEnvironment) => {
                    // @ts-expect-error
                    BoxRenderer.Companion.drawWith(env, (boxRender: BoxRenderer) => {
                        // @ts-expect-error
                        RenderShortcutsKt.withPositionRelativeToCamera(env, pos, (env_: WorldRenderEnvironment) => {
                            boxRender.drawBox(
                                box,
                                new Color4b(red * 255, green * 255, 255, 255),
                                new Color4b(red * 255, green * 255, 255, 150),
                                -1, -1
                            );
                        });
                    });
                });
            }
        }
    });

    // Register command to toggle debug mode
    script.registerCommand({
        name: "tntdebug",
        aliases: ["tntinfo"],
        onExecute() {
            mod.settings.debug.setValue(!mod.settings.debug.getValue());
            Client.displayChatMessage(`§b[TNTRunBot] Debug mode: ${mod.settings.debug.getValue() ? "§aON" : "§cOFF"}`);
        }
    });
});
