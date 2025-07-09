import { Throwable } from "jvm-types/java/lang/Throwable";
import { TagEntityEvent } from "jvm-types/net/ccbluex/liquidbounce/event/events/TagEntityEvent";
import { Color4b } from "jvm-types/net/ccbluex/liquidbounce/render/engine/type/Color4b";
import { OtherClientPlayerEntity } from "jvm-types/net/minecraft/client/network/OtherClientPlayerEntity";
import { Box } from "jvm-types/net/minecraft/util/math/Box";
import { renderBoxes } from "lbng-utils-typed/dist/render-utils"


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
            range: [-3000000, 3000000],
            suffix: "x",
            name: "xrange"
        }),
        areaz: Setting.floatRange({
            default: [-64, 64],
            range: [-3000000, 3000000],
            suffix: "z",
            name: "zrange"
        }),
        areay: Setting.floatRange({
            default: [0, 64],
            range: [-64, 324],
            suffix: "y",
            name: "yrange"
        }),
        draw: Setting.boolean({
            default: true,
            name: "draw"
        })
    }

}, (mod) => {
    mod.on("tagentityevent", event => {

        try {

            if (!mc.world || !mc.player) return;

            // @ts-expect-error
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

    mod.on("drawoutlines", event => {

        if (!mod.settings.draw.getValue())
            return

        const { areax, areaz, areay } = mod.settings;

        const [minx, maxx] = areax.getValue()
        const [minz, maxz] = areaz.getValue()
        const [miny, maxy] = areay.getValue()

        renderBoxes([[new Box(minx, miny, minz, maxx, maxy, maxz), new Vec3d(0, 0, 0)]],
            event.matrixStack,
            Color4b.access$getORANGE$cp().alpha(30),
            Color4b.access$getMAGENTA$cp().alpha(150)
        )
    })

    const validPoint = {
        x: mod.settings.areax,
        y: mod.settings.areay,
        z: mod.settings.areaz
    };

    script.registerCommand({
        name: "startarea",
        parameters: [
            {
                name: "point",
                validate: ParameterValidator.string,
                required: true,
                getCompletions(begin, args) {
                    return Object.keys(validPoint)
                },
            }, 
            {
                name: "minormax",
                validate: ParameterValidator.string,
                required: true,
                getCompletions(begin, args) {
                    return ["min", "max"]
                }
            },
            {
                name: "offset",
                validate: ParameterValidator.integer,
                required: false,
            }
        ],
        onExecute(point: string, minormax: string, offset?: number) {

            const pos = mc.player!.pos

            if (offset == null || offset == undefined)
                offset = 0

            if (point == "x")
                offset += pos.getX()
            else if (point == "y")
                offset += pos.getY()
            else if (point == "z")
                offset += pos.getZ()

            // @ts-expect-error
            let [min, max] = validPoint[point].getValue();
            if (minormax == "min")
                min = offset
            else if (minormax == "max")
                max = offset

            // @ts-expect-error
            validPoint[point].setValue([min, max])
        },
    })
})