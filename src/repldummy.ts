import { Matrix2d } from "jvm-types/org/joml/Matrix2d";

const script = registerScript.apply({
    name: "repl-dummy",
    version: "1.0.0",
    authors: ["commandblock2"]
});

script.registerModule({
    name: "repl-dummy",
    description: "Please do .script debug repldummy(assuming that's the file name), and place your breakpoint in the Hi print statement",
    category: "Client",

}, (mod) => {
    mod.on("enable", () => {
        // @ts-expect-error
        UnsafeThread.run(() => {
            Client.displayChatMessage(`Hi, ${mc.player}`) // Place your breakpoint here
        }
        )
    })
})