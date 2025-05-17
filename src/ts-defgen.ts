import { URLClassLoader } from "jvm-types/java/net/URLClassLoader";
import { File } from "jvm-types/java/io/File";
import { URL } from "jvm-types/java/net/URL";
import { Thread } from "jvm-types/java/lang/Thread";
import { Paths } from "jvm-types/java/nio/file/Paths";
// @ts-expect-error
import { HashMap } from "jvm-types/java/util/HashMap";
// @ts-expect-error
import { ArrayList } from "jvm-types/java/util/ArrayList";
import { JvmClassMappingKt } from "jvm-types/kotlin/jvm/JvmClassMappingKt";
import { Class } from "jvm-types/java/lang/Class";
import { ScriptModule } from "jvm-types/net/ccbluex/liquidbounce/script/bindings/features/ScriptModule";
import { Object as JavaObject } from "jvm-types/java/lang/Object";
// @ts-expect-error
import { Map as JavaMap } from "jvm-types/java/util/Map";
import { Throwable } from "jvm-types/java/lang/Throwable";
import { ClassPath } from "jvm-types/com/google/common/reflect/ClassPath";
import { ScriptManager } from "jvm-types/net/ccbluex/liquidbounce/script/ScriptManager";
import { Exception } from "jvm-types/java/lang/Exception";
import { FilesKt } from "jvm-types/kotlin/io/FilesKt";
import { File as JavaFile } from "jvm-types/java/io/File";

// type: array
/** @type any[] */
const globalEntries = Object.entries(globalThis);

// Function to create a URLClassLoader from a JAR path
function createClassLoaderFromJar(jarPath: string): URLClassLoader {
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
function loadClassFromJar(classLoader: URLClassLoader, className: string): Class<any> {
    try {
        return classLoader.loadClass(className);
    } catch (e) {
        console.error(`Error loading class ${className}:`, e);
        throw e;
    }
}

// @ts-expect-error
function findAllClassInfos(): ClassInfo<any>[] {
    // @ts-expect-error
    return Java.from(
        ClassPath.from(
            Thread.currentThread()
                .getContextClassLoader()
        )
            .getTopLevelClasses()
            // @ts-expect-error
            .asList()
    );
}


function getName(javaClass: Class<any>): string {
    const fullName = javaClass.name;
    return fullName.substring(fullName.lastIndexOf(".") + 1);
}

const script = registerScript.apply({
    name: "ts-defgen",
    version: "1.0.0",
    authors: ["commandblock2"],
});

function work(path: string, packageName: string) {
    try {
        const loader = createClassLoaderFromJar(
            path + "/ts-generator.jar"
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

        const eventEntries = (ReflectionUtil.getDeclaredField(ScriptModule as unknown as Class<JavaObject>, "LOWERCASE_NAME_EVENT_MAP") as JavaMap).entrySet().toArray();

        Client.displayChatMessage("looking for all jvm classes")
        const allClassInfos = findAllClassInfos()

        Client.displayChatMessage(`found ${allClassInfos.length} classes, converting to kotlin classes`)


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
                    return entry.getName()
                }
                catch (e) {
                    return null;
                }
            }));
        const jvmClasses = classNames
            .map((entry) => {
                try {
                    return ReflectionUtil.classByName(entry)
                }
                catch (e) {
                    return null;
                }
            }
            )
            .filter((entry) => entry != undefined);
        const jvmClassesInKotlin = jvmClasses
            .map((entry) => {
                try {
                    return JvmClassMappingKt.getKotlinClass(entry)
                }
                catch (e) {
                    return null;
                }
            })

            .filter((entry) => entry != null);

        Client.displayChatMessage(`converted to ${jvmClassesInKotlin.length} kotlin classes`)
        const kotlinClasses = javaClasses
            .concat([
                // Using the imported class from @embedded
                ReflectionUtil.classByName(
                    "net.ccbluex.liquidbounce.script.bindings.features.ScriptModule"
                )
            ])
            .concat(eventEntries.map((entry: any) => (entry as Array<any>)[1]))
            .map(entry => {
                try {
                    return JvmClassMappingKt.getKotlinClass(entry)
                }
                catch (e) {
                    return null;
                }
            })
            .filter((entry) => entry != undefined)
            .concat(
                jvmClassesInKotlin
            );

        const classes = new ArrayList(kotlinClasses);

        Client.displayChatMessage(`generating types for ${classes.length} classes`)
        Client.displayChatMessage("this may take a while, please wait...");
        // @ts-expect-error
        const generated = new TsGen(
            classes,
            new HashMap(),
            new ArrayList(),
            new ArrayList(),
            "number",
            NULL
        );

        Client.displayChatMessage("writing types");
        // @ts-expect-error
        const npmPack = new NPMGen(generated, packageName);
        npmPack.writePackageTo(
            // @ts-expect-error
            Paths.get(path + "/types-gen")
        );

        Client.displayChatMessage("print embedded script types, see log for more info, those are for maintainace use")

        const embeddedDefinition = `
// embedded.ts
// imports
${javaClasses
                .map((clazz) => {
                    return `import { ${getName(clazz)} } from "@${packageName}/types/${clazz.name.replaceAll(".", "/")}";`;
                })
                .join("\n")}
declare global {


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

export { };
`;

        const importsForScriptEventPatch = `
// imports for
${eventEntries.map((entry: any) => entry[1]).map((kClassImpl: any) => `import type { ${kClassImpl.simpleName} } from '../../../../../../${kClassImpl.qualifiedName.replaceAll(".", "/")}.d.ts'`).join("\n")}


`;
        const onEventsForScriptPatch = `
// on events
${eventEntries.map((entry: any) => `on(eventName: "${entry[0]}", handler: (${entry[0]}Event: ${entry[1].simpleName}) => void): Unit;`).join("\n")}


`;

        Client.displayChatMessage("Generated TypeScript definitions successfully!");
        Client.displayChatMessage(`Output path: ${path}/types-gen`);

        // Output the generated content to console for debugging
        console.log(embeddedDefinition);
        // @ts-expect-error
        const Files = Java.type('java.nio.file.Files')
        // @ts-expect-error
        const filePath = Paths.get(`${path}/types-gen/${packageName}/other/embedded.d.ts`);

        // @ts-expect-error
        Files.createDirectories(filePath.getParent());

        Files.writeString(
            filePath,
            embeddedDefinition,
            // @ts-expect-error
            Java.type("java.nio.charset.StandardCharsets").UTF_8
        )
        console.log(importsForScriptEventPatch);
        console.log(onEventsForScriptPatch);
    } catch (e) {
        console.error(e);
        Client.displayChatMessage(`Error generating TypeScript definitions: ${(e as Throwable).message}`);
        (e as Exception).printStackTrace()
        throw e;
    }
}

const packageName = "jvm-types"
const path = ScriptManager.INSTANCE.root.path;

// @ts-expect-error
if (Java.type("java.lang.System").getenv("CI_BUILD")) {
    work(path, packageName)
    mc.close();
}

script.registerCommand({
    name: "ts-defgen",
    aliases: ["tsgen"],
    parameters: [
    ],
    onExecute() {
        UnsafeThread.run(() => work(path, packageName));
    }
});
