// Import required Java classes

// type: array
/** @type any[]*/
var globalEntries = Object.entries(this);

const System = Java.type("java.lang.System");
const URLClassLoader = Java.type("java.net.URLClassLoader");
const File = Java.type("java.io.File");
const URL = Java.type("java.net.URL");
const Thread = Java.type("java.lang.Thread");
const Paths = Java.type("java.nio.file.Paths");
const Map = Java.type("java.util.HashMap");
const ArrayList = Java.type("java.util.ArrayList");
const JvmClassMappingKt = Java.type("kotlin.jvm.JvmClassMappingKt");
const Class = Java.type("java.lang.Class");

// Function to create a URLClassLoader from a JAR path
function createClassLoaderFromJar(jarPath) {
    try {
        // Create File object for the JAR
        const jarFile = new File(jarPath);

        // Convert File to URL
        const jarUrl = jarFile.toURI().toURL();

        // Create URLClassLoader with the system class loader as parent
        return new URLClassLoader(
            [jarUrl],
            Thread.currentThread().getContextClassLoader()
        );
    } catch (e) {
        console.error("Error creating ClassLoader:", e);
        throw e;
    }
}

// Function to load a class from a given ClassLoader
function loadClassFromJar(classLoader, className) {
    try {
        return classLoader.loadClass(className);
    } catch (e) {
        console.error(`Error loading class ${className}:`, e);
        throw e;
    }
}

function getName(javaClass) {
    const fullName = javaClass.name;
    return fullName.substring(fullName.lastIndexOf(".") + 1);
}

const script = registerScript({
    name: "ts-defgen",
    version: "1.0.0",
    authors: ["commandblock2"],
});

script.registerModule(
    {
        name: "ts-defgen",
        category: "Client",
        description: "Sausage",
        settings: {
            path: Setting.text({
                name: "Path",
                default: "",
            }),
            packageName: Setting.text({
                name: "NPMPackageName",
                default: "minecraft-yarn-definitions",
            }),
        },
    },
    (mod) => {
        mod.on("enable", (event) => {
            const loader = createClassLoaderFromJar(
                mod.settings.path.value + "/ts-generator-1.0.0.jar"
            );
            const NPMGen = loadClassFromJar(
                loader,
                "me.commandblock2.tsGenerator.NPMPackageGenerator"
            );
            const TsGen = loadClassFromJar(
                loader,
                "me.ntrrgc.tsGenerator.TypeScriptGenerator"
            );
            const VoidType = loadClassFromJar(
                loader,
                "me.ntrrgc.tsGenerator.VoidType"
            );

            const NULL = VoidType.getEnumConstants()[0];

            const javaClasses = globalEntries
                .filter((entry) => entry[1] != undefined)
                .map((entry) => (entry[1] instanceof Class ? entry[1] : entry[1].class))
                .filter((entry) => entry != undefined);

            const kotlinClasses = javaClasses
                .concat([
                    Java.type(
                        "net.ccbluex.liquidbounce.script.bindings.features.ScriptModule"
                    ),
                ])
                .map((entry) => JvmClassMappingKt.getKotlinClass(entry));

            const classes = new ArrayList(kotlinClasses);

            try {
                const generated = new TsGen(
                    classes,
                    new Map(),
                    new ArrayList(),
                    new ArrayList(),
                    "number",
                    NULL
                );
                const npmPack = new NPMGen(generated, mod.settings.packageName.value);
                npmPack.writePackageTo(
                    Paths.get(mod.settings.path.value + "/types-gen")
                );

                const embeddedDefinition = `

declare module "@embedded" {
// imports
${javaClasses
                        .map((clazz) => {
                            return `import { ${getName(clazz)}_ } from "@${mod.settings.packageName.value
                                }/types/${clazz.name.replaceAll(".", "/")}";`;
                        })
                        .join("\n")}


// exports
${globalEntries
                        .filter((entry) => entry[1] != undefined)
                        .filter((entry) => !(entry[1] instanceof Class))
                        .filter((entry) => entry[1].class != undefined)
                        .map((entry) => `   export const ${entry[0]}: ${getName(entry[1].class)}_;`)
                        .join("\n\n")}

${globalEntries
                        .filter((entry) => entry[1] != undefined)
                        .filter((entry) => entry[1] instanceof Class)
                        .map(
                            (entry) => `   export type ${entry[0]} = ${getName(entry[1])}_;`
                        )
                        .join("\n\n")}

}

`;

                const templateFile = `
// imports
import {
${
globalEntries
.filter((entry) => entry[1] != undefined)
.filter((entry) => entry[1] instanceof Class || entry[1].class != undefined)
.map((entry) => `   ${entry[0]}`)
.join(",\n")}
} from "@embedded";

import { ScriptModule } from "@${mod.settings.packageName.value}/types/net/ccbluex/liquidbounce/script/bindings/features/ScriptModule";

const script = registerScript.apply({
    
});

script.registerModule({
    // @ts-ignore   
    name: "example",
    // @ts-ignore   
    description: "Ths is an example module generated in ts",
    // @ts-ignore   
    version: 1,
    // @ts-ignore   
    author: "commandblock2"

}, (mod: ScriptModule) => {
    mod.on("enable", () => console.log("enabled"))
    mod.on("disable", () => console.log("disabled"))
})

`;

                console.log(embeddedDefinition)
                console.log(templateFile)
                
            } catch (e) {
                e.printStackTrace();
                console.error(e);
                throw e;
            }

            // ReflectionUtil.invokeMethod(mc.player, "getName")
            // event.context.drawGuiTexture(RenderLayer.getGuiTextured, CLOSE_TEXTURE, 0, 0, 16, 16, -1);
        });
    }
);
