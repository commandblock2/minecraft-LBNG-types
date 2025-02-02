// imports
/* eslint-disable unused-imports/no-unused-imports */
import {
    Setting,
    Vec3i,
    Vec3d,
    MathHelper,
    BlockPos,
    Hand,
    RotationAxis,
    mc,
    Client,
    RotationUtil,
    ItemUtil,
    NetworkUtil,
    InteractionUtil,
    BlockUtil,
    MovementUtil,
    ReflectionUtil,
    ParameterValidator,
    UnsafeThread,
    registerScript
} from "@embedded";
/* eslint-enable unused-imports/no-unused-imports */
// DO NOT TOUCH ANYTHING ABOVE THIS LINE, also not sure why it didn't work

import { Matrix2d } from "@minecraft-yarn-definitions/types/org/joml/Matrix2d";


const script = registerScript.apply({
    name: "example-complete",
    version: "1.0.0",
    authors: ["commandblock2", "ccbluex"]
});

script.registerModule({
    name: "example-typescript-module-complete",
    description: "Ths is an example module generated in ts", 
    category: "Client",
    settings: {
        fastSwing: Setting.boolean({
            name: "FastSwing",
            default: true
        }),
        range: Setting.float({
            name: "Range",
            default: 3.0,
            range: [0.5, 8.0],
            suffix: "blocks"
        }),
        randomness: Setting.floatRange({
            name: "Randomness",
            default: [2.3, 7.8],
            range: [0.0, 10.0],
            suffix: "jitter"
        }),
        expand: Setting.int({
            name: "Expand",
            default: 4,
            range: [0, 10],
            suffix: "blocks"
        }),
        cps: Setting.intRange({
            name: "CPS",
            default: [4, 10],
            range: [0, 20],
            suffix: "cps"
        }),
        key: Setting.key({
            name: "Key",
            default: "o"
        }),
        message: Setting.text({
            name: "Message",
            default: "This is a default message."
        }),
        messages: Setting.textArray({
            name: "Messages",
            default: ["This is a message", "This is another message"]
        }),
        animal: Setting.choose({
            name: "Animal",
            default: "Capybara",
            choices: ["Axolotl", "Capybara", "Snek"]
        })
    }

}, (mod) => {
    mod.on("enable", () => {
        const matrix2d = new Matrix2d(1, 3, 5, 3);
        Client.displayChatMessage(`${matrix2d} ${matrix2d instanceof Matrix2d}`);
        Client.displayChatMessage(`${mc.player?.abilities}`)
        Client.displayChatMessage(`${mc.player}`)

        Client.displayChatMessage(`FastSwing: ${mod.settings.fastSwing.getValue()}`);
        Client.displayChatMessage(`Range: ${mod.settings.range.getValue()}`);
        Client.displayChatMessage(`Randomness: ${mod.settings.randomness.getValue()}`);
        Client.displayChatMessage(`Expand: ${mod.settings.expand.getValue()}`);
        Client.displayChatMessage(`CPS: ${mod.settings.cps.getValue()}`);
        Client.displayChatMessage(`Key: ${mod.settings.key.getValue()}`);
        Client.displayChatMessage(`Message: ${mod.settings.message.getValue()}`);
        Client.displayChatMessage(`Messages: ${mod.settings.messages.getValue()}`);
        Client.displayChatMessage(`Animal: ${mod.settings.animal.getValue()}`);

        mod.settings.fastSwing.setValue(true);
        mod.settings.range.setValue(2.3);
        mod.settings.randomness.setValue([2, 4.34]);
        mod.settings.expand.setValue(2);
        mod.settings.cps.setValue([5, 12]);
        mod.settings.key.setValue("p");
        mod.settings.message.setValue("Axolotls are cool");
        mod.settings.messages.setValue(["New message 1", "New message 2"]);
        mod.settings.animal.setValue("Axolotl");
    });
    mod.on("disable", () => Client.displayChatMessage("disabled"))
    
})

script.registerCommand({
    name: "addition",
    aliases: ["add"],
    parameters: [{
        name: "a",
        required: true,
        validate: ParameterValidator.integer
    },
    {
        name: "b",
        required: true,
        validate: ParameterValidator.integer
    }
    ],
    onExecute(arg1: any, arg2: any) {
        Client.displayChatMessage(`Result of ${arg1} + ${arg2} is ${arg1 + arg2}`);
    }
});