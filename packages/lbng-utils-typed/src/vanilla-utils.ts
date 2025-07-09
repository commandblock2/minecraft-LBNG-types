declare const Client: any; // To satisfy linter for global Client object

import { Vec3d } from "jvm-types/net/minecraft/util/math/Vec3d";
import { MinecraftClient } from "jvm-types/net/minecraft/client/MinecraftClient";
import { PlayerMoveC2SPacket } from "jvm-types/net/minecraft/network/packet/c2s/play/PlayerMoveC2SPacket";
import { PlayerMoveC2SPacket$PositionAndOnGround } from "jvm-types/net/minecraft/network/packet/c2s/play/PlayerMoveC2SPacket$PositionAndOnGround";
import { PlayerActionC2SPacket } from "jvm-types/net/minecraft/network/packet/c2s/play/PlayerActionC2SPacket";
import { PlayerInteractBlockC2SPacket } from "jvm-types/net/minecraft/network/packet/c2s/play/PlayerInteractBlockC2SPacket";
import { Direction } from "jvm-types/net/minecraft/util/math/Direction";
import { Hand } from "jvm-types/net/minecraft/util/Hand";
import { BlockPos } from "jvm-types/net/minecraft/util/math/BlockPos";
import { ClientPlayerInteractionManager } from "jvm-types/net/minecraft/client/network/ClientPlayerInteractionManager";
import { ClientWorld } from "jvm-types/net/minecraft/client/world/ClientWorld";
import { BlockHitResult } from "jvm-types/net/minecraft/util/hit/BlockHitResult";

export function teleportTraversePre120(posList: Array<Vec3d>) {
    for (const pos of posList) {
        mc.player?.networkHandler.sendPacket(new PlayerMoveC2SPacket$PositionAndOnGround(pos.x, pos.y, pos.z, true, false));
    }
}

export function interactPlaceMidAir(pos: Vec3d) {
    const blockPos = new BlockPos(pos.x, pos.y, pos.z);
    const hitResult = new BlockHitResult(
        pos, // hit position
        Direction.UP, // side of the block hit (e.g., placing on top)
        blockPos, // block position
        false // insideBlock
    );
    // @ts-expect-error - The type definition for ClientPlayerInteractionManager.sendSequencedPacket expects a specific Packet type, but the lambda returns a generic Packet.
    mc.interactionManager.sendSequencedPacket(mc.world, (sequence: number) => {
        return new PlayerInteractBlockC2SPacket(
            Hand.MAIN_HAND,
            hitResult,
            sequence
        );
    });
}