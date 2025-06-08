import { SyntaxKind, tokenToString } from 'typescript';


const script = registerScript.apply({
    name: "node-ecosystem-demo",
    version: "1.0.0",
    authors: ["commandblock2"]
});

script.registerModule({
    name: "example-node-ecosystem-demo-module",
    description: "Ths is an minimal example module for the node ecosystem demo",
    category: "Client",

}, (mod) => {
    mod.on("enable", () => {
        Client.displayChatMessage(`All keywords in ts are ${Array.from({ length: SyntaxKind.LastKeyword - SyntaxKind.FirstKeyword + 1 }, (_, i) => tokenToString(SyntaxKind.FirstKeyword + i)).filter(Boolean)}`)
    })
})