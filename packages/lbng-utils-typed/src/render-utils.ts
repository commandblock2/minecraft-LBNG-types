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
import { Vector3f } from "jvm-types/org/joml/Vector3f"
import { Matrix4f } from "jvm-types/org/joml/Matrix4f"
import { MinecraftVectorExtensionsKt } from "jvm-types/net/ccbluex/liquidbounce/utils/math/MinecraftVectorExtensionsKt"

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

    const scale = Primitives.float(1 / (fontSize * 0.15))

    lines.forEach((text, index) => {
        const matrixStack = env.matrixStack
        matrixStack.push()
        matrixStack.translate(
            Primitives.float(x),
            Primitives.float(y + index * fontRenderer.height * .2),
            Primitives.float(z)
        )

        matrixStack.scale(scale, scale, 1)
        const X = fontRenderer.draw(
            fontRenderer.process(text, textColor),
            0,
            0,
            true,
            Primitives.float(0.0001),
            1
        )

        // Make the model view matrix center the text when rendering
        matrixStack.translate(
            Primitives.float(-X * 0.5),
            Primitives.float(-fontRenderer.height * .5),
            Primitives.float(0)
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

export function drawLineStripFromVec3d(matrixStack: MatrixStack, positions: Array<Vec3d>, color: Color4b) {
    RenderShortcutsKt.renderEnvironmentForWorld(
        matrixStack,
        // @ts-expect-error
        (environment: WorldRenderEnvironment) => {
            RenderShortcutsKt.withColor(
                environment,
                color,
                // @ts-expect-error
                (env: RenderEnvironment) => {
                    const vec3Positions = positions.map(it => MinecraftVectorExtensionsKt.toVec3(env.relativeToCamera(it)));
                    RenderShortcutsKt.drawLineStrip(environment, vec3Positions);
                }
            );
        }
    );
}

const cacheMatrix = new Matrix4f()
const cacheVec3f = new Vector3f()

export function calculateScreenPosExtended(
    positionMatrix: Matrix4f,
    projectionMatrix: Matrix4f,
    pos: Vec3d,
    cameraPos: Vec3d = mc.gameRenderer.camera.pos) {
    const relativePos = pos.subtract(cameraPos)

    const transformedPos = cacheVec3f.set(relativePos.getX(), relativePos.getY(), relativePos.getZ())
        .mulProject(cacheMatrix.set(projectionMatrix).mul(positionMatrix))

    const scaleFactor = mc.window.scaleFactor
    const guiScaleMul = 0.5 / scaleFactor

    const screenPos = transformedPos.mul(1.0, -1.0, 1.0).add(1.0, 1.0, 0.0)
        .mul(
            Primitives.float(guiScaleMul * mc.framebuffer.viewportWidth),
            Primitives.float(guiScaleMul * mc.framebuffer.viewportHeight),
            1.0)

    return new Vec3(screenPos.x, screenPos.y, transformedPos.z)
}