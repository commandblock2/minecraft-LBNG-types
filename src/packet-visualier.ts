import { PlayerListS2CPacket } from "@jvm/types/net/minecraft/network/packet/s2c/play/PlayerListS2CPacket";
import { PlayerListS2CPacket$Action } from "@jvm/types/net/minecraft/network/packet/s2c/play/PlayerListS2CPacket$Action";

const script = registerScript.apply({
    name: "packet-visualizer",
    version: "1.0.0",
    authors: ["commandblock2"]
});

script.registerModule({
    name: "packet-visualizer",
    description: "Ths is an minimal example module generated in ts", 
    category: "Render",

}, (mod) => {
    mod.on("packet", (event) => {
        const packet = event.packet
        if (packet instanceof PlayerListS2CPacket) {
            packet.entries.forEach((entry) => {
                packet.actions.forEach(action => {
                    if (action == PlayerListS2CPacket$Action.UPDATE_GAME_MODE)
                        Client.displayChatMessage(`Game mode change packet received, will change to: ${entry.gameMode()}`)
                });
            });
        }
    })

    mod.on("keyboardchar", (event) => {
        event.modifiers
    })
}
)