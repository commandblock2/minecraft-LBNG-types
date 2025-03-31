# minecraft-LBNG-types

---

**DISCLAIMER: Use this at your own risk!!! This is an unofficial project not endorsed by Mojang or fabric developers. This repo does NOT**  
- **contains any generated minecraft type definitions by itself**
- **redistribute the game itself**
- **guarentee the correctness of the generated definition**

---

This repo contains 
- instruction and scripts for creating typescript definitions
    - for Minecraft (with mods*)
    - for LiquidBounce NextGen
    - for everything inside of the jvm
- typescript definitions for **embedded context** of LiquidBounce NextGen scriptAPI
- a set of manually maintained patches to make the script api work properly
- a set of examples LiquidBounce NextGen script using typescript 
- a compiler script that will compile all the .ts files into .js files that could run in graaljs (LiquidBounce NextGen runtime) with watch mode
- some prompt files to use on LLMs, specifically for claude + continue.dev vscode extension, at [.continue/prompts](.continue/prompts).

Note: the mods are only limited to those presented at the development environment of LiquidBounce NextGen.

**When writing your script in typescript, expect inconsistencies with script API in js, but please report them to this repo if you can**

## Instruction (subject to change)

Adjust the order flexibly to your needs.

### Generating the typescript definitions

1. Setup development environment for Liquidbounce NextGen
2. **Clone LBNG**, run `git checkout 451cb31e9bf093fe07f9b28202bc2471921ea13d` (for version 0.29.0 release) and launch with gradle `./gradlew runClient` without intellij idea(recommened because of the sheer amount of memory it takes to generate the definition).
3. Place the `LBNG-script/ts-defgen.js` in your script folder for LiquidBounce
4. Build or [download the latest released ts-generator jar from github](https://github.com/commandblock2/ts-generator/releases), place it in your script folder as well.
5. Do a `.script reload` in your client, this should load the `ts-defgen.js`
6. Run the `.ts-defgen` command

7. See messages from chat and wait for around a few minute or more or less depending on your setup, this may take a while and also nearly 7GB of additional RAM (other than your intellij idea plus the what Minecraft needs in it's original state, causes OOM for me a lot of times xD).

Now you can find a `types-gen` folder in your script folder, this contains the generated typescript definitions.
```
.
├── ts-defgen.js
├── ts-generator-1.1.1.jar
└── types-gen
    └── minecraft-yarn-definitions
        ├── package.json
        ├── tsconfig.json
        └── types
            ├── ai
            ├── com
            ├── _COROUTINE
            ├── de
            ├── io
            ├── it
            ├── java
            ├── javax
            ├── jdk
            ├── joptsimple
            ├── kotlin
            ├── kotlinx
            ├── net
            ├── okhttp3
            ├── okio
            ├── org
            ├── oshi
            └── sun
├── ... other scripts.js

```

### Writing scripts with TypeScript Support

1. Run `npm install` in this directory.
2. copy the generated folder `types-gen` to `generated-modules` folder in the root of your project.
3. Run the script `apply-patch` with `npm run apply-patches`
4. Run `npm install file:./generated-modules/types-gen/minecraft-yarn-definitions/ --no-save`, no-save for now, not sure if I should do this.
5. Open the `template.ts` file and try start writing your script, you should see TypeScript type hints for all the classes that are available. vscode will automatically generate working imports, but **you should not touch the import statement with `@embedded` namespace.**
6. Run the script `compile` with npm like step 4 or `npm run watch`
7. Corresponding javascript file is generated in the `dist` directory, you can link this dist directory to your scripts directory in LB.


## Contribution and TODOs

If you know how to better organize this project (architecture), please feel free to submit a PR.

If you find errors on generated definitions about Minecraft classes or LiquidBounce classes, please file your tick at [ts-generator](https://github.com/commandblock2/ts-generator/issues).

If you find a un-intended behavior in the `ts-defgen.js`, compile script or manually maintained definitions(TODO), please file an issue here.


## License

This project is licensed under the GNU General Public license, see LICENSE for more information.