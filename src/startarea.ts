import { Throwable } from "jvm-types/java/lang/Throwable";
import { TagEntityEvent } from "jvm-types/net/ccbluex/liquidbounce/event/events/TagEntityEvent";
import { OtherClientPlayerEntity } from "jvm-types/net/minecraft/client/network/OtherClientPlayerEntity";


const script = registerScript.apply({
    name: "startarea",
    version: "1.0.0",
    authors: ["commandblock2"]
});

script.registerModule({
    name: "startarea",
    description: "Flat everyone in start area as a non-targeted player",
    category: "Client",
    settings: {
        areax: Setting.floatRange({
            default: [-16, 16],
            range: [-Infinity, Infinity],
            suffix: "x",
            name: "xrange"
        }),
        areaz: Setting.floatRange({
            default: [-64, 64],
            range: [-Infinity, Infinity],
            suffix: "z",
            name: "zrange"
        }),
        areay: Setting.floatRange({
            default: [0, 64],
            range: [-64, Infinity],
            suffix: "y",
            name: "yrange"
        })
    }

}, (mod) => {
    mod.on("tagentityevent", event => {

        try {

            if (!mc.world || !mc.player) return;

            if (event.entity == mc.player)
                return

            if (!(event.entity instanceof OtherClientPlayerEntity))
                return

            const { x, y, z } = event.entity.getPos();
            const { areax, areaz, areay } = mod.settings;

            const [minx, maxx] = areax.getValue()
            const [minz, maxz] = areaz.getValue()
            const [miny, maxy] = areay.getValue()
            if (!(x >= minx && x <= maxx)) return;
            if (!(z >= minz && z <= maxz)) return;
            if (!(y >= miny && y <= maxy)) return;

            event.dontTarget()
        }
        catch (e) {
            if (e instanceof Throwable) {
                e.printStackTrace();
                Client.displayChatMessage(`${e.message}`)
            }
        }

    })
})