import { GameRenderEvent } from "jvm-types/net/ccbluex/liquidbounce/event/events/GameRenderEvent"
import { WorldRenderEvent } from "jvm-types/net/ccbluex/liquidbounce/event/events/WorldRenderEvent"
import { Color4b } from "jvm-types/net/ccbluex/liquidbounce/render/engine/type/Color4b"
import { MatrixStack } from "jvm-types/net/minecraft/client/util/math/MatrixStack"
import { RenderShortcutsKt } from "jvm-types/net/ccbluex/liquidbounce/render/RenderShortcutsKt"
import { BoxRenderer } from "jvm-types/net/ccbluex/liquidbounce/render/BoxRenderer"
import { Box } from "jvm-types/net/minecraft/util/math/Box"
import { WorldRenderEnvironment } from "jvm-types/net/ccbluex/liquidbounce/render/WorldRenderEnvironment"
import { Vec3d } from "jvm-types/net/minecraft/util/math/Vec3d"



export function renderBoxes(
    boxesWithPosition: Array<[Box, Vec3d]>,
    matrixStack: MatrixStack,
    outlineColor: Color4b,
    fillColor: Color4b) {

    var dirty = false;

    RenderShortcutsKt.renderEnvironmentForWorld(
        matrixStack,
        // @ts-expect-error
        (environment: WorldRenderEnvironment) => {
            BoxRenderer.Companion.drawWith(environment,

                // @ts-expect-error
                (boxRenderer: BoxRenderer) => {
                    boxesWithPosition.forEach(([box, position]) => {
                        RenderShortcutsKt.withPositionRelativeToCamera(
                            environment,
                            position,
                            // @ts-expect-error
                            (_: WorldRenderEnvironment) => {
                                boxRenderer.drawBox(box, fillColor, outlineColor, -1, -1)
                                dirty = true;
                            }
                        )
                    });
                }
            )
        }
    )

    return dirty;
}