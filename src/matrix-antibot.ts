import { GameProfile } from "@jvm/types/com/mojang/authlib/GameProfile";
import { UUID } from "@jvm/types/java/util/UUID";
import { PlayerListS2CPacket } from "@jvm/types/net/minecraft/network/packet/s2c/play/PlayerListS2CPacket";
import { PlayerRemoveS2CPacket } from "@jvm/types/net/minecraft/network/packet/s2c/play/PlayerRemoveS2CPacket";
import { ModuleAntiBot } from "@jvm/types/net/ccbluex/liquidbounce/features/module/modules/misc/antibot/ModuleAntiBot"
import { PlayerEntity } from "@jvm/types/net/minecraft/entity/player/PlayerEntity";
import { Throwable } from "@jvm/types/java/lang/Throwable";


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

        try {
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
        } catch (e: any) {
            Client.displayChatMessage((e as unknown as Throwable).toString())
        }


    })

    mod.on("tagentityevent", event => {

        if (botId && event.entity instanceof PlayerEntity && event.entity.getGameProfile().id == botId) {
            event.dontTarget()
        }
            
    })
})