import { EntityVelocityUpdateS2CPacket } from "jvm-types/net/minecraft/network/packet/s2c/play/EntityVelocityUpdateS2CPacket";

const script = registerScript.apply({
    name: "vectorized-velocity-xz",
    version: "1.0.0",
    authors: ["commandblock2"]
});

script.registerModule({
    name: "vectorized-velocity-xz",
    description: "Port of the old script for legacy, for those anticheat that doesn't have proper velocity detection", 
    category: "Combat",
    settings: {
        offsetBasedOnPlayerOrIncomingVelocity: Setting.choose({
            name: "OffsetBasedOnPlayerOrIncomingVelocity",
            choices: ["player", "incoming"], 
            default: "player"
        }),
        offset: Setting.float({
            name: "AngleOffset",
            default: 0, 
            range: [-180, 180]
        }),
        amplitude: Setting.float({
            name: "Amplitude",
            default: 1,
            range: [-100, 100]
        })
    }
}, (mod) => {
    mod.on("packet", (event) => {
        if (!mc.player)
            return;

        const packet = event.packet
        if (packet instanceof EntityVelocityUpdateS2CPacket && packet.entityId == mc.player.id) {

            const yaw = mod.settings.offset.get() + 
            (mod.settings.offsetBasedOnPlayerOrIncomingVelocity.getValue() == "player" ? 
            -mc.player.yaw : (Math.atan2(packet.getVelocityX(), packet.getVelocityZ()) * 180 / Math.PI));

            const velocity = Math.sqrt(packet.getVelocityX() * packet.getVelocityX() + packet.getVelocityZ() * packet.getVelocityZ())
             * 8000 * mod.settings.amplitude.get();

            // graaljs traps here:
            // 1. it eats error here when we have loss in precision and does not update the value
            // 2. packet.velocityX and packet.getVelocityX() is very different (public double getVelocityX() { return (double)this.velocityX / 8000.0; })
            // and when reading velocityX graaljs calls getVelocityX() and when writing velocityX it directly writes that
            packet.velocityX = Math.round(velocity * Math.sin(yaw / 180 * Math.PI))
            packet.velocityZ = Math.round(velocity * Math.cos(yaw / 180 * Math.PI))

        }
    })
})