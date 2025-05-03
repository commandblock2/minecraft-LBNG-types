// imports
import { ScriptSetting } from "@jvm/types/net/ccbluex/liquidbounce/script/bindings/features/ScriptSetting";
import { Vec3i } from "@jvm/types/net/minecraft/util/math/Vec3i";
import { Vec3d } from "@jvm/types/net/minecraft/util/math/Vec3d";
import { MathHelper } from "@jvm/types/net/minecraft/util/math/MathHelper";
import { BlockPos } from "@jvm/types/net/minecraft/util/math/BlockPos";
import { Hand } from "@jvm/types/net/minecraft/util/Hand";
import { RotationAxis } from "@jvm/types/net/minecraft/util/math/RotationAxis";
import { MinecraftClient } from "@jvm/types/net/minecraft/client/MinecraftClient";
import { ScriptClient } from "@jvm/types/net/ccbluex/liquidbounce/script/bindings/api/ScriptClient";
import { ScriptRotationUtil } from "@jvm/types/net/ccbluex/liquidbounce/script/bindings/api/ScriptRotationUtil";
import { ScriptItemUtil } from "@jvm/types/net/ccbluex/liquidbounce/script/bindings/api/ScriptItemUtil";
import { ScriptNetworkUtil } from "@jvm/types/net/ccbluex/liquidbounce/script/bindings/api/ScriptNetworkUtil";
import { ScriptInteractionUtil } from "@jvm/types/net/ccbluex/liquidbounce/script/bindings/api/ScriptInteractionUtil";
import { ScriptBlockUtil } from "@jvm/types/net/ccbluex/liquidbounce/script/bindings/api/ScriptBlockUtil";
import { ScriptMovementUtil } from "@jvm/types/net/ccbluex/liquidbounce/script/bindings/api/ScriptMovementUtil";
import { ScriptReflectionUtil } from "@jvm/types/net/ccbluex/liquidbounce/script/bindings/api/ScriptReflectionUtil";
import { ScriptParameterValidator } from "@jvm/types/net/ccbluex/liquidbounce/script/bindings/api/ScriptParameterValidator";
import { ScriptUnsafeThread } from "@jvm/types/net/ccbluex/liquidbounce/script/bindings/api/ScriptUnsafeThread";
import { ConcurrentHashMap } from "@jvm/types/java/util/concurrent/ConcurrentHashMap";
import { PolyglotScript$RegisterScript } from "@jvm/types/net/ccbluex/liquidbounce/script/PolyglotScript$RegisterScript";


declare global {
    // exports
    export const Setting: ScriptSetting;

    export const mc: MinecraftClient;

    export const Client: ScriptClient;

    export const RotationUtil: ScriptRotationUtil;

    export const ItemUtil: ScriptItemUtil;

    export const NetworkUtil: ScriptNetworkUtil;

    export const InteractionUtil: ScriptInteractionUtil;

    export const BlockUtil: ScriptBlockUtil;

    export const MovementUtil: ScriptMovementUtil;

    export const ReflectionUtil: ScriptReflectionUtil;

    export const ParameterValidator: ScriptParameterValidator;

    export const UnsafeThread: ScriptUnsafeThread;

    export const localStorage: ConcurrentHashMap;

    export const registerScript: PolyglotScript$RegisterScript;

    export { Vec3i };

    export { Vec3d };

    export { MathHelper };

    export { BlockPos };

    export { Hand };

    export { RotationAxis };

}

export { };