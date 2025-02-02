// imports
/* eslint-disable unused-imports/no-unused-imports */
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
/* eslint-enable unused-imports/no-unused-imports */
// DO NOT TOUCH ANYTHING ABOVE THIS LINE, also not sure why it didn't work


const script = registerScript.apply({
    name: "example-minimal",
    version: "1.0.0",
    authors: ["commandblock2"]
});

script.registerModule({
    name: "example-typescript-module-minimal",
    description: "Ths is an minimal example module generated in ts", 
    category: "Client",

}, (mod) => {
    mod.on("enable", () => {
        Client.displayChatMessage(`Hi, ${mc.player}`)
    })
})