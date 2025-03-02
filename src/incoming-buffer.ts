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
import { Throwable } from "@minecraft-yarn-definitions/types/java/lang/Throwable";
import { EventManager } from "@minecraft-yarn-definitions/types/net/ccbluex/liquidbounce/event/EventManager";
import { PacketEvent } from "@minecraft-yarn-definitions/types/net/ccbluex/liquidbounce/event/events/PacketEvent";
import { TransferOrigin } from "@minecraft-yarn-definitions/types/net/ccbluex/liquidbounce/event/events/TransferOrigin";
import { Packet } from "@minecraft-yarn-definitions/types/net/minecraft/network/packet/Packet";
/* eslint-enable unused-imports/no-unused-imports */
// DO NOT TOUCH ANYTHING ABOVE THIS LINE, also not sure why it didn't work


const script = registerScript.apply({
    name: "input-packet-delay",
    version: "1.0.0",
    authors: ["commandblock2"]
});

script.registerModule({
    name: "input-packet-delay",
    description: "Delay incoming packet by some ticks, might not work as expected",
    category: "Exploit",
    settings: {
        bufferTicks: Setting.int({
            name: "bufferTicks",
            default: 5,
            range: [1, 200]
        })
    }
}, (mod) => {

    var packetList: Array<{ packet: Packet<any>, tick: number }> = []

    mod.on("enable", () => {
        // if in single player world disable the script
        if (mc.isInSingleplayer())
            mod.disable()
    })

    mod.on("packet", (event) => {
        if (!mc.player || !event.original)
            return;

        try {



            if (event.origin == TransferOrigin.RECEIVE) {
                event.cancelEvent()

                packetList.push({
                    packet: event.packet,
                    tick: mod.settings.bufferTicks.get()
                })
            }
        } catch (e) {
            console.error(e);
            (e as Throwable).printStackTrace()
        }
    })

    mod.on("disable", () => {
        packetList.forEach(element => {
            const packetEvent = new PacketEvent(
                TransferOrigin.RECEIVE,
                element.packet,
                false
            );

            EventManager.INSTANCE.callEvent(packetEvent);

            if (!packetEvent.isCancelled()) {
                element.packet.apply(mc.getNetworkHandler())
            }
        });

        packetList.length = 0;
    })

    mod.on("gametick", (event) => {
        packetList.forEach(element => {
            element.tick--
        });

        // Client.displayChatMessage(`size of packetList: ${packetList.length}`)

        packetList.forEach(element => {
            if (element.tick <= 0) {
                const packetEvent = new PacketEvent(
                    TransferOrigin.RECEIVE,
                    element.packet,
                    false
                );

                EventManager.INSTANCE.callEvent(packetEvent);

                if (!packetEvent.isCancelled()) {
                    element.packet.apply(mc.getNetworkHandler())
                }
            }
        });

        packetList = packetList.filter(element => element.tick > 0)
    })

    mod.on("serverconnect", (event) => {
        packetList.length = 0 // wtf that's how you write js/ts ?
    })
})