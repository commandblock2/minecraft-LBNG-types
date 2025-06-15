const script = registerScript.apply({
    name: "vanilla-navi",
    version: "1.0.0",
    authors: ["commandblock2"]
});

script.registerModule({
    name: "vanilla-navi",
    description: "Navigate to target destinations in vanilla minecraft in fastest possible ways",
    category: "Client",
    settings: {
        destX: Setting.int({
            name: "destX",
            default: 0,
            range: [-300000, 300000]
        }),
        destZ: Setting.int({
            name: "destZ",
            default: 0,
            range: [-300000, 300000]
        })
    }

}, (mod) => {

    var remainingTicks = 0;
    const MAX_REMAINING_TICKS = 79;

    mod.on("enable", () => {
        remainingTicks = MAX_REMAINING_TICKS;
    })

    mod.on("gametick", (event) => {
        if (remainingTicks > 0 && mc.player) {
            mc.player.velocity.y = 0
            mc.player.velocity.x = 0
            mc.player.velocity.z = 0

            if (mc.player.pos.getY() < 384) {
                mc.player.setPosition(mc.player.pos.add(
                    0, 10 - 1e-4, 0
                ))
                remainingTicks--
            } else {
                const x = mc.player.pos.x
                const y = mc.player.pos.y
                const z = mc.player.pos.z

                const destX = mod.settings.destX.getValue()
                const destZ = mod.settings.destZ.getValue()

                const deltaX = destX - x
                const deltaZ = destZ - z
                const distance = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ)

                if (distance > 1) {
                    // Calculate movement speed (adjust as needed)
                    const speed = Math.min(distance, 9.9)

                    // Normalize and apply movement
                    const moveX = (deltaX / distance) * speed
                    const moveZ = (deltaZ / distance) * speed

                    mc.player.setPosition(mc.player.pos.add(moveX, -0.03126, moveZ))
                } else {
                    remainingTicks = 0
                    mod.disable()
                }

            }
        }
    })

})

export { }