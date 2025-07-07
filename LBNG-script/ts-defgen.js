"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const URLClassLoader_1 = require("jvm-types/java/net/URLClassLoader");
const File_1 = require("jvm-types/java/io/File");
const Thread_1 = require("jvm-types/java/lang/Thread");
const Paths_1 = require("jvm-types/java/nio/file/Paths");
// @ts-expect-error
const HashMap_1 = require("jvm-types/java/util/HashMap");
// @ts-expect-error
const ArrayList_1 = require("jvm-types/java/util/ArrayList");
const JvmClassMappingKt_1 = require("jvm-types/kotlin/jvm/JvmClassMappingKt");
const Class_1 = require("jvm-types/java/lang/Class");
const ScriptModule_1 = require("jvm-types/net/ccbluex/liquidbounce/script/bindings/features/ScriptModule");
const ClassPath_1 = require("jvm-types/com/google/common/reflect/ClassPath");
const ScriptManager_1 = require("jvm-types/net/ccbluex/liquidbounce/script/ScriptManager");
const LiquidBounce_1 = require("jvm-types/net/ccbluex/liquidbounce/LiquidBounce");
const LocalDate_1 = require("jvm-types/java/time/LocalDate");
const DateTimeFormatter_1 = require("jvm-types/java/time/format/DateTimeFormatter");
const inDev = LiquidBounce_1.LiquidBounce.IN_DEVELOPMENT;
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
const script = registerScript.apply({
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
        const eventEntries = ReflectionUtil.getDeclaredField(ScriptModule_1.ScriptModule, "LOWERCASE_NAME_EVENT_MAP").entrySet().toArray();
        Client.displayChatMessage("looking for all jvm classes");
        const allClassInfos = findAllClassInfos();
        Client.displayChatMessage(`found ${allClassInfos.length} classes, converting to kotlin classes`);
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
                return ReflectionUtil.classByName(entry);
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
        Client.displayChatMessage(`converted to ${jvmClassesInKotlin.length} kotlin classes`);
        const kotlinClasses = javaClasses
            .concat([
            // Using the imported class from @embedded
            ReflectionUtil.classByName("net.ccbluex.liquidbounce.script.bindings.features.ScriptModule")
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
        Client.displayChatMessage(`generating types for ${classes.length} classes`);
        Client.displayChatMessage("this may take a while, please wait...");
        // @ts-expect-error
        const generated = new TsGen(classes, new HashMap_1.HashMap(), new ArrayList_1.ArrayList(), new ArrayList_1.ArrayList(), "number", NULL);
        const today = LocalDate_1.LocalDate.now();
        const formatter = DateTimeFormatter_1.DateTimeFormatter.ofPattern('y.M.d');
        Client.displayChatMessage("writing types");
        // @ts-expect-error
        const npmPack = new NPMGen(generated, packageName, `${inDev ? today.format(formatter) : LiquidBounce_1.LiquidBounce.INSTANCE.clientVersion}+${LiquidBounce_1.LiquidBounce.INSTANCE.clientBranch}.${LiquidBounce_1.LiquidBounce.INSTANCE.clientCommit}`, 
        // extraFiles - add the ambient and augmentations files
        `"augmentations/**/*.d.ts", "ambient/ambient.d.ts"`, 
        // extraTypesVersion - add the augmentations and ambient paths  
        `"./augmentations/*", "ambient/ambient.d.ts"`, 
        // otherExtras - add the types field
        `"types": "ambient/ambient.d.ts"`, `{
                ">=4.0": {
                    "jvm-types": [
                        "./types/*",
                        "./augmentations/*",
                        "ambient/ambient.d.ts"
                    ]
                }
            }`);
        npmPack.writePackageTo(
        // @ts-expect-error
        Paths_1.Paths.get(path + "/types-gen"));
        Client.displayChatMessage("print embedded script types, see log for more info, those are for maintainace use");
        const embeddedDefinition = `
// ambient.ts
// imports
import "../augmentations/index.d.ts"
${javaClasses
            .map((clazz) => {
            return `import { ${getName(clazz)} as ${getName(clazz)}_ } from "../types/${clazz.name.replaceAll(".", "/")}";`;
        })
            .join("\n")}
declare global {


// exports
${globalEntries
            .filter((entry) => entry[1] != undefined)
            .filter((entry) => !(entry[1] instanceof Class_1.Class))
            .filter((entry) => entry[1].class != undefined)
            .map((entry) => `    export const ${entry[0]}: ${getName(entry[1].class)}_;`)
            .join("\n\n")}

${javaClasses
            .map((clazz) => {
            var _a, _b;
            // Check if this class is exported as a constructor (appears in globalEntries as Class)
            const isExportedAsClass = globalEntries.some(([name, value]) => value instanceof Class_1.Class && value === clazz);
            if (isExportedAsClass) {
                const exportName = (_a = globalEntries.find(([name, value]) => value instanceof Class_1.Class && value === clazz)) === null || _a === void 0 ? void 0 : _a[0];
                // Determine if it's a concrete class or interface
                // You might need to adjust this logic based on how you distinguish them
                const isInterface = ((_b = clazz.isInterface) === null || _b === void 0 ? void 0 : _b.call(clazz)) || false; // Adjust this condition as needed
                if (isInterface) {
                    return `    export const ${exportName}: ${getName(clazz)}_;`;
                }
                else {
                    return `    export const ${exportName}: typeof ${getName(clazz)}_;`;
                }
            }
            return null;
        })
            .filter((entry) => entry !== null)
            .join("\n\n")}

}
`;
        const importsForScriptEventPatch = `
// imports for
${eventEntries.map((entry) => entry[1]).map((kClassImpl) => `import type { ${kClassImpl.simpleName} } from '../types/${kClassImpl.qualifiedName.replaceAll(".", "/")}.d.ts'`).join("\n")}


`;
        const onEventsForScriptPatch = `
// on events
${eventEntries.map((entry) => `on(eventName: "${entry[0]}", handler: (${entry[0]}Event: ${entry[1].simpleName}) => void): Unit;`).join("\n")}


`;
        Client.displayChatMessage("Generated TypeScript definitions successfully!");
        Client.displayChatMessage(`Output path: ${path}/types-gen`);
        // Output the generated content to console for debugging
        console.log(embeddedDefinition);
        // @ts-expect-error
        const Files = Java.type('java.nio.file.Files');
        // @ts-expect-error
        const filePath = Paths_1.Paths.get(`${path}/types-gen/${packageName}/ambient/ambient.d.ts`);
        // @ts-expect-error
        Files.createDirectories(filePath.getParent());
        Files.writeString(filePath, embeddedDefinition, 
        // @ts-expect-error
        Java.type("java.nio.charset.StandardCharsets").UTF_8);
        // Write the ScriptModule augmentation file
        const augmentationContent = `// ScriptModule augmentation - adds event handler interfaces

// Event type imports
${importsForScriptEventPatch}
import type { Unit } from '../types/kotlin/Unit';

// Augment ScriptModule with specific event handler overloads
declare module '../types/net/ccbluex/liquidbounce/script/bindings/features/ScriptModule' {
    interface ScriptModule {
        on(eventName: "enable" | "disable", handler: () => void): Unit;

        // on events with specific event types
        ${onEventsForScriptPatch}
    }
}
`;
        // @ts-expect-error
        const augmentationFilePath = Paths_1.Paths.get(`${path}/types-gen/${packageName}/augmentations/ScriptModule.augmentation.d.ts`);
        // @ts-expect-error
        Files.createDirectories(augmentationFilePath.getParent());
        Files.writeString(augmentationFilePath, augmentationContent, 
        // @ts-expect-error
        Java.type("java.nio.charset.StandardCharsets").UTF_8);
        console.log(importsForScriptEventPatch);
        console.log(onEventsForScriptPatch);
    }
    catch (e) {
        console.error(e);
        Client.displayChatMessage(`Error generating TypeScript definitions: ${e.message}`);
        e.printStackTrace();
        throw e;
    }
}
const packageName = "jvm-types";
const path = ScriptManager_1.ScriptManager.INSTANCE.root.path;
// @ts-expect-error
if (Java.type("java.lang.System").getenv("CI_BUILD")) {
    work(path, packageName);
    mc.close();
}
script.registerCommand({
    name: "ts-defgen",
    aliases: ["tsgen"],
    parameters: [],
    onExecute() {
        // @ts-expect-error
        UnsafeThread.run(() => work(path, packageName));
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHMtZGVmZ2VuLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL3RzLWRlZmdlbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLHNFQUFtRTtBQUNuRSxpREFBOEM7QUFFOUMsdURBQW9EO0FBQ3BELHlEQUFzRDtBQUN0RCxtQkFBbUI7QUFDbkIseURBQXNEO0FBQ3RELG1CQUFtQjtBQUNuQiw2REFBMEQ7QUFDMUQsOEVBQTJFO0FBQzNFLHFEQUFrRDtBQUNsRCwyR0FBd0c7QUFLeEcsNkVBQTBFO0FBQzFFLDJGQUF3RjtBQUl4RixrRkFBOEU7QUFDOUUsNkRBQTBEO0FBQzFELG9GQUFpRjtBQUVqRixNQUFNLEtBQUssR0FBRywyQkFBWSxDQUFDLGNBQWMsQ0FBQTtBQUV6QyxjQUFjO0FBQ2Qsa0JBQWtCO0FBQ2xCLE1BQU0sYUFBYSxHQUFHLE1BQU0sQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLENBQUM7QUFFakQsc0RBQXNEO0FBQ3RELFNBQVMsd0JBQXdCLENBQUMsT0FBZTtJQUM3QyxJQUFJLENBQUM7UUFDRCxpQ0FBaUM7UUFDakMsTUFBTSxPQUFPLEdBQUcsSUFBSSxXQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7UUFFbEMsc0JBQXNCO1FBQ3RCLE1BQU0sTUFBTSxHQUFHLE9BQU8sQ0FBQyxLQUFLLEVBQUUsQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUV2QywrREFBK0Q7UUFDL0QsT0FBTyxJQUFJLCtCQUFjLENBQ3JCLENBQUMsTUFBTSxDQUFDLEVBQ1IsZUFBTSxDQUFDLGFBQWEsRUFBRSxDQUFDLHFCQUFxQixFQUFFLENBQ2pELENBQUM7SUFDTixDQUFDO0lBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztRQUNULE9BQU8sQ0FBQyxLQUFLLENBQUMsNkJBQTZCLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDaEQsTUFBTSxDQUFDLENBQUM7SUFDWixDQUFDO0FBQ0wsQ0FBQztBQUVELG9EQUFvRDtBQUNwRCxTQUFTLGdCQUFnQixD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O0FBRTlDLG1CQUFtQjtBQUNuQixJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQztJQUNuRCxJQUFJLENBQUMsSUFBSSxFQUFFLFdBQVcsQ0FBQyxDQUFBO0lBQ3ZCLEVBQUUsQ0FBQyxLQUFLLEVBQUUsQ0FBQztBQUNmLENBQUM7QUFFRCxNQUFNLENBQUMsZUFBZSxDQUFDO0lBQ25CLElBQUksRUFBRSxXQUFXO0lBQ2pCLE9BQU8sRUFBRSxDQUFDLE9BQU8sQ0FBQztJQUNsQixVQUFVLEVBQUUsRUFDWDtJQUNELFNBQVM7UUFDTCxtQkFBbUI7UUFDbkIsWUFBWSxDQUFDLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLFdBQVcsQ0FBQyxDQUFDLENBQUM7SUFDcEQsQ0FBQztDQUNKLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFVSTENsYXNzTG9hZGVyIH0gZnJvbSBcImp2bS10eXBlcy9qYXZhL25ldC9VUkxDbGFzc0xvYWRlclwiO1xuaW1wb3J0IHsgRmlsZSB9IGZyb20gXCJqdm0tdHlwZXMvamF2YS9pby9GaWxlXCI7XG5pbXBvcnQgeyBVUkwgfSBmcm9tIFwianZtLXR5cGVzL2phdmEvbmV0L1VSTFwiO1xuaW1wb3J0IHsgVGhyZWFkIH0gZnJvbSBcImp2bS10eXBlcy9qYXZhL2xhbmcvVGhyZWFkXCI7XG5pbXBvcnQgeyBQYXRocyB9IGZyb20gXCJqdm0tdHlwZXMvamF2YS9uaW8vZmlsZS9QYXRoc1wiO1xuLy8gQHRzLWV4cGVjdC1lcnJvclxuaW1wb3J0IHsgSGFzaE1hcCB9IGZyb20gXCJqdm0tdHlwZXMvamF2YS91dGlsL0hhc2hNYXBcIjtcbi8vIEB0cy1leHBlY3QtZXJyb3JcbmltcG9ydCB7IEFycmF5TGlzdCB9IGZyb20gXCJqdm0tdHlwZXMvamF2YS91dGlsL0FycmF5TGlzdFwiO1xuaW1wb3J0IHsgSnZtQ2xhc3NNYXBwaW5nS3QgfSBmcm9tIFwianZtLXR5cGVzL2tvdGxpbi9qdm0vSnZtQ2xhc3NNYXBwaW5nS3RcIjtcbmltcG9ydCB7IENsYXNzIH0gZnJvbSBcImp2bS10eXBlcy9qYXZhL2xhbmcvQ2xhc3NcIjtcbmltcG9ydCB7IFNjcmlwdE1vZHVsZSB9IGZyb20gXCJqdm0tdHlwZXMvbmV0L2NjYmx1ZXgvbGlxdWlkYm91bmNlL3NjcmlwdC9iaW5kaW5ncy9mZWF0dXJlcy9TY3JpcHRNb2R1bGVcIjtcbmltcG9ydCB7IE9iamVjdCBhcyBKYXZhT2JqZWN0IH0gZnJvbSBcImp2bS10eXBlcy9qYXZhL2xhbmcvT2JqZWN0XCI7XG4vLyBAdHMtZXhwZWN0LWVycm9yXG5pbXBvcnQgeyBNYXAgYXMgSmF2YU1hcCB9IGZyb20gXCJqdm0tdHlwZXMvamF2YS91dGlsL01hcFwiO1xuaW1wb3J0IHsgVGhyb3dhYmxlIH0gZnJvbSBcImp2bS10eXBlcy9qYXZhL2xhbmcvVGhyb3dhYmxlXCI7XG5pbXBvcnQgeyBDbGFzc1BhdGggfSBmcm9tIFwianZtLXR5cGVzL2NvbS9nb29nbGUvY29tbW9uL3JlZmxlY3QvQ2xhc3NQYXRoXCI7XG5pbXBvcnQgeyBTY3JpcHRNYW5hZ2VyIH0gZnJvbSBcImp2bS10eXBlcy9uZXQvY2NibHVleC9saXF1aWRib3VuY2Uvc2NyaXB0L1NjcmlwdE1hbmFnZXJcIjtcbmltcG9ydCB7IEV4Y2VwdGlvbiB9IGZyb20gXCJqdm0tdHlwZXMvamF2YS9sYW5nL0V4Y2VwdGlvblwiO1xuaW1wb3J0IHsgRmlsZXNLdCB9IGZyb20gXCJqdm0tdHlwZXMva290bGluL2lvL0ZpbGVzS3RcIjtcbmltcG9ydCB7IEZpbGUgYXMgSmF2YUZpbGUgfSBmcm9tIFwianZtLXR5cGVzL2phdmEvaW8vRmlsZVwiO1xuaW1wb3J0IHsgTGlxdWlkQm91bmNlIH0gZnJvbSBcImp2bS10eXBlcy9uZXQvY2NibHVleC9saXF1aWRib3VuY2UvTGlxdWlkQm91bmNlXCJcbmltcG9ydCB7IExvY2FsRGF0ZSB9IGZyb20gXCJqdm0tdHlwZXMvamF2YS90aW1lL0xvY2FsRGF0ZVwiO1xuaW1wb3J0IHsgRGF0ZVRpbWVGb3JtYXR0ZXIgfSBmcm9tIFwianZtLXR5cGVzL2phdmEvdGltZS9mb3JtYXQvRGF0ZVRpbWVGb3JtYXR0ZXJcIjtcblxuY29uc3QgaW5EZXYgPSBMaXF1aWRCb3VuY2UuSU5fREVWRUxPUE1FTlRcblxuLy8gdHlwZTogYXJyYXlcbi8qKiBAdHlwZSBhbnlbXSAqL1xuY29uc3QgZ2xvYmFsRW50cmllcyA9IE9iamVjdC5lbnRyaWVzKGdsb2JhbFRoaXMpO1xuXG4vLyBGdW5jdGlvbiB0byBjcmVhdGUgYSBVUkxDbGFzc0xvYWRlciBmcm9tIGEgSkFSIHBhdGhcbmZ1bmN0aW9uIGNyZWF0ZUNsYXNzTG9hZGVyRnJvbUphcihqYXJQYXRoOiBzdHJpbmcpOiBVUkxDbGFzc0xvYWRlciB7XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gQ3JlYXRlIEZpbGUgb2JqZWN0IGZvciB0aGUgSkFSXG4gICAgICAgIGNvbnN0IGphckZpbGUgPSBuZXcgRmlsZShqYXJQYXRoKTtcblxuICAgICAgICAvLyBDb252ZXJ0IEZpbGUgdG8gVVJMXG4gICAgICAgIGNvbnN0IGphclVybCA9IGphckZpbGUudG9VUkkoKS50b1VSTCgpO1xuXG4gICAgICAgIC8vIENyZWF0ZSBVUkxDbGFzc0xvYWRlciB3aXRoIHRoZSBzeXN0ZW0gY2xhc3MgbG9hZGVyIGFzIHBhcmVudFxuICAgICAgICByZXR1cm4gbmV3IFVSTENsYXNzTG9hZGVyKFxuICAgICAgICAgICAgW2phclVybF0sXG4gICAgICAgICAgICBUaHJlYWQuY3VycmVudFRocmVhZCgpLmdldENvbnRleHRDbGFzc0xvYWRlcigpXG4gICAgICAgICk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjb25zb2xlLmVycm9yKFwiRXJyb3IgY3JlYXRpbmcgQ2xhc3NMb2FkZXI6XCIsIGUpO1xuICAgICAgICB0aHJvdyBlO1xuICAgIH1cbn1cblxuLy8gRnVuY3Rpb24gdG8gbG9hZCBhIGNsYXNzIGZyb20gYSBnaXZlbiBDbGFzc0xvYWRlclxuZnVuY3Rpb24gbG9hZENsYXNzRnJvbUphcihjbGFzc0xvYWRlcjogVVJMQ2xhc3NMb2FkZXIsIGNsYXNzTmFtZTogc3RyaW5nKTogQ2xhc3M8YW55PiB7XG4gICAgdHJ5IHtcbiAgICAgICAgcmV0dXJuIGNsYXNzTG9hZGVyLmxvYWRDbGFzcyhjbGFzc05hbWUpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihgRXJyb3IgbG9hZGluZyBjbGFzcyAke2NsYXNzTmFtZX06YCwgZSk7XG4gICAgICAgIHRocm93IGU7XG4gICAgfVxufVxuXG4vLyBAdHMtZXhwZWN0LWVycm9yXG5mdW5jdGlvbiBmaW5kQWxsQ2xhc3NJbmZvcygpOiBDbGFzc0luZm88YW55PltdIHtcbiAgICAvLyBAdHMtZXhwZWN0LWVycm9yXG4gICAgcmV0dXJuIEphdmEuZnJvbShcbiAgICAgICAgQ2xhc3NQYXRoLmZyb20oXG4gICAgICAgICAgICBUaHJlYWQuY3VycmVudFRocmVhZCgpXG4gICAgICAgICAgICAgICAgLmdldENvbnRleHRDbGFzc0xvYWRlcigpXG4gICAgICAgIClcbiAgICAgICAgICAgIC5nZXRUb3BMZXZlbENsYXNzZXMoKVxuICAgICAgICAgICAgLy8gQHRzLWV4cGVjdC1lcnJvclxuICAgICAgICAgICAgLmFzTGlzdCgpXG4gICAgKTtcbn1cblxuXG5mdW5jdGlvbiBnZXROYW1lKGphdmFDbGFzczogQ2xhc3M8YW55Pik6IHN0cmluZyB7XG4gICAgY29uc3QgZnVsbE5hbWUgPSBqYXZhQ2xhc3MubmFtZTtcbiAgICByZXR1cm4gZnVsbE5hbWUuc3Vic3RyaW5nKGZ1bGxOYW1lLmxhc3RJbmRleE9mKFwiLlwiKSArIDEpO1xufVxuXG5jb25zdCBzY3JpcHQgPSByZWdpc3RlclNjcmlwdC5hcHBseSh7XG4gICAgbmFtZTogXCJ0cy1kZWZnZW5cIixcbiAgICB2ZXJzaW9uOiBcIjEuMC4wXCIsXG4gICAgYXV0aG9yczogW1wiY29tbWFuZGJsb2NrMlwiXSxcbn0pO1xuXG5mdW5jdGlvbiB3b3JrKHBhdGg6IHN0cmluZywgcGFja2FnZU5hbWU6IHN0cmluZykge1xuICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGxvYWRlciA9IGNyZWF0ZUNsYXNzTG9hZGVyRnJvbUphcihcbiAgICAgICAgICAgIHBhdGggKyBcIi90cy1nZW5lcmF0b3IuamFyXCJcbiAgICAgICAgKTtcbiAgICAgICAgY29uc3QgTlBNR2VuID0gbG9hZENsYXNzRnJvbUphcihcbiAgICAgICAgICAgIGxvYWRlcixcbiAgICAgICAgICAgIFwibWUuY29tbWFuZGJsb2NrMi50c0dlbmVyYXRvci5OUE1QYWNrYWdlR2VuZXJhdG9yXCJcbiAgICAgICAgKTtcbiAgICAgICAgY29uc3QgVHNHZW4gPSBsb2FkQ2xhc3NGcm9tSmFyKFxuICAgICAgICAgICAgbG9hZGVyLFxuICAgICAgICAgICAgXCJtZS5udHJyZ2MudHNHZW5lcmF0b3IuVHlwZVNjcmlwdEdlbmVyYXRvclwiXG4gICAgICAgICk7XG4gICAgICAgIGNvbnN0IFZvaWRUeXBlID0gbG9hZENsYXNzRnJvbUphcihcbiAgICAgICAgICAgIGxvYWRlcixcbiAgICAgICAgICAgIFwibWUubnRycmdjLnRzR2VuZXJhdG9yLlZvaWRUeXBlXCJcbiAgICAgICAgKTtcblxuICAgICAgICBjb25zdCBOVUxMID0gVm9pZFR5cGUuZ2V0RW51bUNvbnN0YW50cygpWzBdO1xuXG4gICAgICAgIGNvbnN0IGphdmFDbGFzc2VzID0gZ2xvYmFsRW50cmllc1xuICAgICAgICAgICAgLmZpbHRlcigoZW50cnkpID0+IGVudHJ5WzFdICE9IHVuZGVmaW5lZClcbiAgICAgICAgICAgIC5tYXAoKGVudHJ5KSA9PiAoZW50cnlbMV0gaW5zdGFuY2VvZiBDbGFzcyA/IGVudHJ5WzFdIDogZW50cnlbMV0uY2xhc3MpKVxuICAgICAgICAgICAgLmZpbHRlcigoZW50cnkpID0+IGVudHJ5ICE9IHVuZGVmaW5lZCk7XG5cbiAgICAgICAgY29uc3QgZXZlbnRFbnRyaWVzID0gKFJlZmxlY3Rpb25VdGlsLmdldERlY2xhcmVkRmllbGQoU2NyaXB0TW9kdWxlIGFzIHVua25vd24gYXMgQ2xhc3M8SmF2YU9iamVjdD4sIFwiTE9XRVJDQVNFX05BTUVfRVZFTlRfTUFQXCIpIGFzIEphdmFNYXApLmVudHJ5U2V0KCkudG9BcnJheSgpO1xuXG4gICAgICAgIENsaWVudC5kaXNwbGF5Q2hhdE1lc3NhZ2UoXCJsb29raW5nIGZvciBhbGwganZtIGNsYXNzZXNcIilcbiAgICAgICAgY29uc3QgYWxsQ2xhc3NJbmZvcyA9IGZpbmRBbGxDbGFzc0luZm9zKClcblxuICAgICAgICBDbGllbnQuZGlzcGxheUNoYXRNZXNzYWdlKGBmb3VuZCAke2FsbENsYXNzSW5mb3MubGVuZ3RofSBjbGFzc2VzLCBjb252ZXJ0aW5nIHRvIGtvdGxpbiBjbGFzc2VzYClcblxuXG4gICAgICAgIGNvbnN0IGNsYXNzTmFtZXMgPSBbXCJqYXZhLm5ldC5VUkxDbGFzc0xvYWRlclwiLFxuICAgICAgICAgICAgXCJqYXZhLm5pby5maWxlLlBhdGhzXCIsXG4gICAgICAgICAgICBcImphdmEudXRpbC5IYXNoTWFwXCIsXG4gICAgICAgICAgICBcImphdmEudXRpbC5BcnJheUxpc3RcIixcbiAgICAgICAgICAgIFwiamF2YS51dGlsLmphci5KYXJJbnB1dFN0cmVhbVwiLFxuICAgICAgICAgICAgXCJqYXZhLnV0aWwuTWFwXCIsXG4gICAgICAgICAgICBcImNvbS5nb29nbGUuY29tbW9uLnJlZmxlY3QuQ2xhc3NQYXRoXCIsXG4gICAgICAgICAgICBcImtvdGxpbi5qdm0uSnZtQ2xhc3NNYXBwaW5nS3RcIlxuICAgICAgICBdXG4gICAgICAgICAgICAuY29uY2F0KGFsbENsYXNzSW5mb3MubWFwKChlbnRyeSkgPT4ge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBlbnRyeS5nZXROYW1lKClcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSkpO1xuICAgICAgICBjb25zdCBqdm1DbGFzc2VzID0gY2xhc3NOYW1lc1xuICAgICAgICAgICAgLm1hcCgoZW50cnkpID0+IHtcbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gUmVmbGVjdGlvblV0aWwuY2xhc3NCeU5hbWUoZW50cnkpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhdGNoIChlKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIClcbiAgICAgICAgICAgIC5maWx0ZXIoKGVudHJ5KSA9PiBlbnRyeSAhPSB1bmRlZmluZWQpO1xuICAgICAgICBjb25zdCBqdm1DbGFzc2VzSW5Lb3RsaW4gPSBqdm1DbGFzc2VzXG4gICAgICAgICAgICAubWFwKChlbnRyeSkgPT4ge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBKdm1DbGFzc01hcHBpbmdLdC5nZXRLb3RsaW5DbGFzcyhlbnRyeSlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcblxuICAgICAgICAgICAgLmZpbHRlcigoZW50cnkpID0+IGVudHJ5ICE9IG51bGwpO1xuXG4gICAgICAgIENsaWVudC5kaXNwbGF5Q2hhdE1lc3NhZ2UoYGNvbnZlcnRlZCB0byAke2p2bUNsYXNzZXNJbktvdGxpbi5sZW5ndGh9IGtvdGxpbiBjbGFzc2VzYClcbiAgICAgICAgY29uc3Qga290bGluQ2xhc3NlcyA9IGphdmFDbGFzc2VzXG4gICAgICAgICAgICAuY29uY2F0KFtcbiAgICAgICAgICAgICAgICAvLyBVc2luZyB0aGUgaW1wb3J0ZWQgY2xhc3MgZnJvbSBAZW1iZWRkZWRcbiAgICAgICAgICAgICAgICBSZWZsZWN0aW9uVXRpbC5jbGFzc0J5TmFtZShcbiAgICAgICAgICAgICAgICAgICAgXCJuZXQuY2NibHVleC5saXF1aWRib3VuY2Uuc2NyaXB0LmJpbmRpbmdzLmZlYXR1cmVzLlNjcmlwdE1vZHVsZVwiXG4gICAgICAgICAgICAgICAgKVxuICAgICAgICAgICAgXSlcbiAgICAgICAgICAgIC5jb25jYXQoZXZlbnRFbnRyaWVzLm1hcCgoZW50cnk6IGFueSkgPT4gKGVudHJ5IGFzIEFycmF5PGFueT4pWzFdKSlcbiAgICAgICAgICAgIC5tYXAoZW50cnkgPT4ge1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBKdm1DbGFzc01hcHBpbmdLdC5nZXRLb3RsaW5DbGFzcyhlbnRyeSlcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5maWx0ZXIoKGVudHJ5KSA9PiBlbnRyeSAhPSB1bmRlZmluZWQpXG4gICAgICAgICAgICAuY29uY2F0KFxuICAgICAgICAgICAgICAgIGp2bUNsYXNzZXNJbktvdGxpblxuICAgICAgICAgICAgKTtcblxuICAgICAgICBjb25zdCBjbGFzc2VzID0gbmV3IEFycmF5TGlzdChrb3RsaW5DbGFzc2VzKTtcblxuICAgICAgICBDbGllbnQuZGlzcGxheUNoYXRNZXNzYWdlKGBnZW5lcmF0aW5nIHR5cGVzIGZvciAke2NsYXNzZXMubGVuZ3RofSBjbGFzc2VzYClcbiAgICAgICAgQ2xpZW50LmRpc3BsYXlDaGF0TWVzc2FnZShcInRoaXMgbWF5IHRha2UgYSB3aGlsZSwgcGxlYXNlIHdhaXQuLi5cIik7XG4gICAgICAgIC8vIEB0cy1leHBlY3QtZXJyb3JcbiAgICAgICAgY29uc3QgZ2VuZXJhdGVkID0gbmV3IFRzR2VuKFxuICAgICAgICAgICAgY2xhc3NlcyxcbiAgICAgICAgICAgIG5ldyBIYXNoTWFwKCksXG4gICAgICAgICAgICBuZXcgQXJyYXlMaXN0KCksXG4gICAgICAgICAgICBuZXcgQXJyYXlMaXN0KCksXG4gICAgICAgICAgICBcIm51bWJlclwiLFxuICAgICAgICAgICAgTlVMTFxuICAgICAgICApO1xuXG4gICAgICAgIGNvbnN0IHRvZGF5ID0gTG9jYWxEYXRlLm5vdygpO1xuICAgICAgICBjb25zdCBmb3JtYXR0ZXIgPSBEYXRlVGltZUZvcm1hdHRlci5vZlBhdHRlcm4oJ3kuTS5kJyk7XG5cbiAgICAgICAgQ2xpZW50LmRpc3BsYXlDaGF0TWVzc2FnZShcIndyaXRpbmcgdHlwZXNcIik7XG4gICAgICAgIC8vIEB0cy1leHBlY3QtZXJyb3JcbiAgICAgICAgY29uc3QgbnBtUGFjayA9IG5ldyBOUE1HZW4oZ2VuZXJhdGVkLCBwYWNrYWdlTmFtZSxcbiAgICAgICAgICAgIGAke2luRGV2ID8gdG9kYXkuZm9ybWF0KGZvcm1hdHRlcikgOiBMaXF1aWRCb3VuY2UuSU5TVEFOQ0UuY2xpZW50VmVyc2lvblxuICAgICAgICAgICAgfSske0xpcXVpZEJvdW5jZS5JTlNUQU5DRS5jbGllbnRCcmFuY2h9LiR7TGlxdWlkQm91bmNlLklOU1RBTkNFLmNsaWVudENvbW1pdH1gLFxuICAgICAgICAgICAgLy8gZXh0cmFGaWxlcyAtIGFkZCB0aGUgYW1iaWVudCBhbmQgYXVnbWVudGF0aW9ucyBmaWxlc1xuICAgICAgICAgICAgYFwiYXVnbWVudGF0aW9ucy8qKi8qLmQudHNcIiwgXCJhbWJpZW50L2FtYmllbnQuZC50c1wiYCxcbiAgICAgICAgICAgIC8vIGV4dHJhVHlwZXNWZXJzaW9uIC0gYWRkIHRoZSBhdWdtZW50YXRpb25zIGFuZCBhbWJpZW50IHBhdGhzICBcbiAgICAgICAgICAgIGBcIi4vYXVnbWVudGF0aW9ucy8qXCIsIFwiYW1iaWVudC9hbWJpZW50LmQudHNcImAsXG4gICAgICAgICAgICAvLyBvdGhlckV4dHJhcyAtIGFkZCB0aGUgdHlwZXMgZmllbGRcbiAgICAgICAgICAgIGBcInR5cGVzXCI6IFwiYW1iaWVudC9hbWJpZW50LmQudHNcImAsXG4gICAgICAgICAgICBge1xuICAgICAgICAgICAgICAgIFwiPj00LjBcIjoge1xuICAgICAgICAgICAgICAgICAgICBcImp2bS10eXBlc1wiOiBbXG4gICAgICAgICAgICAgICAgICAgICAgICBcIi4vdHlwZXMvKlwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgXCIuL2F1Z21lbnRhdGlvbnMvKlwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgXCJhbWJpZW50L2FtYmllbnQuZC50c1wiXG4gICAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9YFxuICAgICAgICApO1xuXG4gICAgICAgIG5wbVBhY2sud3JpdGVQYWNrYWdlVG8oXG4gICAgICAgICAgICAvLyBAdHMtZXhwZWN0LWVycm9yXG4gICAgICAgICAgICBQYXRocy5nZXQocGF0aCArIFwiL3R5cGVzLWdlblwiKVxuICAgICAgICApO1xuXG4gICAgICAgIENsaWVudC5kaXNwbGF5Q2hhdE1lc3NhZ2UoXCJwcmludCBlbWJlZGRlZCBzY3JpcHQgdHlwZXMsIHNlZSBsb2cgZm9yIG1vcmUgaW5mbywgdGhvc2UgYXJlIGZvciBtYWludGFpbmFjZSB1c2VcIilcblxuICAgICAgICBjb25zdCBlbWJlZGRlZERlZmluaXRpb24gPSBgXG4vLyBhbWJpZW50LnRzXG4vLyBpbXBvcnRzXG5pbXBvcnQgXCIuLi9hdWdtZW50YXRpb25zL2luZGV4LmQudHNcIlxuJHtqYXZhQ2xhc3Nlc1xuICAgICAgICAgICAgICAgIC5tYXAoKGNsYXp6KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBgaW1wb3J0IHsgJHtnZXROYW1lKGNsYXp6KX0gYXMgJHtnZXROYW1lKGNsYXp6KX1fIH0gZnJvbSBcIi4uL3R5cGVzLyR7Y2xhenoubmFtZS5yZXBsYWNlQWxsKFwiLlwiLCBcIi9cIil9XCI7YDtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC5qb2luKFwiXFxuXCIpfVxuZGVjbGFyZSBnbG9iYWwge1xuXG5cbi8vIGV4cG9ydHNcbiR7Z2xvYmFsRW50cmllc1xuICAgICAgICAgICAgICAgIC5maWx0ZXIoKGVudHJ5KSA9PiBlbnRyeVsxXSAhPSB1bmRlZmluZWQpXG4gICAgICAgICAgICAgICAgLmZpbHRlcigoZW50cnkpID0+ICEoZW50cnlbMV0gaW5zdGFuY2VvZiBDbGFzcykpXG4gICAgICAgICAgICAgICAgLmZpbHRlcigoZW50cnkpID0+IGVudHJ5WzFdLmNsYXNzICE9IHVuZGVmaW5lZClcbiAgICAgICAgICAgICAgICAubWFwKChlbnRyeSkgPT4gYCAgICBleHBvcnQgY29uc3QgJHtlbnRyeVswXX06ICR7Z2V0TmFtZShlbnRyeVsxXS5jbGFzcyl9XztgKVxuICAgICAgICAgICAgICAgIC5qb2luKFwiXFxuXFxuXCIpfVxuXG4ke2phdmFDbGFzc2VzXG4gICAgICAgICAgICAgICAgLm1hcCgoY2xhenopID0+IHtcbiAgICAgICAgICAgICAgICAgICAgLy8gQ2hlY2sgaWYgdGhpcyBjbGFzcyBpcyBleHBvcnRlZCBhcyBhIGNvbnN0cnVjdG9yIChhcHBlYXJzIGluIGdsb2JhbEVudHJpZXMgYXMgQ2xhc3MpXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGlzRXhwb3J0ZWRBc0NsYXNzID0gZ2xvYmFsRW50cmllcy5zb21lKChbbmFtZSwgdmFsdWVdKSA9PiBcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlIGluc3RhbmNlb2YgQ2xhc3MgJiYgdmFsdWUgPT09IGNsYXp6XG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICBpZiAoaXNFeHBvcnRlZEFzQ2xhc3MpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGV4cG9ydE5hbWUgPSBnbG9iYWxFbnRyaWVzLmZpbmQoKFtuYW1lLCB2YWx1ZV0pID0+IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlIGluc3RhbmNlb2YgQ2xhc3MgJiYgdmFsdWUgPT09IGNsYXp6XG4gICAgICAgICAgICAgICAgICAgICAgICApPy5bMF07XG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIERldGVybWluZSBpZiBpdCdzIGEgY29uY3JldGUgY2xhc3Mgb3IgaW50ZXJmYWNlXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBZb3UgbWlnaHQgbmVlZCB0byBhZGp1c3QgdGhpcyBsb2dpYyBiYXNlZCBvbiBob3cgeW91IGRpc3Rpbmd1aXNoIHRoZW1cbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGlzSW50ZXJmYWNlID0gY2xhenouaXNJbnRlcmZhY2U/LigpIHx8IGZhbHNlOyAvLyBBZGp1c3QgdGhpcyBjb25kaXRpb24gYXMgbmVlZGVkXG4gICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpc0ludGVyZmFjZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBgICAgIGV4cG9ydCBjb25zdCAke2V4cG9ydE5hbWV9OiAke2dldE5hbWUoY2xhenopfV87YDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGAgICAgZXhwb3J0IGNvbnN0ICR7ZXhwb3J0TmFtZX06IHR5cGVvZiAke2dldE5hbWUoY2xhenopfV87YDtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgIC5maWx0ZXIoKGVudHJ5KSA9PiBlbnRyeSAhPT0gbnVsbClcbiAgICAgICAgICAgICAgICAuam9pbihcIlxcblxcblwiKX1cblxufVxuYFxuXG4gICAgICAgIGNvbnN0IGltcG9ydHNGb3JTY3JpcHRFdmVudFBhdGNoID0gYFxuLy8gaW1wb3J0cyBmb3JcbiR7ZXZlbnRFbnRyaWVzLm1hcCgoZW50cnk6IGFueSkgPT4gZW50cnlbMV0pLm1hcCgoa0NsYXNzSW1wbDogYW55KSA9PiBgaW1wb3J0IHR5cGUgeyAke2tDbGFzc0ltcGwuc2ltcGxlTmFtZX0gfSBmcm9tICcuLi90eXBlcy8ke2tDbGFzc0ltcGwucXVhbGlmaWVkTmFtZS5yZXBsYWNlQWxsKFwiLlwiLCBcIi9cIil9LmQudHMnYCkuam9pbihcIlxcblwiKX1cblxuXG5gO1xuICAgICAgICBjb25zdCBvbkV2ZW50c0ZvclNjcmlwdFBhdGNoID0gYFxuLy8gb24gZXZlbnRzXG4ke2V2ZW50RW50cmllcy5tYXAoKGVudHJ5OiBhbnkpID0+IGBvbihldmVudE5hbWU6IFwiJHtlbnRyeVswXX1cIiwgaGFuZGxlcjogKCR7ZW50cnlbMF19RXZlbnQ6ICR7ZW50cnlbMV0uc2ltcGxlTmFtZX0pID0+IHZvaWQpOiBVbml0O2ApLmpvaW4oXCJcXG5cIil9XG5cblxuYDtcblxuICAgICAgICBDbGllbnQuZGlzcGxheUNoYXRNZXNzYWdlKFwiR2VuZXJhdGVkIFR5cGVTY3JpcHQgZGVmaW5pdGlvbnMgc3VjY2Vzc2Z1bGx5IVwiKTtcbiAgICAgICAgQ2xpZW50LmRpc3BsYXlDaGF0TWVzc2FnZShgT3V0cHV0IHBhdGg6ICR7cGF0aH0vdHlwZXMtZ2VuYCk7XG5cbiAgICAgICAgLy8gT3V0cHV0IHRoZSBnZW5lcmF0ZWQgY29udGVudCB0byBjb25zb2xlIGZvciBkZWJ1Z2dpbmdcbiAgICAgICAgY29uc29sZS5sb2coZW1iZWRkZWREZWZpbml0aW9uKTtcbiAgICAgICAgLy8gQHRzLWV4cGVjdC1lcnJvclxuICAgICAgICBjb25zdCBGaWxlcyA9IEphdmEudHlwZSgnamF2YS5uaW8uZmlsZS5GaWxlcycpXG4gICAgICAgIC8vIEB0cy1leHBlY3QtZXJyb3JcbiAgICAgICAgY29uc3QgZmlsZVBhdGggPSBQYXRocy5nZXQoYCR7cGF0aH0vdHlwZXMtZ2VuLyR7cGFja2FnZU5hbWV9L2FtYmllbnQvYW1iaWVudC5kLnRzYCk7XG5cbiAgICAgICAgLy8gQHRzLWV4cGVjdC1lcnJvclxuICAgICAgICBGaWxlcy5jcmVhdGVEaXJlY3RvcmllcyhmaWxlUGF0aC5nZXRQYXJlbnQoKSk7XG5cbiAgICAgICAgRmlsZXMud3JpdGVTdHJpbmcoXG4gICAgICAgICAgICBmaWxlUGF0aCxcbiAgICAgICAgICAgIGVtYmVkZGVkRGVmaW5pdGlvbixcbiAgICAgICAgICAgIC8vIEB0cy1leHBlY3QtZXJyb3JcbiAgICAgICAgICAgIEphdmEudHlwZShcImphdmEubmlvLmNoYXJzZXQuU3RhbmRhcmRDaGFyc2V0c1wiKS5VVEZfOFxuICAgICAgICApXG5cbiAgICAgICAgLy8gV3JpdGUgdGhlIFNjcmlwdE1vZHVsZSBhdWdtZW50YXRpb24gZmlsZVxuICAgICAgICBjb25zdCBhdWdtZW50YXRpb25Db250ZW50ID0gYC8vIFNjcmlwdE1vZHVsZSBhdWdtZW50YXRpb24gLSBhZGRzIGV2ZW50IGhhbmRsZXIgaW50ZXJmYWNlc1xuXG4vLyBFdmVudCB0eXBlIGltcG9ydHNcbiR7aW1wb3J0c0ZvclNjcmlwdEV2ZW50UGF0Y2h9XG5pbXBvcnQgdHlwZSB7IFVuaXQgfSBmcm9tICcuLi90eXBlcy9rb3RsaW4vVW5pdCc7XG5cbi8vIEF1Z21lbnQgU2NyaXB0TW9kdWxlIHdpdGggc3BlY2lmaWMgZXZlbnQgaGFuZGxlciBvdmVybG9hZHNcbmRlY2xhcmUgbW9kdWxlICcuLi90eXBlcy9uZXQvY2NibHVleC9saXF1aWRib3VuY2Uvc2NyaXB0L2JpbmRpbmdzL2ZlYXR1cmVzL1NjcmlwdE1vZHVsZScge1xuICAgIGludGVyZmFjZSBTY3JpcHRNb2R1bGUge1xuICAgICAgICBvbihldmVudE5hbWU6IFwiZW5hYmxlXCIgfCBcImRpc2FibGVcIiwgaGFuZGxlcjogKCkgPT4gdm9pZCk6IFVuaXQ7XG5cbiAgICAgICAgLy8gb24gZXZlbnRzIHdpdGggc3BlY2lmaWMgZXZlbnQgdHlwZXNcbiAgICAgICAgJHtvbkV2ZW50c0ZvclNjcmlwdFBhdGNofVxuICAgIH1cbn1cbmA7XG5cbiAgICAgICAgLy8gQHRzLWV4cGVjdC1lcnJvclxuICAgICAgICBjb25zdCBhdWdtZW50YXRpb25GaWxlUGF0aCA9IFBhdGhzLmdldChgJHtwYXRofS90eXBlcy1nZW4vJHtwYWNrYWdlTmFtZX0vYXVnbWVudGF0aW9ucy9TY3JpcHRNb2R1bGUuYXVnbWVudGF0aW9uLmQudHNgKTtcblxuICAgICAgICAvLyBAdHMtZXhwZWN0LWVycm9yXG4gICAgICAgIEZpbGVzLmNyZWF0ZURpcmVjdG9yaWVzKGF1Z21lbnRhdGlvbkZpbGVQYXRoLmdldFBhcmVudCgpKTtcblxuICAgICAgICBGaWxlcy53cml0ZVN0cmluZyhcbiAgICAgICAgICAgIGF1Z21lbnRhdGlvbkZpbGVQYXRoLFxuICAgICAgICAgICAgYXVnbWVudGF0aW9uQ29udGVudCxcbiAgICAgICAgICAgIC8vIEB0cy1leHBlY3QtZXJyb3JcbiAgICAgICAgICAgIEphdmEudHlwZShcImphdmEubmlvLmNoYXJzZXQuU3RhbmRhcmRDaGFyc2V0c1wiKS5VVEZfOFxuICAgICAgICApO1xuXG4gICAgICAgIGNvbnNvbGUubG9nKGltcG9ydHNGb3JTY3JpcHRFdmVudFBhdGNoKTtcbiAgICAgICAgY29uc29sZS5sb2cob25FdmVudHNGb3JTY3JpcHRQYXRjaCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjb25zb2xlLmVycm9yKGUpO1xuICAgICAgICBDbGllbnQuZGlzcGxheUNoYXRNZXNzYWdlKGBFcnJvciBnZW5lcmF0aW5nIFR5cGVTY3JpcHQgZGVmaW5pdGlvbnM6ICR7KGUgYXMgVGhyb3dhYmxlKS5tZXNzYWdlfWApO1xuICAgICAgICAoZSBhcyBFeGNlcHRpb24pLnByaW50U3RhY2tUcmFjZSgpXG4gICAgICAgIHRocm93IGU7XG4gICAgfVxufVxuXG5jb25zdCBwYWNrYWdlTmFtZSA9IFwianZtLXR5cGVzXCJcbmNvbnN0IHBhdGggPSBTY3JpcHRNYW5hZ2VyLklOU1RBTkNFLnJvb3QucGF0aDtcblxuLy8gQHRzLWV4cGVjdC1lcnJvclxuaWYgKEphdmEudHlwZShcImphdmEubGFuZy5TeXN0ZW1cIikuZ2V0ZW52KFwiQ0lfQlVJTERcIikpIHtcbiAgICB3b3JrKHBhdGgsIHBhY2thZ2VOYW1lKVxuICAgIG1jLmNsb3NlKCk7XG59XG5cbnNjcmlwdC5yZWdpc3RlckNvbW1hbmQoe1xuICAgIG5hbWU6IFwidHMtZGVmZ2VuXCIsXG4gICAgYWxpYXNlczogW1widHNnZW5cIl0sXG4gICAgcGFyYW1ldGVyczogW1xuICAgIF0sXG4gICAgb25FeGVjdXRlKCkge1xuICAgICAgICAvLyBAdHMtZXhwZWN0LWVycm9yXG4gICAgICAgIFVuc2FmZVRocmVhZC5ydW4oKCkgPT4gd29yayhwYXRoLCBwYWNrYWdlTmFtZSkpO1xuICAgIH1cbn0pO1xuIl19