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

export {}