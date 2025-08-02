import { Direction } from "jvm-types/net/minecraft/util/math/Direction";
import { Direction$Axis } from "jvm-types/net/minecraft/util/math/Direction$Axis";
import { BlockPos } from "jvm-types/net/minecraft/util/math/BlockPos";
import { ServerWorld } from "jvm-types/net/minecraft/server/world/ServerWorld";
import { Blocks } from "jvm-types/net/minecraft/block/Blocks";

const script = registerScript.apply({
    name: "wall-builder-integrated-world",
    version: "1.0.0",
    authors: ["Roo"]
});

script.registerModule({
    name: "WallBuilderSinglePlayer",
    description: "Places a wall of blocks in front of the player on enable. Only works in single player, which is intended to show that data generation can be done.",
    category: "World",
    settings: {
        wallWidth: Setting.int({
            name: "WallWidth",
            default: 3,
            range: [1, 10],
            suffix: "blocks"
        }),
        wallHeight: Setting.int({
            name: "WallHeight",
            default: 3,
            range: [1, 10],
            suffix: "blocks"
        }),
        distance: Setting.int({
            name: "Distance",
            default: 2,
            range: [1, 10],
            suffix: "blocks"
        }),
        blockType: Setting.choose({
            name: "BlockType",
            default: "Stone",
            choices: ["Stone", "Cobblestone", "Dirt", "Oak_Planks", "Glass"]
        })
    }
}, (mod) => {
    mod.on("enable", () => {
        const serverInstance = mc.getServer();
        if (!serverInstance) {
            Client.displayChatMessage("§cError: Integrated server not running.");
            return;
        }

        const serverWorld: ServerWorld = serverInstance.getOverworld();
        if (!serverWorld) {
            Client.displayChatMessage("§cError: Server world not found.");
            return;
        }

        if (!mc.player) {
            Client.displayChatMessage("§cError: Player not found.");
            return;
        }
        const playerPos: BlockPos = mc.player.getBlockPos();
        const playerFacing: Direction = mc.player.getHorizontalFacing();

        const wallWidth = mod.settings.wallWidth.getValue();
        const wallHeight = mod.settings.wallHeight.getValue();
        const distance = mod.settings.distance.getValue();
        const blockTypeName = mod.settings.blockType.getValue();

        let blockToPlace;
        switch (blockTypeName) {
            case "Stone":
                blockToPlace = Blocks.STONE;
                break;
            case "Cobblestone":
                blockToPlace = Blocks.COBBLESTONE;
                break;
            case "Dirt":
                blockToPlace = Blocks.DIRT;
                break;
            case "Oak_Planks":
                blockToPlace = Blocks.OAK_PLANKS;
                break;
            case "Glass":
                blockToPlace = Blocks.GLASS;
                break;
            default:
                blockToPlace = Blocks.STONE; // Default to stone if unknown
                break;
        }

        const blockState = blockToPlace.getDefaultState();

        let startX = playerPos.getX();
        let startY = playerPos.getY();
        let startZ = playerPos.getZ();

        // Adjust starting position based on player facing and distance
        if (playerFacing === Direction.NORTH) {
            startZ -= distance + wallWidth - 1; // Wall extends away from player
            startX -= Math.floor(wallWidth / 2); // Center the wall
        } else if (playerFacing === Direction.SOUTH) {
            startZ += distance;
            startX -= Math.floor(wallWidth / 2);
        } else if (playerFacing === Direction.EAST) {
            startX += distance;
            startZ -= Math.floor(wallWidth / 2);
        } else if (playerFacing === Direction.WEST) {
            startX -= distance + wallWidth - 1;
            startZ -= Math.floor(wallWidth / 2);
        }

        for (let y = 0; y < wallHeight; y++) {
            for (let x = 0; x < wallWidth; x++) {
                let targetX = startX;
                let targetZ = startZ;

                // Adjust for wall orientation based on facing direction
                if (playerFacing.getAxis() === Direction$Axis.Z) { // North/South
                    targetX += x;
                } else { // East/West
                    targetZ += x;
                }

                const targetPos = new BlockPos(targetX, startY + y, targetZ);
                serverWorld.setBlockState(targetPos, blockState);
            }
        }
        Client.displayChatMessage(`§aWall of ${blockTypeName} placed!`);
    });

    mod.on("disable", () => {
        Client.displayChatMessage("§cWallBuilder disabled.");
    });
});