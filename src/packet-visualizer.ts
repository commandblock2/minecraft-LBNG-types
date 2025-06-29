import { BlockUpdateS2CPacket } from "jvm-types/net/minecraft/network/packet/s2c/play/BlockUpdateS2CPacket";
import { BlockPos } from "jvm-types/net/minecraft/util/math/BlockPos";
import { Box } from "jvm-types/net/minecraft/util/math/Box";
import { Vec3d } from "jvm-types/net/minecraft/util/math/Vec3d";
import { Color4b } from "jvm-types/net/ccbluex/liquidbounce/render/engine/type/Color4b";
import { TextPosition, VisualizationManager, defaultRainbowInterpolator, fadeOutInterpolatorFrom, rainbowInterpolatorWithAlpha } from "lbng-utils-typed/dist/visualization-utils";

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
            default: 100,
            range: [2, 200],
            name: "displayTime",
            suffix: "tick"
        })
    }
}, (mod) => {
    const visualizationManager = new VisualizationManager(mod);

    mod.on("packet", (event) => {
        const packet = event.packet;
        if (packet instanceof BlockUpdateS2CPacket) {
            const pos: BlockPos = packet.getPos();
            const box = new Box(pos.getX(), pos.getY(), pos.getZ(), pos.getX() + 1, pos.getY() + 1, pos.getZ() + 1);
            const old = mc.world.getBlockState(pos).getBlock();
            const block = packet.state.getBlock();



            visualizationManager.addVisualization({
                durationTicks: mod.settings.displayTime.getValue(),
                boxData: {
                    box: box,
                    position: new Vec3d(0, 0, 0),
                    glow: true,
                    fillInterpolator: defaultRainbowInterpolator,
                },
                textData: {
                    textProvider(durationTicks, ticksRemaining) {
                        return [
                            `BlockUpdate(${durationTicks - ticksRemaining})`,
                            `${old.getName().getString()} -> ${block.getName().getString()}`
                        ]
                    },
                    textPositionEnum: TextPosition.TOP_CENTER
                }
            }
            );
        }
    });

    mod.on("disable", () => {
        visualizationManager.clearAllVisualizations();
    });
})