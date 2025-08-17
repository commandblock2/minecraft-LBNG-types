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

    type Verb = { type: string, arg?: number | string };

    function sampleVerbSequence(difficulty: string, maxLen: number): Verb[] {
        const seq: Verb[] = [];
        const maxGap = difficulty === "Hard" ? 3 : (difficulty === "Medium" ? 2 : 1);
        const turnProb = difficulty === "Hard" ? 0.25 : (difficulty === "Medium" ? 0.16 : 0.08);
        const gapProb = difficulty === "Hard" ? 0.22 : (difficulty === "Medium" ? 0.14 : 0.06);
        const climbProb = difficulty === "Hard" ? 0.16 : (difficulty === "Medium" ? 0.10 : 0.04);

        let remaining = maxLen;
        while (remaining > 0) {
            // prefer WALK segments
            if (Math.random() < gapProb && remaining > 1) {
                const g = 1 + Math.floor(Math.random() * (maxGap)); // 1..maxGap
                seq.push({ type: "GAP", arg: g });
                remaining -= 1;
                continue;
            }

            if (Math.random() < turnProb) {
                seq.push({ type: "TURN", arg: Math.random() < 0.5 ? "LEFT" : "RIGHT" });
                remaining--;
                continue;
            }

            if (Math.random() < climbProb && remaining > 1) {
                const n = 1 + Math.floor(Math.random() * Math.min(3, remaining));
                seq.push({ type: "CLIMB", arg: n });
                remaining--;
                continue;
            }

            // default WALK small
            const w = 1 + Math.floor(Math.random() * Math.min(4, remaining));
            seq.push({ type: "WALK", arg: w });
            remaining -= 1;
        }
        return seq;
    }

    function renderVerbSequence(seq: Verb[], startPos: BlockPos, facing: Direction, serverWorld: ServerWorld, pathBlockState: any) {
        let curX = startPos.getX();
        let curY = startPos.getY();
        let curZ = startPos.getZ();
        let dir = facing;
        const base = stepFor(dir);
        const pathPositions: BlockPos[] = [];

        // move one forward to avoid overwriting player's block
        curX += base.dx;
        curZ += base.dz;

        for (const verb of seq) {
            if (verb.type === "WALK") {
                const n = Number(verb.arg || 1);
                for (let i = 0; i < n; i++) {
                    curX += stepFor(dir).dx;
                    curZ += stepFor(dir).dz;
                    const pos = new BlockPos(curX, curY, curZ);
                    serverWorld.setBlockState(pos, pathBlockState);
                    pathPositions.push(pos);
                }
            } else if (verb.type === "GAP") {
                const n = Number(verb.arg || 1);
                // advance forward n steps without placing blocks
                for (let i = 0; i < n; i++) {
                    curX += stepFor(dir).dx;
                    curZ += stepFor(dir).dz;
                }
                // place landing block one forward
                curX += stepFor(dir).dx;
                curZ += stepFor(dir).dz;
                const pos = new BlockPos(curX, curY, curZ);
                serverWorld.setBlockState(pos, pathBlockState);
                pathPositions.push(pos);
            } else if (verb.type === "TURN") {
                const side = String(verb.arg || "LEFT");
                // update dir
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
            } else if (verb.type === "CLIMB") {
                const n = Number(verb.arg || 1);
                for (let i = 0; i < n; i++) {
                    // step up by one: place block at next forward and up
                    curX += stepFor(dir).dx;
                    curZ += stepFor(dir).dz;
                    curY += 1;
                    const pos = new BlockPos(curX, curY, curZ);
                    serverWorld.setBlockState(pos, pathBlockState);
                    pathPositions.push(pos);
                }
            }
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
                        if (tx === startX && ty === startY && tz === startZ) continue;
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
            const pathPositions = renderVerbSequence(verbSeq, playerPos, facing, serverWorld, pathState);

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