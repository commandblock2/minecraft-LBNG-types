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
                mod.settings.path.value + "/ts-generator-1.1.1.jar"
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


            const eventEntries = ReflectionUtil.getDeclaredField(mod.class, "LOWERCASE_NAME_EVENT_MAP").entrySet().toArray();

            const kotlinClasses = javaClasses
                .concat([
                    Java.type(
                        "net.ccbluex.liquidbounce.script.bindings.features.ScriptModule"
                    ),
                ])
                .map((entry) => JvmClassMappingKt.getKotlinClass(entry))
                .concat(eventEntries.map((entry) => entry[1]));

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
// embedded.ts
declare module "@embedded" {
// imports
${javaClasses
                        .map((clazz) => {
                            return `import { ${getName(clazz)} } from "@${mod.settings.packageName.value
                                }/types/${clazz.name.replaceAll(".", "/")}";`;
                        })
                        .join("\n")}


// exports
${globalEntries
                        .filter((entry) => entry[1] != undefined)
                        .filter((entry) => !(entry[1] instanceof Class))
                        .filter((entry) => entry[1].class != undefined)
                        .map((entry) => `    export const ${entry[0]}: ${getName(entry[1].class)};`)
                        .join("\n\n")}

${globalEntries
                        .filter((entry) => entry[1] != undefined)
                        .filter((entry) => entry[1] instanceof Class)
                        .map(
                            (entry) => `    export { ${entry[0]} };`
                        )
                        .join("\n\n")}

}

`;

                const templateFile = `
// header for template.ts
// imports
import {
${
globalEntries
.filter((entry) => entry[1] != undefined)
.filter((entry) => entry[1] instanceof Class || entry[1].class != undefined)
.map((entry) => `   ${entry[0]}`)
.join(",\n")}
} from "@embedded";
`;


                const importsForScriptEventPatch = `
// imports for
${ eventEntries.map((entry) => entry[1]).map((kClassImpl) => `import type { ${ kClassImpl.simpleName } } from '../../../../../../${ kClassImpl.qualifiedName.replaceAll(".", "/") }.d.ts'`).join("\n") }


`
                const onEventsForScriptPatch = `
// on events
${ eventEntries.map((entry) => `on(eventName: "${entry[0]}", handler: (${entry[0]}Event: ${ entry[1].simpleName }) => void): Unit;`).join("\n") }


`

                console.log(embeddedDefinition)
                console.log(templateFile)
                console.log(importsForScriptEventPatch)
                console.log(onEventsForScriptPatch)
                
            } catch (e) {
                console.error(e);
                e.printStackTrace();
                throw e;
            }

            // ReflectionUtil.invokeMethod(mc.player, "getName")
            // event.context.drawGuiTexture(RenderLayer.getGuiTextured, CLOSE_TEXTURE, 0, 0, 16, 16, -1);
        });
    }
);
