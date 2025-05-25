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
- instruction to use the generated typescript definitions
    - for Minecraft (with mods*)
    - for LiquidBounce NextGen
    - for everything inside of the jvm
- a set of typescript augmentation to give type hints properlly, some of these are manually maintained files
- a set of examples LiquidBounce NextGen script using typescript (of my personal convenience)
- a github CI pipeline for generating the definitions
- some prompt files to use on LLMs, specifically for claude + continue.dev vscode extension, at [.continue/prompts](.continue/prompts).

Note:
- As of now, the generated definition serves better purpose for auto completion, instead of type checking. 
- the mods are only limited to those presented at the development environment of LiquidBounce NextGen.

**When writing your script in typescript, expect inconsistencies with script API in js, but please report them to this repo if you can**

## Instruction (subject to change)

Adjust the order flexibly to your needs.

### Writing scripts with TypeScript Support

1. Create a nodejs project with typescript support
    - install nodejs
    - create a nodejs project: `npm init -y`
    - install typescript: `npm install typescript`
    - run `tsc --init`, it will create a tsconfig.json
    - specify your source directory in tsconfig.json
    ```json
    ...
    "include": ["src/**/*"]
    // or any other directory that's not src
    ...
    ```
    - optionally toggle inline source map in tsconfig.json (Strongly recommened, because you are very likely to need to use the debugger, although not as convenient as it is in js)
    ```json
    ...
    "inlineSourceMap": true,
    "inlineSources": true,
    ...
    ```
    - optionally point the out directory to your    liquidbounce script directory if you want to use with hot-reload
    ```json
    ...
    "outDir": "./dist",
    // your path to .minecraft/LiquidBounce/scripts
    // or link the dist to the script folder if you are using Linux and wish to not pollute the tsconfig.json
    ...
    ```
2. Download and install the typescript definitions npm package
    - Go to https://github.com/commandblock2/minecraft-LBNG-types/actions and download the artifacts (no npm package at the moment, might change later)
    - unzip the `jvm-types` to a directory
    - run `npm install file:./path/to/jvm-types --no-save` (if we were to have a npm package, we can just do `npm install` without `--no-save`)

3. Write the scripts with typescript support
    - open the ide of your choice (tested on vscode)
    - open the script folder
    - run `npx tsc --watch` at the project root folder
    - `.js` files will be produced in the dist folder

4. (Optional) Use hot reloader
    - add this repo as a dev dependency: `npm install git+https://github.com/commandblock2/minecraft-lbng-types.git --save-dev`
    - run `npm run lb-hotreload-watch`
    - copy the [LBNG-script/hot-reloader.js](LBNG-script/hot-reloader.js) into your script directory
    - enable the module script hot reloader in LiquidBounce after a `.script reload`
    - start modifying your existing script (does not work with newly created scripts yet)


### Current limitations

vscode typescript language server sometimes will break itself due to how large the jvm codebase is, you might have to reload the window or restart the ts server maybe.

the definitions are far from perfect for type checking purpose, we might need more considerations for 

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

- You will need a bit more prompt than writing kotlin directly when vibe coding.

- For generating the definitions (but we already have a working github action pipline so not much of a problem here)
    1. it needs to be generated in a development environment (no remapping support has been added atm)
    2. it takes like 7GB of additional memory on it's own and almost 20 min (on my machine) to generate the whole definitions for classes on that jvm
    3. it needs to rely on a external jar (FOSS and currently maintained(technically haven't been update for quite a while) by me), to generate the definitions
    4. it needs some manual maintenance for the ScriptApi specific definitions (like `Settings.int`) or something like that




## Contribution and TODOs

Maintainance notes:
To update the augmentations, you should directly go to your `node_modules/@types/jvm-types/augmentations/` directory to edit the augmentation.d.ts files, and later copy it to the root of this directory, if you are on *nix, there is a shell script (a single cp command) to do that with `./script/copy-augmentations.sh`(run in the root of this project).

Move the npm packaging logic out of the github actions files, so that it maybe easier to maintain.

If you have extra time/energy, please help me investigate the possibility of generating perfect typescript definition that will 
- precisely represent the jvm content
- work with the bean access of graaljs
- be 100% syntatically correct for the typescript compiler

and preferbly rewrite in pure typescript with partial npm ecosystem.

If you find a un-intended behavior in the `ts-defgen.js`, compile script or manually maintained definitions(TODO), please file an issue here.


## License

This project is licensed under the GNU General Public license, see LICENSE for more information.
