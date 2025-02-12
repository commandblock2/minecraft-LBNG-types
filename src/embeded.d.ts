// embedded.ts
declare module "@embedded" {
    // imports
    import { ScriptSetting } from "@minecraft-yarn-definitions/types/net/ccbluex/liquidbounce/script/bindings/features/ScriptSetting";
    import { Vec3i } from "@minecraft-yarn-definitions/types/net/minecraft/util/math/Vec3i";
    import { Vec3d } from "@minecraft-yarn-definitions/types/net/minecraft/util/math/Vec3d";
    import { MathHelper } from "@minecraft-yarn-definitions/types/net/minecraft/util/math/MathHelper";
    import { BlockPos } from "@minecraft-yarn-definitions/types/net/minecraft/util/math/BlockPos";
    import { Hand } from "@minecraft-yarn-definitions/types/net/minecraft/util/Hand";
    import { RotationAxis } from "@minecraft-yarn-definitions/types/net/minecraft/util/math/RotationAxis";
    import { MinecraftClient } from "@minecraft-yarn-definitions/types/net/minecraft/client/MinecraftClient";
    import { ScriptClient } from "@minecraft-yarn-definitions/types/net/ccbluex/liquidbounce/script/bindings/api/ScriptClient";
    import { ScriptRotationUtil } from "@minecraft-yarn-definitions/types/net/ccbluex/liquidbounce/script/bindings/api/ScriptRotationUtil";
    import { ScriptItemUtil } from "@minecraft-yarn-definitions/types/net/ccbluex/liquidbounce/script/bindings/api/ScriptItemUtil";
    import { ScriptNetworkUtil } from "@minecraft-yarn-definitions/types/net/ccbluex/liquidbounce/script/bindings/api/ScriptNetworkUtil";
    import { ScriptInteractionUtil } from "@minecraft-yarn-definitions/types/net/ccbluex/liquidbounce/script/bindings/api/ScriptInteractionUtil";
    import { ScriptBlockUtil } from "@minecraft-yarn-definitions/types/net/ccbluex/liquidbounce/script/bindings/api/ScriptBlockUtil";
    import { ScriptMovementUtil } from "@minecraft-yarn-definitions/types/net/ccbluex/liquidbounce/script/bindings/api/ScriptMovementUtil";
    import { ScriptReflectionUtil } from "@minecraft-yarn-definitions/types/net/ccbluex/liquidbounce/script/bindings/api/ScriptReflectionUtil";
    import { ScriptParameterValidator } from "@minecraft-yarn-definitions/types/net/ccbluex/liquidbounce/script/bindings/api/ScriptParameterValidator";
    import { ScriptUnsafeThread } from "@minecraft-yarn-definitions/types/net/ccbluex/liquidbounce/script/bindings/api/ScriptUnsafeThread";
    import { PolyglotScript$RegisterScript } from "@minecraft-yarn-definitions/types/net/ccbluex/liquidbounce/script/PolyglotScript$RegisterScript";
    
    
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
    
        export const registerScript: PolyglotScript$RegisterScript;
    
        export { Vec3i };
    
        export { Vec3d };
    
        export { MathHelper };
    
        export { BlockPos };
    
        export { Hand };
    
        export { RotationAxis };
    
    }
    