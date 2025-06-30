import { Color4b } from "jvm-types/net/ccbluex/liquidbounce/render/engine/type/Color4b"
import { MatrixStack } from "jvm-types/net/minecraft/client/util/math/MatrixStack"
import { RenderShortcutsKt } from "jvm-types/net/ccbluex/liquidbounce/render/RenderShortcutsKt"
import { BoxRenderer } from "jvm-types/net/ccbluex/liquidbounce/render/BoxRenderer"
import { Box } from "jvm-types/net/minecraft/util/math/Box"
import { WorldRenderEnvironment } from "jvm-types/net/ccbluex/liquidbounce/render/WorldRenderEnvironment"
import { Vec3d } from "jvm-types/net/minecraft/util/math/Vec3d"
import { FontRendererBuffers } from "jvm-types/net/ccbluex/liquidbounce/render/engine/font/FontRendererBuffers";
import { Vec3 } from "jvm-types/net/ccbluex/liquidbounce/render/engine/type/Vec3";
import { FontManager } from "jvm-types/net/ccbluex/liquidbounce/render/FontManager";
import { FontRenderer } from "jvm-types/net/ccbluex/liquidbounce/render/engine/font/FontRenderer";
import { RenderEnvironment } from "jvm-types/net/ccbluex/liquidbounce/render/RenderEnvironment";
import { RenderBufferBuilderKt } from "jvm-types/net/ccbluex/liquidbounce/render/RenderBufferBuilderKt"
import { RenderBufferBuilder } from "jvm-types/net/ccbluex/liquidbounce/render/RenderBufferBuilder"
import { VertexFormat$DrawMode } from "jvm-types/net/minecraft/client/render/VertexFormat$DrawMode"
import { VertexInputType$Pos } from "jvm-types/net/ccbluex/liquidbounce/render/VertexInputType$Pos"
import { GL11 } from "jvm-types/org/lwjgl/opengl/GL11"
import { RenderSystem } from "jvm-types/com/mojang/blaze3d/systems/RenderSystem"

export function renderBoxes(
    boxesWithPosition: Array<[Box, Vec3d]>,
    matrixStack: MatrixStack,
    fillColor: Color4b,
    outlineColor: Color4b | null) {

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

// @ts-expect-error
const Float = Java.type("java.lang.Float")

export function drawTextWithBackground(
    env: RenderEnvironment,
    lines: Array<string>,
    x: number,
    y: number,
    z: number,
    textColor: Color4b,
    fontRenderer: FontRenderer,
    quadBuffers: RenderBufferBuilder<VertexInputType$Pos>,
    lineBuffers: RenderBufferBuilder<VertexInputType$Pos>,
    fontBuffers: FontRendererBuffers
) {

    const fontSize = FontManager.DEFAULT_FONT_SIZE

    const scale = new Float(1 / (fontSize * 0.15))

    lines.forEach((text, index) => {
        const matrixStack = env.matrixStack
        matrixStack.push()
        matrixStack.translate(
            new Float(x),
            new Float(y + index * fontRenderer.height * .2),
            new Float(z)
        )

        matrixStack.scale(scale, scale, 1)
        const X = fontRenderer.draw(
            fontRenderer.process(text, textColor),
            0,
            0,
            true,
            new Float(0.0001),
            1
        )

        // Make the model view matrix center the text when rendering
        matrixStack.translate(
            new Float(-X * 0.5),
            new Float(-fontRenderer.height * .5),
            new Float(0)
        )

        fontRenderer.commit(env, fontBuffers)

        const q1 = new Vec3(-0.1 * fontSize, fontRenderer.height * -0.1, 0)
        const q2 = new Vec3(X + 0.2 * fontSize, fontRenderer.height * 1.1, 0)


        RenderBufferBuilderKt.drawQuad(quadBuffers, env, q1, q2)
        RenderBufferBuilderKt.drawQuadOutlines(lineBuffers, env, q1, q2)


        matrixStack.pop()
    }
    )
}