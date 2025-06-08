import * as ts from 'typescript';

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
        Client.displayChatMessage(`All keywords in ts are ${Array.from({ length: ts.SyntaxKind.LastKeyword - ts.SyntaxKind.FirstKeyword + 1 }, (_, i) => ts.tokenToString(ts.SyntaxKind.FirstKeyword + i)).filter(Boolean)}`)
    })
})