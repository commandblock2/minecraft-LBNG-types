# minecraft-LBNG-types


https://github.com/user-attachments/assets/a58c0e17-4eb4-4ce6-9c4a-04378f31e226


---

**DISCLAIMER: Use this at your own risk!!! This is an unofficial project not endorsed by Mojang or fabric developers. This repo does NOT**  
- **contains any generated minecraft type definitions by itself**
- **redistribute the game itself**
- **guarentee the correctness of the generated definition**

**The definition is generated from reflection, which is deobfuscated using the yarn mapping, in LBNG's context.**

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
2. **Clone LBNG**, run `git checkout 4f0aa0f02b37d9cc696b242c6c7a02811186df30` (for version 0.30.0 release) and launch with gradle `./gradlew runClient` without intellij idea(recommened because of the sheer amount of memory it takes to generate the definition).
3. Place the `LBNG-script/ts-defgen.js` in your script folder for LiquidBounce
4. Build or [download the latest released ts-generator jar from github](https://github.com/commandblock2/ts-generator/releases), place it in your script folder as well, rename it as `ts-generator.jar`
5. Do a `.script reload` in your client, this should load the `ts-defgen.js`
6. Run the `.ts-defgen` command

7. See messages from chat and wait for around a few minute or more or less depending on your setup, this may take a while and also nearly 7GB of additional RAM (other than your intellij idea plus the what Minecraft needs in it's original state, causes OOM for me a lot of times xD).

Now you can find a `types-gen` folder in your script folder, this contains the generated typescript definitions.
```
.
├── ts-defgen.js
├── ts-generator.jar
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
3. Run the script `apply-patch` with `npm run apply-patches`, it if fails, probably just open a issue here.
4. Run `npm install file:./generated-modules/types-gen/minecraft-yarn-definitions/ --no-save`, no-save for now, not sure if I should do this.
5. Open the `template.ts` file and try start writing your script, you should see TypeScript type hints for all the classes that are available. vscode will automatically generate working imports, but **you should not touch the import statement with `@embedded` namespace.**
6. Run the script `compile` with npm like step 4 or `npm run watch`
7. Corresponding javascript file is generated in the `dist` directory, you might want to link this dist directory to your scripts directory in LB.
8. Also enable ScriptHotReloader in LB if you can link the dist directory and use watch mode.


### Current limitations

1. it needs to be generated in a development environment (no remapping support has been added atm)
2. it takes like 7GB of additional memory on it's own and almost 20 min (on my machine) to generate the whole definitions for classes on that jvm
3. it needs to rely on a external jar (FOSS and currently maintained(technically haven't been update for quite a while) by me), to generate the definitions
4. it needs some manual maintenance for the ScriptApi specific definitions (like `Settings.int`) or something like that
5. it has a custom compiler (actually a script that calls `tsc` compiler api and transforms a bit of the script)
    - subsequently I have not yet figured out a proper source mapping(ts -> js) to be able to use when debugging in chromium. 
    - The resulted names in js are probably not so beautiful like `const packetEvent = new PacketEvent_1.PacketEvent(TransferOrigin_1.TransferOrigin.RECEIVE, element.packet, false);`.
6. the definitions are far from perfect for type checking purpose, we might need more considerations for 
    - nuances of difference of typescript oop model and jvm oop model  
    eg. 
        - You cannot have a static method in a interface in typescript but you can have that on jvm classes. 
        - graaljs bean access could sometimes have a different naming
        - Having method of the same name as a member variable is not allowed in ts (weird that ts does not allow this, or maybe it is linked to the one bellow)  
        - overriding a method in the base class and overloading (with different signature) could be problematic. 
        For a `const entity: LivingEntity = mc.player;`, it will give error of
        ```
        Type 'ClientPlayerEntity' is not assignable to type 'LivingEntity'.
        Types of property 'playSound' are incompatible.
            Type '(sound: SoundEvent, volume: number, pitch: number) => Unit' is not assignable to type '(sound: SoundEvent) => Unit'.
        ```
        in `LivingEntity` the method has a signature of `playSound(sound: SoundEvent): Unit;` and `playSound(sound: SoundEvent, volume: number, pitch: number): Unit;`. Therefore the ts type checker will emit a error, you can only do a `(mc.player as unknown as LivingEntity)` or live with the error (the compiler will still produce a valid js though).

7. I have not yet tried to get it working with webpack or something to allow it use a part of the npm ecosystem (using npm libraries in LiquidBounce scripts).
8. You will need a bit more prompt than writing kotlin directly when vibe coding.


## Contribution and TODOs

If you know how to better organize this project (architecture), please feel free to submit a PR.

If you find errors on generated definitions about Minecraft classes or LiquidBounce classes, please file your tick at [ts-generator](https://github.com/commandblock2/ts-generator/issues).

If you find a un-intended behavior in the `ts-defgen.js`, compile script or manually maintained definitions(TODO), please file an issue here.


## License

This project is licensed under the GNU General Public license, see LICENSE for more information.
