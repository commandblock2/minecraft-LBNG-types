

function __require(path) {
    if (path.startsWith("@embedded")) {
        return globalThis
    }

    if (path.startsWith("@jvm/types/")) {
        return {
            [path.substring(path.lastIndexOf("/") + 1)]: Java.type(path
                .replaceAll("@jvm/types/", "")
                .replaceAll("/", ".")
            )
        }
    }
    return require(path);
}
var exports = {}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// imports
/* eslint-disable unused-imports/no-unused-imports */
const _embedded_1 = __require("@embedded");
/* eslint-enable unused-imports/no-unused-imports */
// DO NOT TOUCH ANYTHING ABOVE THIS LINE, also not sure why it didn't work
const URLClassLoader_1 = __require("@jvm/types/java/net/URLClassLoader");
const File_1 = __require("@jvm/types/java/io/File");
const Thread_1 = __require("@jvm/types/java/lang/Thread");
const Paths_1 = __require("@jvm/types/java/nio/file/Paths");
// @ts-expect-error
const HashMap_1 = __require("@jvm/types/java/util/HashMap");
// @ts-expect-error
const ArrayList_1 = __require("@jvm/types/java/util/ArrayList");
const JvmClassMappingKt_1 = __require("@jvm/types/kotlin/jvm/JvmClassMappingKt");
const Class_1 = __require("@jvm/types/java/lang/Class");
const ScriptModule_1 = __require("@jvm/types/net/ccbluex/liquidbounce/script/bindings/features/ScriptModule");
const ClassPath_1 = __require("@jvm/types/com/google/common/reflect/ClassPath");
const ScriptManager_1 = __require("@jvm/types/net/ccbluex/liquidbounce/script/ScriptManager");
// type: array
/** @type any[] */
const globalEntries = Object.entries(globalThis);
// Function to create a URLClassLoader from a JAR path
function createClassLoaderFromJar(jarPath) {
    try {
        // Create File object for the JAR
        const jarFile = new File_1.File(jarPath);
        // Convert File to URL
        const jarUrl = jarFile.toURI().toURL();
        // Create URLClassLoader with the system class loader as parent
        return new URLClassLoader_1.URLClassLoader([jarUrl], Thread_1.Thread.currentThread().getContextClassLoader());
    }
    catch (e) {
        console.error("Error creating ClassLoader:", e);
        throw e;
    }
}
// Function to load a class from a given ClassLoader
function loadClassFromJar(classLoader, className) {
    try {
        return classLoader.loadClass(className);
    }
    catch (e) {
        console.error(`Error loading class ${className}:`, e);
        throw e;
    }
}
// @ts-expect-error
function findAllClassInfos() {
    // @ts-expect-error
    return Java.from(ClassPath_1.ClassPath.from(Thread_1.Thread.currentThread()
        .getContextClassLoader())
        .getTopLevelClasses()
        // @ts-expect-error
        .asList());
}
function getName(javaClass) {
    const fullName = javaClass.name;
    return fullName.substring(fullName.lastIndexOf(".") + 1);
}
const script = _embedded_1.registerScript.apply({
    name: "ts-defgen",
    version: "1.0.0",
    authors: ["commandblock2"],
});
function work(path, packageName) {
    try {
        const loader = createClassLoaderFromJar(path + "/ts-generator.jar");
        const NPMGen = loadClassFromJar(loader, "me.commandblock2.tsGenerator.NPMPackageGenerator");
        const TsGen = loadClassFromJar(loader, "me.ntrrgc.tsGenerator.TypeScriptGenerator");
        const VoidType = loadClassFromJar(loader, "me.ntrrgc.tsGenerator.VoidType");
        const NULL = VoidType.getEnumConstants()[0];
        const javaClasses = globalEntries
            .filter((entry) => entry[1] != undefined)
            .map((entry) => (entry[1] instanceof Class_1.Class ? entry[1] : entry[1].class))
            .filter((entry) => entry != undefined);
        const eventEntries = _embedded_1.ReflectionUtil.getDeclaredField(ScriptModule_1.ScriptModule, "LOWERCASE_NAME_EVENT_MAP").entrySet().toArray();
        _embedded_1.Client.displayChatMessage("looking for all jvm classes");
        const allClassInfos = findAllClassInfos();
        _embedded_1.Client.displayChatMessage(`found ${allClassInfos.length} classes, converting to kotlin classes`);
        const classNames = ["java.net.URLClassLoader",
            "java.nio.file.Paths",
            "java.util.HashMap",
            "java.util.ArrayList",
            "java.util.jar.JarInputStream",
            "java.util.Map",
            "com.google.common.reflect.ClassPath",
            "kotlin.jvm.JvmClassMappingKt"
        ]
            .concat(allClassInfos.map((entry) => {
            try {
                return entry.getName();
            }
            catch (e) {
                return null;
            }
        }));
        const jvmClasses = classNames
            .map((entry) => {
            try {
                return _embedded_1.ReflectionUtil.classByName(entry);
            }
            catch (e) {
                return null;
            }
        })
            .filter((entry) => entry != undefined);
        const jvmClassesInKotlin = jvmClasses
            .map((entry) => {
            try {
                return JvmClassMappingKt_1.JvmClassMappingKt.getKotlinClass(entry);
            }
            catch (e) {
                return null;
            }
        })
            .filter((entry) => entry != null);
        _embedded_1.Client.displayChatMessage(`converted to ${jvmClassesInKotlin.length} kotlin classes`);
        const kotlinClasses = javaClasses
            .concat([
            // Using the imported class from @embedded
            _embedded_1.ReflectionUtil.classByName("net.ccbluex.liquidbounce.script.bindings.features.ScriptModule")
        ])
            .concat(eventEntries.map((entry) => entry[1]))
            .map(entry => {
            try {
                return JvmClassMappingKt_1.JvmClassMappingKt.getKotlinClass(entry);
            }
            catch (e) {
                return null;
            }
        })
            .filter((entry) => entry != undefined)
            .concat(jvmClassesInKotlin);
        const classes = new ArrayList_1.ArrayList(kotlinClasses);
        _embedded_1.Client.displayChatMessage(`generating types for ${classes.length} classes`);
        _embedded_1.Client.displayChatMessage("this may take a while, please wait...");
        // @ts-expect-error
        const generated = new TsGen(classes, new HashMap_1.HashMap(), new ArrayList_1.ArrayList(), new ArrayList_1.ArrayList(), "number", NULL);
        _embedded_1.Client.displayChatMessage("writing types");
        // @ts-expect-error
        const npmPack = new NPMGen(generated, packageName);
        npmPack.writePackageTo(
        // @ts-expect-error
        Paths_1.Paths.get(path + "/types-gen"));
        _embedded_1.Client.displayChatMessage("print embedded script types, see log for more info, those are for maintainace use");
        const embeddedDefinition = `
// embedded.ts
declare module "@embedded" {
// imports
${javaClasses
            .map((clazz) => {
            return `import { ${getName(clazz)} } from "@${packageName}/types/${clazz.name.replaceAll(".", "/")}";`;
        })
            .join("\n")}


// exports
${globalEntries
            .filter((entry) => entry[1] != undefined)
            .filter((entry) => !(entry[1] instanceof Class_1.Class))
            .filter((entry) => entry[1].class != undefined)
            .map((entry) => `    export const ${entry[0]}: ${getName(entry[1].class)};`)
            .join("\n\n")}

${globalEntries
            .filter((entry) => entry[1] != undefined)
            .filter((entry) => entry[1] instanceof Class_1.Class)
            .map((entry) => `    export { ${entry[0]} };`)
            .join("\n\n")}

}

`;
        const templateFile = `
// header for template.ts
// imports
import {
${globalEntries
            .filter((entry) => entry[1] != undefined)
            .filter((entry) => entry[1] instanceof Class_1.Class || entry[1].class != undefined)
            .map((entry) => `   ${entry[0]}`)
            .join(",\n")}
} from "@embedded";
`;
        const importsForScriptEventPatch = `
// imports for
${eventEntries.map((entry) => entry[1]).map((kClassImpl) => `import type { ${kClassImpl.simpleName} } from '../../../../../../${kClassImpl.qualifiedName.replaceAll(".", "/")}.d.ts'`).join("\n")}


`;
        const onEventsForScriptPatch = `
// on events
${eventEntries.map((entry) => `on(eventName: "${entry[0]}", handler: (${entry[0]}Event: ${entry[1].simpleName}) => void): Unit;`).join("\n")}


`;
        _embedded_1.Client.displayChatMessage("Generated TypeScript definitions successfully!");
        _embedded_1.Client.displayChatMessage(`Output path: ${path}/types-gen`);
        // Output the generated content to console for debugging
        console.log(embeddedDefinition);
        console.log(templateFile);
        console.log(importsForScriptEventPatch);
        console.log(onEventsForScriptPatch);
    }
    catch (e) {
        console.error(e);
        _embedded_1.Client.displayChatMessage(`Error generating TypeScript definitions: ${e.message}`);
        e.printStackTrace();
        throw e;
    }
}
const packageName = "minecraft-yarn-definitions";
const path = ScriptManager_1.ScriptManager.INSTANCE.root.path;
// @ts-expect-error
if (Java.type("java.lang.System").getenv("CI_BUILD")) {
    work(path, packageName);
    _embedded_1.mc.close();
}
script.registerCommand({
    name: "ts-defgen",
    aliases: ["tsgen"],
    parameters: [],
    onExecute() {
        // @ts-expect-error
        _embedded_1.UnsafeThread.run(() => work(path, packageName));
    }
});
