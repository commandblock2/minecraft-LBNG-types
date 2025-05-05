"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var URLClassLoader_1 = require("@jvm/types/java/net/URLClassLoader");
var File_1 = require("@jvm/types/java/io/File");
var Thread_1 = require("@jvm/types/java/lang/Thread");
var Paths_1 = require("@jvm/types/java/nio/file/Paths");
// @ts-expect-error
var HashMap_1 = require("@jvm/types/java/util/HashMap");
// @ts-expect-error
var ArrayList_1 = require("@jvm/types/java/util/ArrayList");
var JvmClassMappingKt_1 = require("@jvm/types/kotlin/jvm/JvmClassMappingKt");
var Class_1 = require("@jvm/types/java/lang/Class");
var ScriptModule_1 = require("@jvm/types/net/ccbluex/liquidbounce/script/bindings/features/ScriptModule");
var ClassPath_1 = require("@jvm/types/com/google/common/reflect/ClassPath");
var ScriptManager_1 = require("@jvm/types/net/ccbluex/liquidbounce/script/ScriptManager");
// type: array
/** @type any[] */
var globalEntries = Object.entries(globalThis);
// Function to create a URLClassLoader from a JAR path
function createClassLoaderFromJar(jarPath) {
    try {
        // Create File object for the JAR
        var jarFile = new File_1.File(jarPath);
        // Convert File to URL
        var jarUrl = jarFile.toURI().toURL();
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
        console.error("Error loading class ".concat(className, ":"), e);
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
    var fullName = javaClass.name;
    return fullName.substring(fullName.lastIndexOf(".") + 1);
}
var script = registerScript.apply({
    name: "ts-defgen",
    version: "1.0.0",
    authors: ["commandblock2"],
});
function work(path, packageName) {
    try {
        var loader = createClassLoaderFromJar(path + "/ts-generator.jar");
        var NPMGen = loadClassFromJar(loader, "me.commandblock2.tsGenerator.NPMPackageGenerator");
        var TsGen = loadClassFromJar(loader, "me.ntrrgc.tsGenerator.TypeScriptGenerator");
        var VoidType = loadClassFromJar(loader, "me.ntrrgc.tsGenerator.VoidType");
        var NULL = VoidType.getEnumConstants()[0];
        var javaClasses = globalEntries
            .filter(function (entry) { return entry[1] != undefined; })
            .map(function (entry) { return (entry[1] instanceof Class_1.Class ? entry[1] : entry[1].class); })
            .filter(function (entry) { return entry != undefined; });
        var eventEntries = ReflectionUtil.getDeclaredField(ScriptModule_1.ScriptModule, "LOWERCASE_NAME_EVENT_MAP").entrySet().toArray();
        Client.displayChatMessage("looking for all jvm classes");
        var allClassInfos = findAllClassInfos();
        Client.displayChatMessage("found ".concat(allClassInfos.length, " classes, converting to kotlin classes"));
        var classNames = ["java.net.URLClassLoader",
            "java.nio.file.Paths",
            "java.util.HashMap",
            "java.util.ArrayList",
            "java.util.jar.JarInputStream",
            "java.util.Map",
            "com.google.common.reflect.ClassPath",
            "kotlin.jvm.JvmClassMappingKt"
        ]
            .concat(allClassInfos.map(function (entry) {
            try {
                return entry.getName();
            }
            catch (e) {
                return null;
            }
        }));
        var jvmClasses = classNames
            .map(function (entry) {
            try {
                return ReflectionUtil.classByName(entry);
            }
            catch (e) {
                return null;
            }
        })
            .filter(function (entry) { return entry != undefined; });
        var jvmClassesInKotlin = jvmClasses
            .map(function (entry) {
            try {
                return JvmClassMappingKt_1.JvmClassMappingKt.getKotlinClass(entry);
            }
            catch (e) {
                return null;
            }
        })
            .filter(function (entry) { return entry != null; });
        Client.displayChatMessage("converted to ".concat(jvmClassesInKotlin.length, " kotlin classes"));
        var kotlinClasses = javaClasses
            .concat([
            // Using the imported class from @embedded
            ReflectionUtil.classByName("net.ccbluex.liquidbounce.script.bindings.features.ScriptModule")
        ])
            .concat(eventEntries.map(function (entry) { return entry[1]; }))
            .map(function (entry) {
            try {
                return JvmClassMappingKt_1.JvmClassMappingKt.getKotlinClass(entry);
            }
            catch (e) {
                return null;
            }
        })
            .filter(function (entry) { return entry != undefined; })
            .concat(jvmClassesInKotlin);
        var classes = new ArrayList_1.ArrayList(kotlinClasses);
        Client.displayChatMessage("generating types for ".concat(classes.length, " classes"));
        Client.displayChatMessage("this may take a while, please wait...");
        // @ts-expect-error
        var generated = new TsGen(classes, new HashMap_1.HashMap(), new ArrayList_1.ArrayList(), new ArrayList_1.ArrayList(), "number", NULL);
        Client.displayChatMessage("writing types");
        // @ts-expect-error
        var npmPack = new NPMGen(generated, packageName);
        npmPack.writePackageTo(
        // @ts-expect-error
        Paths_1.Paths.get(path + "/types-gen"));
        Client.displayChatMessage("print embedded script types, see log for more info, those are for maintainace use");
        var embeddedDefinition = "\n// embedded.ts\ndeclare module \"@embedded\" {\n// imports\n".concat(javaClasses
            .map(function (clazz) {
            return "import { ".concat(getName(clazz), " } from \"@").concat(packageName, "/types/").concat(clazz.name.replaceAll(".", "/"), "\";");
        })
            .join("\n"), "\n\n\n// exports\n").concat(globalEntries
            .filter(function (entry) { return entry[1] != undefined; })
            .filter(function (entry) { return !(entry[1] instanceof Class_1.Class); })
            .filter(function (entry) { return entry[1].class != undefined; })
            .map(function (entry) { return "    export const ".concat(entry[0], ": ").concat(getName(entry[1].class), ";"); })
            .join("\n\n"), "\n\n").concat(globalEntries
            .filter(function (entry) { return entry[1] != undefined; })
            .filter(function (entry) { return entry[1] instanceof Class_1.Class; })
            .map(function (entry) { return "    export { ".concat(entry[0], " };"); })
            .join("\n\n"), "\n\n}\n\n");
        var templateFile = "\n// header for template.ts\n// imports\nimport {\n".concat(globalEntries
            .filter(function (entry) { return entry[1] != undefined; })
            .filter(function (entry) { return entry[1] instanceof Class_1.Class || entry[1].class != undefined; })
            .map(function (entry) { return "   ".concat(entry[0]); })
            .join(",\n"), "\n} from \"@embedded\";\n");
        var importsForScriptEventPatch = "\n// imports for\n".concat(eventEntries.map(function (entry) { return entry[1]; }).map(function (kClassImpl) { return "import type { ".concat(kClassImpl.simpleName, " } from '../../../../../../").concat(kClassImpl.qualifiedName.replaceAll(".", "/"), ".d.ts'"); }).join("\n"), "\n\n\n");
        var onEventsForScriptPatch = "\n// on events\n".concat(eventEntries.map(function (entry) { return "on(eventName: \"".concat(entry[0], "\", handler: (").concat(entry[0], "Event: ").concat(entry[1].simpleName, ") => void): Unit;"); }).join("\n"), "\n\n\n");
        Client.displayChatMessage("Generated TypeScript definitions successfully!");
        Client.displayChatMessage("Output path: ".concat(path, "/types-gen"));
        // Output the generated content to console for debugging
        console.log(embeddedDefinition);
        console.log(templateFile);
        console.log(importsForScriptEventPatch);
        console.log(onEventsForScriptPatch);
    }
    catch (e) {
        console.error(e);
        Client.displayChatMessage("Error generating TypeScript definitions: ".concat(e.message));
        e.printStackTrace();
        throw e;
    }
}
var packageName = "jvm";
var path = ScriptManager_1.ScriptManager.INSTANCE.root.path;
// @ts-expect-error
if (Java.type("java.lang.System").getenv("CI_BUILD")) {
    work(path, packageName);
    mc.close();
}
script.registerCommand({
    name: "ts-defgen",
    aliases: ["tsgen"],
    parameters: [],
    onExecute: function () {
        UnsafeThread.run(function () { return work(path, packageName); });
    }
});
