// imports
/* eslint-disable unused-imports/no-unused-imports */
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
    registerScript
} from "@embedded";
import { TransferOrigin } from "@minecraft-yarn-definitions/types/net/ccbluex/liquidbounce/event/events/TransferOrigin";
import { ClientPlayerInteractionManager } from "@minecraft-yarn-definitions/types/net/minecraft/client/network/ClientPlayerInteractionManager";
import { LivingEntity } from "@minecraft-yarn-definitions/types/net/minecraft/entity/LivingEntity";
import { UseAction } from "@minecraft-yarn-definitions/types/net/minecraft/item/consume/UseAction";
import { PlayerActionC2SPacket } from "@minecraft-yarn-definitions/types/net/minecraft/network/packet/c2s/play/PlayerActionC2SPacket";
import { PlayerActionC2SPacket$Action } from "@minecraft-yarn-definitions/types/net/minecraft/network/packet/c2s/play/PlayerActionC2SPacket$Action";
import { PlayerInteractEntityC2SPacket } from "@minecraft-yarn-definitions/types/net/minecraft/network/packet/c2s/play/PlayerInteractEntityC2SPacket";
/* eslint-enable unused-imports/no-unused-imports */
// DO NOT TOUCH ANYTHING ABOVE THIS LINE, also not sure why it didn't work


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
            mc.getNetworkHandler()?.sendPacket(PlayerInteractEntityC2SPacket.attack(entity, false))
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
                    return entity.distanceTo(mc.player) < mod.settings.range.get()
                })
                .filter((entity) => {
                    return entity != mc.player
                })

            const hand = mc.player?.activeHand

            mc.interactionManager?.interactItem(mc.player, hand)
        }
    })

    mod.on("packet", (event) => {
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