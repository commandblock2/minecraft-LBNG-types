import { BlockUpdateS2CPacket } from "jvm-types/net/minecraft/network/packet/s2c/play/BlockUpdateS2CPacket";
import { BlockPos } from "jvm-types/net/minecraft/util/math/BlockPos";
import { Box } from "jvm-types/net/minecraft/util/math/Box";
import { Vec3d } from "jvm-types/net/minecraft/util/math/Vec3d";
import { Color4b } from "jvm-types/net/ccbluex/liquidbounce/render/engine/type/Color4b";
import { renderBoxes } from "lbng-utils-typed/dist/render-utils";

const script = registerScript.apply({
    name: "packet-visualizer",
    version: "1.0.0",
    authors: ["commandblock2"]
});

script.registerModule({
    name: "packet-visualizer",
    description: "Ths is an minimal example module generated in ts", 
    category: "Render",

    settings: {
        draw: Setting.boolean({
            default: true,
            name: "draw"
        }),
        displayTime: Setting.int({
            default: 2000,
            range: [100, 10000],
            name: "displayTime",
            suffix: "ms"
        })
    }
}, (mod) => {
    const blockUpdates: { pos: BlockPos, state: any, timestamp: number }[] = [];
    const MAX_UPDATES = 50; // Limit the number of displayed updates

    mod.on("packet", (event) => {
        const packet = event.packet;
        if (packet instanceof BlockUpdateS2CPacket) {
            const pos: BlockPos = packet.getPos();
            const state = packet.getState();
            blockUpdates.push({ pos, state, timestamp: Date.now() });

            if (blockUpdates.length > MAX_UPDATES) {
                blockUpdates.shift(); // Remove the oldest update
            }
        }
    });

    mod.on("worldrender", (event) => {
        if (!mod.settings.draw.getValue()) {
            return;
        }

        const currentTime = Date.now();
        const displayTime = mod.settings.displayTime.getValue();

        // Filter out old updates
        const activeUpdates = blockUpdates.filter(update => currentTime - update.timestamp < displayTime);
        blockUpdates.splice(0, blockUpdates.length, ...activeUpdates); // Update the original array

        const boxesToRender: [Box, Vec3d][] = [];
        activeUpdates.forEach(update => {
            const { pos } = update;
            const box = new Box(pos.getX(), pos.getY(), pos.getZ(), pos.getX() + 1, pos.getY() + 1, pos.getZ() + 1);
            boxesToRender.push([box, new Vec3d(0, 0, 0)]);
        });

        if (boxesToRender.length > 0) {
            renderBoxes(
                boxesToRender,
                event.matrixStack,
                Color4b.access$getMAGENTA$cp().alpha(150), // Outline color
                Color4b.access$getORANGE$cp().alpha(30) // Fill color
            );
        }
    });

    mod.on("disable", () => {
        blockUpdates.length = 0; // Clear updates when module is disabled
    });
})