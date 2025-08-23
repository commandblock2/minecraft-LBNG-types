import { RotationManager } from "jvm-types/net/ccbluex/liquidbounce/utils/aiming/RotationManager";
import { Rotation } from "jvm-types/net/ccbluex/liquidbounce/utils/aiming/data/Rotation";
import { KillAuraRotationsConfigurable } from "jvm-types/net/ccbluex/liquidbounce/features/module/modules/combat/killaura/KillAuraRotationsConfigurable";
import { Priority } from "jvm-types/net/ccbluex/liquidbounce/utils/kotlin/Priority";
import { ClientModule } from "jvm-types/net/ccbluex/liquidbounce/features/module/ClientModule";
import { ScriptParameterValidator } from "jvm-types/net/ccbluex/liquidbounce/script/bindings/api/ScriptParameterValidator";

const script = registerScript.apply({
    name: "silent-rotations",
    version: "1.0.0",
    authors: ["Roo"]
});

script.registerModule({
    name: "SilentRotations",
    description: "A module to demonstrate silent rotations.",
    category: "Combat", // Or any other suitable category
    settings: {
        yaw: Setting.float({
            name: "Yaw",
            default: 0.0,
            range: [-180.0, 180.0],
            suffix: "degrees"
        }),
        pitch: Setting.float({
            name: "Pitch",
            default: 0.0,
            range: [-90.0, 90.0],
            suffix: "degrees"
        })
    }
}, (mod) => {
    mod.on("enable", () => {
        Client.displayChatMessage("SilentRotations module enabled.");
    });

    mod.on("disable", () => {
        Client.displayChatMessage("SilentRotations module disabled.");
        // Optionally reset rotations when disabled
        RotationManager.INSTANCE.setRotationTarget(
            new Rotation(mc.player?.yaw!, mc.player?.pitch!, true),
            false,
            KillAuraRotationsConfigurable.INSTANCE,
            Priority.NOT_IMPORTANT, // Lower priority for resetting
            mod,
            null
        );
    });

    mod.on("gametick", () => {
        if (!mc.player || !mc.world) return;

        const targetYaw = mod.settings.yaw.getValue();
        const targetPitch = mod.settings.pitch.getValue();

        const rotation = new Rotation(targetYaw, targetPitch, true);

        // Set the rotation silently
        RotationManager.INSTANCE.setRotationTarget(
            rotation,
            false, // considerInventory: false to always rotate
            KillAuraRotationsConfigurable.INSTANCE,
            Priority.IMPORTANT_FOR_USAGE_2, // High priority like KillAura
            mod,
            null // No action when reached
        );
    });
});

