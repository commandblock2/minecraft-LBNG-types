import { Entity } from "@jvm/types/net/minecraft/entity/Entity";
import { LivingEntity } from "@jvm/types/net/minecraft/entity/LivingEntity";


const script = registerScript.apply({
    name: "wtapbot",
    version: "1.0.0",
    authors: ["commandblock2"]
});

script.registerModule({
    name: "wtapbot",
    description: "Completely legit fight bot that uses wtap technique",
    category: "Combat",
    settings: {
    }

}, (mod) => {

    var target: LivingEntity | undefined = undefined

    mod.on("gametick", (event) => {

        if (!target) {

            const entityList = Array<LivingEntity>()
            mc.world.entityList.forEach((entity: Entity) => { if (entity instanceof LivingEntity) entityList.push(entity) });

            target = entityList.sort((a, b) => {
                return a.distanceTo(mc.player as unknown as Entity) - b.distanceTo(mc.player as unknown as Entity)
            }).at(0)
        }

        if (!target)
            return

    })


})