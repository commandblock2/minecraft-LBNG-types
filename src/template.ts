// imports
import {
    Setting,
    Vec3i,
    Vec3d,
    MathHelper,
    BlockPos,
    Hand,
    RotationAxis,
    mc,
    Client,
    RotationUtil,
    ItemUtil,
    NetworkUtil,
    InteractionUtil,
    BlockUtil,
    MovementUtil,
    ReflectionUtil,
    ParameterValidator,
    UnsafeThread,
    registerScript
} from "@embedded";

import { ScriptModule } from "@minecraft-yarn-definitions/types/net/ccbluex/liquidbounce/script/bindings/features/ScriptModule";
import { Matrix2d } from "@minecraft-yarn-definitions/types/org/joml/Matrix2d";


const script = registerScript.apply({
    name: "template",
    version: "1.0.0",
    authors: ["commandblock2"]
});

script.registerModule({
    // @ts-ignore   
    name: "example-from-template",
    // @ts-ignore   
    description: "Ths is an example module generated in ts",
    // @ts-ignore   
    category: "Client"

}, (mod: ScriptModule) => {
    mod.on("enable", () => {
        Client.displayChatMessage(`${mc.player}`)
        Client.displayChatMessage(`${new Vec3i(1, 2, 3)}`)
        Client.displayChatMessage(`${new Matrix2d(1.2, 1.3, 1.4, 15)}`)
        Client.displayChatMessage("enabled")
    })
    mod.on("disable", () => Client.displayChatMessage("disabled"))
})
