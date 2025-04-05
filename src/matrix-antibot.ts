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
    localStorage,
    registerScript
} from "@embedded";
import { GameProfile } from "@minecraft-yarn-definitions/types/com/mojang/authlib/GameProfile";
import { UUID } from "@minecraft-yarn-definitions/types/java/util/UUID";
import { PlayerListS2CPacket } from "@minecraft-yarn-definitions/types/net/minecraft/network/packet/s2c/play/PlayerListS2CPacket";
import { PlayerRemoveS2CPacket } from "@minecraft-yarn-definitions/types/net/minecraft/network/packet/s2c/play/PlayerRemoveS2CPacket";
import { ModuleAntiBot } from "@minecraft-yarn-definitions/types/net/ccbluex/liquidbounce/features/module/modules/misc/antibot/ModuleAntiBot"
import { PlayerEntity } from "@minecraft-yarn-definitions/types/net/minecraft/entity/player/PlayerEntity";
/* eslint-enable unused-imports/no-unused-imports */
// DO NOT TOUCH ANYTHING ABOVE THIS LINE, also not sure why it didn't work


const script = registerScript.apply({
    name: "matrix-antibot",
    version: "1.0.0",
    authors: ["commandblock2"]
});

script.registerModule({
    name: "matrix-antibot",
    description: "Example script of simplified matrix antibot, showing that script api have the capability of making a antibot", 
    category: "Client",

}, (mod) => {
    var botId: UUID | null = null

    mod.on("enable", () => {
        Client.displayChatMessage(`Hi, ${mc.player}`)
        botId = null
    })

    mod.on("packet", event => {
        if (event.packet instanceof PlayerListS2CPacket)
            event.packet.getPlayerAdditionEntries().forEach(entry => {
            const profile = entry.profile() as GameProfile | undefined;
            if (!profile)
                return

            if (!ModuleAntiBot.INSTANCE.isGameProfileUnique(profile) &&
                ModuleAntiBot.INSTANCE.isADuplicate(profile)) {
                    botId = profile.getId()
                    Client.displayChatMessage(`entity with ${profile.getName()} with id ${profile.id} is flagged as a bot (when creating the bot entity)`)
                }
                
        }
        )
    })

    mod.on("tagentityevent", event => {

        if (botId && event.entity instanceof PlayerEntity && event.entity.getGameProfile().id == botId) {
            event.dontTarget()
        }
            
    })
})