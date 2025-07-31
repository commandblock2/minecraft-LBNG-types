import { BaritoneAPI } from "jvm-types/baritone/api/BaritoneAPI"
import { GoalXZ } from "jvm-types/baritone/api/pathing/goals/GoalXZ"

const script = registerScript.apply({
    name: "baritone-api-example",
    version: "1.0.0",
    authors: ["commandblock2"]
});

script.registerModule({
    name: "baritone-api-example",
    description: "Baritone example module",
    category: "Client",

}, (mod) => {
    mod.on("enable", () => {
        BaritoneAPI.getSettings().allowSprint.value = true;
        BaritoneAPI.getSettings().primaryTimeoutMS.value = Primitives.long(2000);
        const baritone = BaritoneAPI.getProvider().getPrimaryBaritone();
        baritone.getCustomGoalProcess().setGoalAndPath(new GoalXZ(100, 100))
    })
})

export { }