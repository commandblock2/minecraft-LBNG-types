import { BlockPos } from "jvm-types/net/minecraft/util/math/BlockPos";
import { ServerWorld } from "jvm-types/net/minecraft/server/world/ServerWorld";
import { Blocks } from "jvm-types/net/minecraft/block/Blocks";
import { Direction } from "jvm-types/net/minecraft/util/math/Direction";
import { BaritoneAPI } from "jvm-types/baritone/api/BaritoneAPI";
import { GoalBlock } from "jvm-types/baritone/api/pathing/goals/GoalBlock";
// @ts-expect-error
const CommandManager = require("jvm-types/net/ccbluex/liquidbounce/features/command/CommandManager").CommandManager;
import { Thread } from "jvm-types/java/lang/Thread";
import { LiquidBounce } from "jvm-types/net/ccbluex/liquidbounce/LiquidBounce";


let shouldReenable = false;

const script = registerScript.apply({
    name: "verb-scenario-generator",
    version: "1.0.0",
    authors: ["Roo"]
});

script.registerModule({
    name: "VerbScenarioGenerator",
    description: "Generates verb-sequence scenarios (WALK,TURN,GAP,CLIMB) and renders them; clears area except the block under player; sets DataCollector goal and enables it.",
    category: "World",
    settings: {
        difficulty: Setting.choose({
            name: "Difficulty",
            default: "Easy",
            choices: ["Easy", "Medium", "Hard"]
        }),
        maxLength: Setting.int({
            name: "MaxVerbSequenceLength",
            default: 12,
            range: [4, 20]
        }),
        clearRadius: Setting.int({
            name: "ClearRadius",
            default: 8,
            range: [3, 32]
        }),
        pathBlock: Setting.choose({
            name: "PathBlock",
            default: "Oak_Planks",
            choices: ["Stone", "Cobblestone", "Oak_Planks", "Dirt", "Glass"]
        }),
        placeTorches: Setting.boolean({
            name: "PlaceTorchesAlongPath",
            default: false
        })
    }
}, (mod) => {

    const datacollector = (() => { 
        for (const element of Client.moduleManager) {
            if (element.name.startsWith("DataCollector"))
                return element;
        }
    })();

    function stepFor(direction: Direction) {
        switch (direction) {
            case Direction.NORTH: return { dx: 0, dz: -1 };
            case Direction.SOUTH: return { dx: 0, dz: 1 };
            case Direction.EAST: return { dx: 1, dz: 0 };
            case Direction.WEST: return { dx: -1, dz: 0 };
            default: return { dx: 0, dz: 1 };
        }
    }

    function choosePathBlock(name: string) {
        switch (name) {
            case "Stone": return Blocks.STONE;
            case "Cobblestone": return Blocks.COBBLESTONE;
            case "Dirt": return Blocks.DIRT;
            case "Glass": return Blocks.GLASS;
            case "Oak_Planks":
            default: return Blocks.OAK_PLANKS;
        }
    }

    enum VerbType {
        WALK = "WALK",
        TURN = "TURN",
        GAP = "GAP",
        CLIMB = "CLIMB",
        TUNNEL = "TUNNEL",         // enclosed corridor (floor + ceiling)
        PLATFORM_2X2 = "PLATFORM_2X2", // 2x2 platform
        AIR_SINGLE = "AIR_SINGLE", // single air-gapped stepping blocks
        SLAB = "SLAB",             // place slabs instead of full blocks
        DIAGONAL = "DIAGONAL"      // diagonal step (NE, NW, SE, SW)
    }
    
    type Verb = { type: VerbType, arg?: any };
    
    const VerbInfo: Record<VerbType, { min?: number, max?: number, description?: string }> = {
        [VerbType.WALK]: { min: 1, max: 8, description: "place consecutive ground blocks" },
        [VerbType.TURN]: { description: "turn LEFT or RIGHT" },
        [VerbType.GAP]: { min: 1, max: 3, description: "leave empty spaces then a landing block" },
        [VerbType.CLIMB]: { min: 1, max: 3, description: "step up by placing blocks higher" },
        [VerbType.TUNNEL]: { min: 2, max: 8, description: "floor with ceiling; creates a tunnel" },
        [VerbType.PLATFORM_2X2]: { min: 1, max: 3, description: "2x2 platform steps" },
        [VerbType.AIR_SINGLE]: { min: 1, max: 6, description: "single air blocks separated by gaps" },
        [VerbType.SLAB]: { min: 1, max: 6, description: "place slabs for low-profile steps" },
        [VerbType.DIAGONAL]: { min: 1, max: 6, description: "diagonal movement (NE, NW, SE, SW)" }
    };
    
    function sampleVerbSequence(difficulty: string, maxLen: number): Verb[] {
        // probabilities influenced by difficulty
        const seq: Verb[] = [];
        const probs = {
            WALK: difficulty === "Hard" ? 0.35 : (difficulty === "Medium" ? 0.45 : 0.6),
            GAP: difficulty === "Hard" ? 0.18 : (difficulty === "Medium" ? 0.10 : 0.06),
            TURN: difficulty === "Hard" ? 0.14 : (difficulty === "Medium" ? 0.12 : 0.08),
            CLIMB: difficulty === "Hard" ? 0.12 : (difficulty === "Medium" ? 0.08 : 0.04),
            TUNNEL: 0.04,
            PLATFORM_2X2: 0.03,
            SLAB: 0.03,
            DIAGONAL: difficulty === "Hard" ? 0.05 : 0.02
        };
    
        // helper to pick a verb by weighted random
        function pickVerb(prev: VerbType): VerbType {
            const items = Object.keys(probs) as (keyof typeof probs)[];
            const total = items.reduce((s, k) => s + probs[k], 0);
            let r = Math.random() * total;
            for (const k of items) {
                r -= probs[k];
                if (r <= 0) { 
                    const verb = VerbType[k as unknown as keyof typeof VerbType];
                    if (verb == VerbType.GAP && verb == prev)
                        return VerbType.WALK;
                    else 
                        return verb;
                };
            }
            return VerbType.WALK;
        }
    
        // Always start with a WALK so Baritone has an immediate walkable start
        const firstWalkLen = 1 + Math.floor(Math.random() * Math.min(3, maxLen));
        seq.push({ type: VerbType.WALK, arg: firstWalkLen });
        let remaining = maxLen - 1;

        let prevVerb = VerbType.GAP;
    
        while (remaining > 0) {
            const picked = pickVerb(prevVerb);
            prevVerb = picked;
            const info = VerbInfo[picked];
            // choose a reasonable argument based on verb metadata and remaining length
            let n = 1;
            if (info.min !== undefined) {
                const maxForVerb = Math.min(info.max || info.min, remaining);
                n = info.min + Math.floor(Math.random() * Math.max(1, maxForVerb - info.min + 1));
            } else {
                n = Math.min(1 + Math.floor(Math.random() * 3), remaining);
            }
    
            switch (picked) {
                case VerbType.WALK:
                    seq.push({ type: VerbType.WALK, arg: n });
                    remaining -= 1;
                    break;
                case VerbType.GAP:
                    seq.push({ type: VerbType.GAP, arg: n });
                    remaining -= 1;
                    break;
                case VerbType.TURN:
                    seq.push({ type: VerbType.TURN, arg: Math.random() < 0.5 ? "LEFT" : "RIGHT" });
                    remaining -= 1;
                    break;
                case VerbType.CLIMB:
                    seq.push({ type: VerbType.CLIMB, arg: n });
                    remaining -= 1;
                    break;
                case VerbType.TUNNEL:
                    seq.push({ type: VerbType.TUNNEL, arg: n });
                    remaining -= 1;
                    break;
                case VerbType.PLATFORM_2X2: {
                    // create platform with possible multiple exits
                    const exits: string[] = [];
                    if (Math.random() < 0.85) exits.push("STRAIGHT");
                    if (Math.random() < 0.35) exits.push("LEFT");
                    if (Math.random() < 0.35) exits.push("RIGHT");
                    // occasionally add a diagonal exit
                    if (Math.random() < 0.12) exits.push(Math.random() < 0.5 ? "NE" : "NW");
                    if (exits.length === 0) exits.push("STRAIGHT");
                    seq.push({ type: VerbType.PLATFORM_2X2, arg: { length: n, exits } });
                    remaining -= 1;
                    break;
                }
                case VerbType.AIR_SINGLE:
                    seq.push({ type: VerbType.AIR_SINGLE, arg: n });
                    remaining -= 1;
                    break;
                case VerbType.SLAB:
                    seq.push({ type: VerbType.SLAB, arg: n });
                    remaining -= 1;
                    break;
                case VerbType.DIAGONAL:
                    // choose diagonal direction relative to facing
                    const diagonals = ["NE", "NW", "SE", "SW"];
                    seq.push({ type: VerbType.DIAGONAL, arg: { steps: n, dir: diagonals[Math.floor(Math.random() * diagonals.length)] } });
                    remaining -= 1;
                    break;
                default:
                    seq.push({ type: VerbType.WALK, arg: 1 });
                    remaining -= 1;
                    break;
            }
        }
    
        return seq;
    }
    
    // Helper: step for diagonal direction
    function stepForDiagonal(dirLabel: string) {
        switch (dirLabel) {
            case "NE": return { dx: 1, dz: -1 };
            case "NW": return { dx: -1, dz: -1 };
            case "SE": return { dx: 1, dz: 1 };
            case "SW": return { dx: -1, dz: 1 };
            default: return { dx: 0, dz: 1 };
        }
    }
    
    function renderVerbSequence(seq: Verb[], startPos: BlockPos, facing: Direction, serverWorld: ServerWorld, pathBlockState: any) {
        let curX = startPos.getX();
        let curY = startPos.getY();
        let curZ = startPos.getZ();
        let dir = facing;
        const base = stepFor(dir);
        const pathPositions: BlockPos[] = [];
    
        // move one forward to avoid overwriting player's block -- keep small safe step
        curX += base.dx;
        curZ += base.dz;
    
        for (const verb of seq) {
            switch (verb.type) {
                case VerbType.WALK: {
                    const n = Number(verb.arg || 1);
                    for (let i = 0; i < n; i++) {
                        curX += stepFor(dir).dx;
                        curZ += stepFor(dir).dz;
                        const pos = new BlockPos(curX, curY, curZ);
                        serverWorld.setBlockState(pos, pathBlockState);
                        pathPositions.push(pos);
                    }
                    break;
                }
    
                case VerbType.GAP: {
                    const n = Number(verb.arg || 1);
                    for (let i = 0; i < n; i++) {
                        curX += stepFor(dir).dx;
                        curZ += stepFor(dir).dz;
                    }
                    // landing block
                    curX += stepFor(dir).dx;
                    curZ += stepFor(dir).dz;
                    const pos = new BlockPos(curX, curY, curZ);
                    serverWorld.setBlockState(pos, pathBlockState);
                    pathPositions.push(pos);
                    break;
                }
    
                case VerbType.TURN: {
                    const side = String(verb.arg || "LEFT");
                    if (side === "LEFT") {
                        if (dir === Direction.NORTH) dir = Direction.WEST;
                        else if (dir === Direction.WEST) dir = Direction.SOUTH;
                        else if (dir === Direction.SOUTH) dir = Direction.EAST;
                        else dir = Direction.NORTH;
                    } else {
                        if (dir === Direction.NORTH) dir = Direction.EAST;
                        else if (dir === Direction.EAST) dir = Direction.SOUTH;
                        else if (dir === Direction.SOUTH) dir = Direction.WEST;
                        else dir = Direction.NORTH;
                    }
                    break;
                }
    
                case VerbType.CLIMB: {
                    const n = Number(verb.arg || 1);
                    for (let i = 0; i < n; i++) {
                        curX += stepFor(dir).dx;
                        curZ += stepFor(dir).dz;
                        curY += 1;
                        const pos = new BlockPos(curX, curY, curZ);
                        serverWorld.setBlockState(pos, pathBlockState);
                        pathPositions.push(pos);
                    }
                    break;
                }
    
                case VerbType.TUNNEL: {
                    // create floor and ceiling while leaving 1-block headroom
                    const n = Number(verb.arg || 2);
                    for (let i = 0; i < n; i++) {
                        curX += stepFor(dir).dx;
                        curZ += stepFor(dir).dz;
                        // floor
                        const floor = new BlockPos(curX, curY, curZ);
                        serverWorld.setBlockState(floor, pathBlockState);
                        pathPositions.push(floor);
                        // ceiling two blocks above floor (y+2) to form tunnel
                        const ceiling = new BlockPos(curX, curY + 3, curZ);
                        serverWorld.setBlockState(ceiling, pathBlockState);
                    }
                    break;
                }
    
                case VerbType.PLATFORM_2X2: {
                    const n = Number(verb.arg || 1);
                    for (let i = 0; i < n; i++) {
                        // place a 2x2 square centered on current forward step
                        curX += stepFor(dir).dx;
                        curZ += stepFor(dir).dz;
                        for (let sx = 0; sx <= 1; sx++) {
                            for (let sz = 0; sz <= 1; sz++) {
                                const ox = curX + (dir === Direction.EAST ? sx : dir === Direction.WEST ? -sx : sx - 1);
                                const oz = curZ + (dir === Direction.SOUTH ? sz : dir === Direction.NORTH ? -sz : sz - 1);
                                const p = new BlockPos(ox, curY, oz);
                                serverWorld.setBlockState(p, pathBlockState);
                                pathPositions.push(p);
                            }
                        }
                    }
                    break;
                }
    
                case VerbType.AIR_SINGLE: {
                    const n = Number(verb.arg || 1);
                    for (let i = 0; i < n; i++) {
                        // place a single block, then advance with a gap of one
                        curX += stepFor(dir).dx;
                        curZ += stepFor(dir).dz;
                        const p = new BlockPos(curX, curY, curZ);
                        serverWorld.setBlockState(p, pathBlockState);
                        pathPositions.push(p);
                        // gap
                        curX += stepFor(dir).dx;
                        curZ += stepFor(dir).dz;
                    }
                    break;
                }
    
                case VerbType.SLAB: {
                    // attempt to place slab block if available; fall back to full block
                    const n = Number(verb.arg || 1);
                    const slabBlock = (Blocks.OAK_SLAB) ? Blocks.OAK_SLAB.getDefaultState() : pathBlockState;
                    for (let i = 0; i < n; i++) {
                        curX += stepFor(dir).dx;
                        curZ += stepFor(dir).dz;
                        const p = new BlockPos(curX, curY, curZ);
                        serverWorld.setBlockState(p, slabBlock);
                        pathPositions.push(p);
                    }
                    break;
                }
    
                case VerbType.DIAGONAL: {
                    const info = verb.arg || { steps: 1, dir: "NE" };
                    const steps = Number(info.steps || 1);
                    const dlabel = String(info.dir || "NE");
                    for (let i = 0; i < steps; i++) {
                        const step = stepForDiagonal(dlabel);
                        curX += step.dx;
                        curZ += step.dz;
                        const p = new BlockPos(curX, curY, curZ);
                        serverWorld.setBlockState(p, pathBlockState);
                        pathPositions.push(p);
                    }
                    break;
                }
    
                default: {
                    // unknown => safe WALK
                    curX += stepFor(dir).dx;
                    curZ += stepFor(dir).dz;
                    const p = new BlockPos(curX, curY, curZ);
                    serverWorld.setBlockState(p, pathBlockState);
                    pathPositions.push(p);
                    break;
                }
            }
        }
    return pathPositions;
}

function validateAndFixPath(serverWorld: ServerWorld, pathPositions: BlockPos[], pathBlockState: any): BlockPos[] {
    try {
        for (let i = 0; i < pathPositions.length; i++) {
            const p = pathPositions[i];
            if (!p) continue;

            // ensure a support block exists directly beneath the path block (landing support)
            // previously we placed support blocks beneath every generated path block.
            // That produced unwanted 2-block-high columns when the generator placed a single ground block.
            // Remove automatic support placement here to preserve single-block-high paths.
            // If needed, supports should be added with a separate, careful pass that only fills truly unsupported blocks.

            // fix excessive upward steps between consecutive path positions
            if (i > 0) {
                try {
                    const prev = pathPositions[i - 1];
                    const dy = p.getY() - prev.getY();
                    // if step up is greater than 1 block, fill vertical intermediate blocks
                    if (dy > 1) {
                        for (let y = prev.getY() + 1; y < p.getY(); y++) {
                            try {
                                const fill = new BlockPos(p.getX(), y, p.getZ());
                                serverWorld.setBlockState(fill, pathBlockState);
                            } catch (e) { }
                        }
                    }
                    // if step down is large (fall), fill beneath previous position so descent is gradual
                    if (dy < -1) {
                        for (let y = p.getY(); y < prev.getY() - 1; y++) {
                            try {
                                const fill = new BlockPos(prev.getX(), y, prev.getZ());
                                serverWorld.setBlockState(fill, pathBlockState);
                            } catch (e) { }
                        }
                    }
                } catch (e) { }
            }
        }
    } catch (e) {
        console.error("[VerbScenarioGenerator] validateAndFixPath error:", e);
    }
    return pathPositions;
}


    let baritoneMonitorActive = false;
    let pathStoppedTicks = 0;
    const PATH_STOP_THRESHOLD = 20 * 5; // consecutive ticks with no active path before shutting down

    mod.on("enable", () => {
        try {
            if (!mc.player) {
                Client.displayChatMessage("[VerbScenarioGenerator] Player not available.");
                return;
            }

            const server = mc.getServer();
            if (!server) {
                Client.displayChatMessage("[VerbScenarioGenerator] Integrated server not running.");
                return;
            }

            const serverWorld = server.getOverworld();
            if (!serverWorld) {
                Client.displayChatMessage("[VerbScenarioGenerator] Server world not found.");
                return;
            }

            const playerPos = mc.player.getBlockPos();
            const startX = playerPos.getX();
            const startY = playerPos.getY() - 1;
            const startZ = playerPos.getZ();

            const clearRadius = mod.settings.clearRadius.getValue();
            const air = Blocks.AIR.getDefaultState();
            for (let dx = -clearRadius; dx <= clearRadius; dx++) {
                for (let dy = -clearRadius; dy <= clearRadius; dy++) {
                    for (let dz = -clearRadius; dz <= clearRadius; dz++) {
                        const tx = startX + dx;
                        const ty = startY + dy;
                        const tz = startZ + dz;
                        // preserve the player's foot block, the block below it and the block above it
                        // to avoid clearing the player's standing block or causing them to fall.
                        const foot = playerPos;
                        const belowFoot = new BlockPos(foot.getX(), foot.getY() - 1, foot.getZ());
                        const aboveFoot = new BlockPos(foot.getX(), foot.getY() + 1, foot.getZ());
                        if ((tx === foot.getX() && ty === foot.getY() && tz === foot.getZ())
                            || (tx === belowFoot.getX() && ty === belowFoot.getY() && tz === belowFoot.getZ())
                            || (tx === aboveFoot.getX() && ty === aboveFoot.getY() && tz === aboveFoot.getZ())) continue;
                        const p = new BlockPos(tx, ty, tz);
                        serverWorld.setBlockState(p, air);
                    }
                }
            }

            const difficulty = mod.settings.difficulty.getValue();
            const maxLen = mod.settings.maxLength.getValue();
            const verbSeq = sampleVerbSequence(difficulty, maxLen);

            const blockChoice = mod.settings.pathBlock.getValue();
            const pathBlock = choosePathBlock(blockChoice);
            const pathState = pathBlock.getDefaultState();

            const facing = mc.player.getHorizontalFacing();
            const rawPathPositions = renderVerbSequence(verbSeq, new BlockPos(startX, startY, startZ), facing, serverWorld, pathState);
            const pathPositions = validateAndFixPath(serverWorld, rawPathPositions, pathState);
    
            if (mod.settings.placeTorches.getValue()) {
                for (let i = 0; i < pathPositions.length; i += 5) {
                    const p = pathPositions[i];
                    if (!p) continue;
                    try {
                        const tpos = new BlockPos(p.getX(), p.getY() + 1, p.getZ());
                        if (Blocks.TORCH) serverWorld.setBlockState(tpos, Blocks.TORCH.getDefaultState());
                    } catch (e) { }
                }
            }

            if (pathPositions.length === 0) {
                Client.displayChatMessage("[VerbScenarioGenerator] Generated empty path.");
                return;
            }

            const goal = pathPositions[pathPositions.length - 1].add(0, 1, 0);


            try {
                const commandManager = CommandManager.INSTANCE;
                commandManager.execute(`value set DataCollector GoalX ${goal.getX()}`);
                commandManager.execute(`value set DataCollector GoalY ${goal.getY()}`);
                commandManager.execute(`value set DataCollector GoalZ ${goal.getZ()}`);
                datacollector!.enabled = true;
                // start monitoring Baritone path status
                baritoneMonitorActive = true;
            } catch (e) {
                Client.displayChatMessage(`[VerbScenarioGenerator] Failed to configure DataCollector via Baritone command manager: ${e}`);
            }

            Client.displayChatMessage(`[VerbScenarioGenerator] Verb program: ${JSON.stringify(verbSeq)}`);

        } catch (e) {
            Client.displayChatMessage(`[VerbScenarioGenerator] Error during generation: ${e}`);
            console.error(e);
        }
    });

    // Monitor Baritone path status and auto-disable modules when pathing stops
    mod.on("gametick", () => {
        if (!baritoneMonitorActive) return;
        try {
            const baritone = BaritoneAPI.getProvider().getPrimaryBaritone();
            if (!baritone) return;
            // Try to get current path via PathingBehavior
            // @ts-expect-error
            const currentPath = baritone.getPathingBehavior().getPath().orElseGet(() => null);
            let isPathActive = !!currentPath;
            if (currentPath) {
                try {
                    const positions = currentPath.positions ? currentPath.positions() : null;
                    if (!positions || (positions.length !== undefined && positions.length === 0)) {
                        isPathActive = false;
                    }
                } catch (e) {
                    // ignore reflection errors
                }
            }

            if (!isPathActive) {
                pathStoppedTicks++;
            } else {
                pathStoppedTicks = 0;
            }

            if (pathStoppedTicks >= PATH_STOP_THRESHOLD) {
                pathStoppedTicks = 0;
                try {
                    if (datacollector!.enabled) {
                        datacollector!.enabled = false;
                    }
                    // disable this module
                    mod.enabled = false;
                    baritoneMonitorActive = false;
                    shouldReenable = true;
                } catch (e) {
                    Client.displayChatMessage(`[VerbScenarioGenerator] Failed to auto-disable modules: ${e}`);
                }
            }
        } catch (e) {
            console.error(e);
        }
    });

    mod.on("disable", () => {
        Client.displayChatMessage("VerbScenarioGenerator disabled.");
    });

    // @ts-expect-error
    UnsafeThread.run(() => {
        while (true) {
            while (!shouldReenable)
                Thread.sleep(1000);
            shouldReenable = false;
            mod.enabled = true;
        }
    })
});




export { }