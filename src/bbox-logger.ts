import { File } from "jvm-types/java/io/File";
import { FileOutputStream } from "jvm-types/java/io/FileOutputStream";
import { OutputStreamWriter } from "jvm-types/java/io/OutputStreamWriter";
import { BufferedWriter } from "jvm-types/java/io/BufferedWriter";
import { Box } from "jvm-types/net/minecraft/util/math/Box";
import { BlockPos } from "jvm-types/net/minecraft/util/math/BlockPos";
import { World } from "jvm-types/net/minecraft/world/World";
import { GameTickEvent } from "jvm-types/net/ccbluex/liquidbounce/event/events/GameTickEvent";
import { EntityPose } from "jvm-types/net/minecraft/entity/EntityPose"; // Import EntityPose
import { ProcessBuilder } from "jvm-types/java/lang/ProcessBuilder";
import { Process } from "jvm-types/java/lang/Process";
import { OutputStream } from "jvm-types/java/io/OutputStream";

const script = registerScript.apply({
    name: "boundingbox-logger",
    version: "1.0.0",
    authors: ["Roo"]
});

let logWriter: BufferedWriter | null = null;
let zstdProcess: Process | null = null; // To hold the zstd process

script.registerModule({
    name: "BoundingBoxLogger",
    description: "Logs player and block bounding boxes every tick.",
    category: "Misc",
    settings: {}
}, (mod) => {
    mod.on("enable", () => {
        try {
            const logFileName = "bbox_log.zst"; // ZSTD compressed file
            const processBuilder = new ProcessBuilder(["zstd", "-o", logFileName]);
            zstdProcess = processBuilder.start();
            const outputStream = zstdProcess.getOutputStream();
            // @ts-expect-error
            logWriter = new BufferedWriter(new OutputStreamWriter(outputStream));
            Client.displayChatMessage(`BoundingBoxLogger enabled. Logging to ${logFileName}`);
        } catch (e) {
            Client.displayChatMessage(`[BoundingBoxLogger] Failed to start zstd process or open log file: ${e}`);
            logWriter = null;
            zstdProcess = null;
        }
    });

    mod.on("disable", () => {
        if (logWriter) {
            try {
                logWriter.close(); // Close the writer, which closes the OutputStream to zstd's stdin
                Client.displayChatMessage("BoundingBoxLogger disabled. Waiting for zstd to finish compression...");
                if (zstdProcess) {
                    const exitCode = zstdProcess.waitFor(); // Wait for zstd process to complete
                    Client.displayChatMessage(`zstd process exited with code: ${exitCode}`);
                }
                Client.displayChatMessage("Log file closed and compressed.");
            } catch (e) {
                Client.displayChatMessage(`[BoundingBoxLogger] Failed to close log file or wait for zstd: ${e}`);
            }
            logWriter = null;
            zstdProcess = null;
        }
    });

    mod.on("gametick", (event: GameTickEvent) => {
        if (!logWriter || !mc.player || !mc.world) {
            return;
        }

        try {
            const playerBox = mc.player.getBoundingBox(EntityPose.STANDING); // Pass EntityPose.STANDING
            const playerPos = mc.player.getBlockPos();

            const logEntry: any = {
                tick: mc.player.age,
                player: {
                    x: mc.player.getX(),
                    y: mc.player.getY(),
                    z: mc.player.getZ(),
                    bbox: {
                        minX: playerBox.minX,
                        minY: playerBox.minY,
                        minZ: playerBox.minZ,
                        maxX: playerBox.maxX,
                        maxY: playerBox.maxY,
                        maxZ: playerBox.maxZ
                    }
                },
                blocks: []
            };

            // Log blocks around the player (5x5 area)
            const range = 8; // 2 blocks in each direction from player's block pos
            for (let x = -range; x <= range; x++) {
                for (let y = -range; y <= range; y++) {
                    for (let z = -range; z <= range; z++) {
                        const blockPos = new BlockPos(playerPos.getX() + x, playerPos.getY() + y, playerPos.getZ() + z);
                        const blockState = mc.world.getBlockState(blockPos);
                        if (blockState && !blockState.isAir()) {
                            // @ts-expect-error
                            const blockBox = blockState.getOutlineShape(mc.world, blockPos).getBoundingBox();
                            logEntry.blocks.push({
                                x: blockPos.getX(),
                                y: blockPos.getY(),
                                z: blockPos.getZ(),
                                name: blockState.getBlock().getName().getString(), // Get block name
                                bbox: {
                                    minX: blockBox.minX + blockPos.getX(),
                                    minY: blockBox.minY + blockPos.getY(),
                                    minZ: blockBox.minZ + blockPos.getZ(),
                                    maxX: blockBox.maxX + blockPos.getX(),
                                    maxY: blockBox.maxY + blockPos.getY(),
                                    maxZ: blockBox.maxZ + blockPos.getZ()
                                }
                            });
                        }
                    }
                }
            }

            // @ts-expect-error
            logWriter.write(JSON.stringify(logEntry));
            logWriter.newLine();
        } catch (e) {
            Client.displayChatMessage(`[BoundingBoxLogger] Error writing to log: ${e}`);
        }
    });
});