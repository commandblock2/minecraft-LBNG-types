import { TransferOrigin } from "@jvm/types/net/ccbluex/liquidbounce/event/events/TransferOrigin";
import { ClientPlayerInteractionManager } from "@jvm/types/net/minecraft/client/network/ClientPlayerInteractionManager";
import { Entity } from "@jvm/types/net/minecraft/entity/Entity";
import { EntityType } from "@jvm/types/net/minecraft/entity/EntityType";
import { LivingEntity } from "@jvm/types/net/minecraft/entity/LivingEntity";
import { PlayerEntity } from "@jvm/types/net/minecraft/entity/player/PlayerEntity";
import { UseAction } from "@jvm/types/net/minecraft/item/consume/UseAction";
import { PlayerActionC2SPacket } from "@jvm/types/net/minecraft/network/packet/c2s/play/PlayerActionC2SPacket";
import { PlayerActionC2SPacket$Action } from "@jvm/types/net/minecraft/network/packet/c2s/play/PlayerActionC2SPacket$Action";
import { PlayerInteractEntityC2SPacket } from "@jvm/types/net/minecraft/network/packet/c2s/play/PlayerInteractEntityC2SPacket";
import { EntitySpawnS2CPacket } from "@jvm/types/net/minecraft/network/packet/s2c/play/EntitySpawnS2CPacket";
import { PlayerListS2CPacket } from "@jvm/types/net/minecraft/network/packet/s2c/play/PlayerListS2CPacket";

const script = registerScript.apply({
    name: "vanilla-aura",
    version: "1.0.0",
    authors: ["commandblock2"]
});

script.registerModule({
    name: "vanilla-aura",
    description: "intended for combat check disabled server",
    category: "Combat",
    settings: {
        packetLimit: Setting.float({
            name: "packetsPerTick",
            range: [0, 1000],
            default: 4.5
        }),
        hurtTime: Setting.int({
            name: "hurtTime",
            range: [-1, 40],
            default: 2
        }),
        range: Setting.float({
            name: "range",
            range: [0, 20],
            default: 6.25
        }),
        attackOnSpawn: Setting.boolean({
            name: "attackOnSpawn",
            default: true
        })

    }

}, (mod) => {

    var packetThisTick = 0
    var packetsInPreviousTicks: Array<number> = []
    var entityList: Array<LivingEntity> = []

    mod.on("gametick", (event) => {

        const size = 5
        packetsInPreviousTicks.push(packetThisTick)

        if (packetsInPreviousTicks.length <= size)
            return;

        packetsInPreviousTicks = packetsInPreviousTicks.slice(1)
        packetThisTick = 0

        const avg = packetsInPreviousTicks.reduce((a: number, b: number): number => a + b, 0) / size;

        var available = mod.settings.packetLimit.get() - avg


        const originallyAvailable = available
        available -= entityList.length

        entityList.slice(0, originallyAvailable).forEach((entity: LivingEntity): void => {
            mc.getNetworkHandler()?.sendPacket(PlayerInteractEntityC2SPacket.attack(entity as unknown as Entity, false))
        })

        entityList = entityList.slice(originallyAvailable, entityList.length)
        if (entityList.length == 0) {
            const list: Array<LivingEntity> = []
            mc.world.entityList.forEach((entity) => {
                if (entity instanceof LivingEntity)
                    list.push(entity);
            })

            entityList = list.filter((entity) => {
                return entity.hurtTime < mod.settings.hurtTime.get()
            })
                .filter((entity) => {
                    return entity.distanceTo(mc.player as unknown as Entity) < mod.settings.range.get()
                })
                .filter((entity) => {
                    return entity != (mc.player as unknown as LivingEntity)
                })

            if (!mc.player)
                return

            const hand = mc.player?.activeHand

            /*
            Argument of type 'ClientPlayerEntity' is not assignable to parameter of type 'PlayerEntity'.
            Types of property 'isSubmergedInWater' are incompatible.
            Type '() => boolean' is not assignable to type 'boolean'.ts(2345)

            This is might not be solvable, ts thinks that a function is not supposed to have the same name as a property.
            here for the isSubmergedInWater identifier,
            it is a function in ClientPlayerEntity, but a boolean property in PlayerEntity.
            so ts thinks that ClientPlayerEntity does not provide the isSubmergedInWater property, 
            because it was identified as a function.
            
            */
            mc.interactionManager?.interactItem(mc.player as unknown as PlayerEntity, hand)
        }
    })

    mod.on("packet", (event) => {

        if (event.packet instanceof EntitySpawnS2CPacket &&
            mod.settings.attackOnSpawn.getValue()
        ) {
            const x = event.packet.x
            const y = event.packet.y
            const z = event.packet.z

            if ((mc.player?.getPos().distanceTo(new Vec3d(x, y, z)) ?? 20 < 8) 
                && event.packet.entityType == (EntityType.PLAYER as any)
            && event.packet.entityId != mc.player?.getId()) {
                mc.getNetworkHandler()?.sendPacket(
                    new PlayerInteractEntityC2SPacket(
                        event.packet.entityId,
                        mc.player?.isSneaking() ?? false,
                        PlayerInteractEntityC2SPacket.ATTACK
                    ))

                packetThisTick++;
            }
        }

        if (!event.original || event.origin == TransferOrigin.RECEIVE)
            return

        const stack = mc.player?.getStackInHand(mc.player?.activeHand);

        if (event.packet instanceof PlayerActionC2SPacket
            && event.packet.action == PlayerActionC2SPacket$Action.RELEASE_USE_ITEM
            && stack && stack.item?.getUseAction(stack) == UseAction.BLOCK)
            event.cancelEvent()

        packetThisTick++;
    })
})