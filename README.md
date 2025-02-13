# minecraft-LBNG-types

This repo contains 
- instruction and scripts for creating 
    - typescript definitions for Minecraft (with mods*)
    - typescript definitions for LiquidBounce NextGen
- typescript definitions for embedded context of LiquidBounce NextGen scriptAPI
- a set of manually maintained patches to make the script api work properly
- a set of examples LiquidBounce NextGen script using typescript 
- a compiler script that will compile all the .ts files into .js files that could run in graaljs (LiquidBounce NextGen runtime)

Note: the mods are only limited to those presented at the development environment of LiquidBounce NextGen.

**When writing your script in typescript, expect inconsistencies with script API in js, but please report them to this repo if you can**

## Instruction (subject to change)

Adjust the order flexibly to your needs.

### Generating the typescript definitions

1. Setup development environment for Liquidbounce NextGen
2. Launch Minecraft with LiquidBounce NextGen with gradle (either with your intellij idea or `./gradlew runClient` or whatever on Windows), this is for un-obfuscated names
3. Place the `LBNG-script/ts-defgen.js` in your script folder for LiquidBounce
4. Build or [download the ts-generator jar from github action](https://github.com/commandblock2/ts-generator/actions), place it in your script folder as well.
5. Do a `.script reload` in your client, this should load the `ts-defgen.js`
6. Find the `ts-defgen` module and configure the path and point it to your script folder (Don't change the NPM package name (as of now))

7. Enable the module and see your client freeze (for around 30 seconds or more or less depending on your setup)

Now you can find a `types-gen` folder in your script folder, this contains the generated typescript definitions.
```
.
├── ts-defgen.js
├── ts-generator-1.0.0.jar
└── types-gen
    └── minecraft-yarn-definitions
        ├── package.json
        ├── tsconfig.json
        └── types
            ├── com
            │   ├── google
            │   ├── llamalad7
            │   ├── mojang
            │   ├── terraformersmc
            │   └── viaversion
            ├── io
            │   └── netty
            ├── it
            │   └── unimi
            ├── java
            │   ├── awt
            │   ├── io
            │   ├── lang
            │   ├── math
            │   ├── net
            │   ├── nio
            │   ├── security
            │   ├── text
            │   ├── time
            │   └── util
            ├── javax
            │   ├── crypto
            │   ├── security
            │   └── sound
            ├── jdk
            │   └── internal
            ├── kotlin
            │   ├── Function.d.ts
            │   ├── Pair.d.ts
            │   ├── Result$Companion.d.ts
            │   ├── Result.d.ts
            │   ├── Triple.d.ts
            │   ├── Unit.d.ts
            │   ├── jvm
            │   ├── ranges
            │   └── reflect
            ├── net
            │   ├── caffeinemc
            │   ├── ccbluex
            │   ├── fabricmc
            │   └── minecraft
            ├── org
            │   ├── apache
            │   ├── graalvm
            │   ├── joml
            │   ├── lwjgl
            │   ├── objectweb
            │   ├── slf4j
            │   └── spongepowered
            ├── oshi
            │   ├── PlatformEnum.d.ts
            │   ├── SystemInfo.d.ts
            │   ├── hardware
            │   └── software
            └── sun
                ├── invoke
                ├── java2d
                ├── net
                ├── nio
                ├── reflect
                └── util

```

### Writing scripts with TypeScript Support

1. Run `npm install` in this directory.
2. copy the generated folder `types-gen` to `generated-modules` folder in the root of your project.
3. Run the script `apply-patch` with `npm run apply-patches`
4. Run `npm install file:./generated-modules/types-gen/minecraft-yarn-definitions/ --no-save`, no-save for now, not sure if I should do this.
5. Open the `template.ts` file and try start writing your script, you should see TypeScript type hints for all the classes that are available. vscode will automatically generate working imports, but **you should not touch the import statement with `@embedded` namespace.**
6. Run the script `compile` with npm like step 4
7. Corresponding javascript file is generated in the `dist` directory, you can link this dist directory to your scripts directory in LB.


## Contribution and TODOs

If you know how to better organize this project (architecture), please feel free to submit a PR.

If you find errors on generated definitions about Minecraft classes or LiquidBounce classes, please file your tick at [ts-generator](https://github.com/commandblock2/ts-generator/issues).

If you find a un-intended behavior in the `ts-defgen.js`, compile script or manually maintained definitions(TODO), please file an issue here.


## License

This project is licensed under the GNU General Public license, see LICENSE for more information.