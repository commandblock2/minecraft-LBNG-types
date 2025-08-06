import { BaritoneAPI } from "jvm-types/baritone/api/BaritoneAPI"
import { GoalXZ } from "jvm-types/baritone/api/pathing/goals/GoalXZ"
import { BetterBlockPos } from "jvm-types/baritone/api/utils/BetterBlockPos"
import { IPath } from "jvm-types/baritone/api/pathing/calc/IPath"
import { PathCalculationResult$Type } from "jvm-types/baritone/api/utils/PathCalculationResult$Type"

import { VisualizationManager } from "lbng-utils-typed/dist/visualization-utils"

// note: this import is not from baritone-api jar
// it is only presented in the baritone-unoptimized jar
// as the `AStarPathFinder` class is possibly obfuscated in the baritone-standalone jar
// so you will have to install the baritone-unoptimized jar to use this import
import { AStarPathFinder } from "jvm-types/baritone/pathing/calc/AStarPathFinder"
import { Favoring } from "jvm-types/baritone/utils/pathing/Favoring"
import { CalculationContext } from "jvm-types/baritone/pathing/movement/CalculationContext"



const script = registerScript.apply({
    name: "astar-pathfinder-example",
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

script.registerModule({
    name: "astar-pathfinder-example",
    description: "Direct AStarPathFinder construction example",
    category: "Client",
    settings: {
        goalX: Setting.float({
            name: "Goal X",
            default: 100,
            range: [-10000, 10000] // Assuming a reasonable range
        }),
        goalZ: Setting.float({
            name: "Goal Z",
            default: 100,
            range: [-10000, 10000] // Assuming a reasonable range
        }),
        recalculateInterval: Setting.int({
            name: "Recalculate Interval (ticks)",
            default: 20,
            range: [1, 200]
        })
    }
}, (mod) => {

    const viz = new VisualizationManager(mod);

    let previousPath: IPath | null = null;

    let lastRecalculateTick = 0;

    const calculatePath = () => {
        const baritone = BaritoneAPI.getProvider().getPrimaryBaritone();

        // Get current player position
        const playerPos = baritone.getPlayerContext().playerFeet();
        const start = new BetterBlockPos(playerPos.getX(), playerPos.getY(), playerPos.getZ());

        // Create calculation context for threaded use
        const context = new CalculationContext(baritone, true);

        // Create favoring (empty favoring at first run for no preferences)
        const favoring = new Favoring(baritone.getPlayerContext(), previousPath as unknown as IPath, context);

        // Create goal using settings
        const goal = new GoalXZ(mod.settings.goalX.get(), mod.settings.goalZ.get());

        // Construct AStarPathFinder directly
        const pathfinder = new AStarPathFinder(
            start,           // realStart
            start.getX(),    // startX
            start.getY(),    // startY
            start.getZ(),    // startZ
            goal,            // goal
            favoring,        // favoring
            context          // context
        );

        // @ts-expect-error
        UnsafeThread.run(() => {
            const result = pathfinder.calculate(Primitives.long(2000), Primitives.long(5000));

            // Handle result
            if (result.getType() != PathCalculationResult$Type.CANCELLATION) {
                const path = result.getPath().get();
                console.log("Path found! Length: " + path.length());
                mc.execute(() => {
                    viz.addVisualization({
                        lineData: {
                            positions: path.positions().map((pos) => new Vec3d(pos.x + .5, pos.y, pos.z + .5)),

                        },
                        durationTicks: 20 * 60,
                    });
                    previousPath = path;
                });
                // Use the path as needed - you now have direct access without execution
            } else {
                console.log("Path calculation failed: " + result.getType().toString());
            }
        });
    };

    mod.on("enable", () => {
        viz.clearAllVisualizations();
        lastRecalculateTick = 0; // Reset on enable
        calculatePath(); // Initial calculation
    });

    mod.on("gametick", () => {
        if (mc.player && mc.world && (mc.player.age - lastRecalculateTick) >= (mod.settings.recalculateInterval.get() as unknown as number)) {
            calculatePath();
            lastRecalculateTick = mc.player.age;
        }
    });
});

export { }