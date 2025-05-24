// PolyglotScript augmentation - adds improved module and command registration types

import type { ScriptModule } from '../types/net/ccbluex/liquidbounce/script/bindings/features/ScriptModule';
import type { Value } from '../types/net/ccbluex/liquidbounce/config/types/Value';
import type { Value as PolyglotValue } from '../types/org/graalvm/polyglot/Value';
import type { Unit } from '../types/kotlin/Unit';

// Helper type to convert settings object to values
type SettingsToValues<T> = {
    [K in keyof T]: T[K] extends Value<any> ? T[K] : never;
}

// Module configuration object
interface ModuleObject<TSettings = any> {
    name: string;
    category: string;
    description: string;
    settings?: TSettings
}

// Command parameter structure
interface CommandParameter {
    name: string;
    required?: boolean;
    validate?: (str: string) => PolyglotValue;
    vararg?: boolean;
    getCompletions?: (begin: string, args: any[]) => string[];
}

// Command configuration object
interface CommandObject {
    name: string;
    aliases?: string[];
    parameters?: CommandParameter[];
    onExecute: (...parameters: any[]) => void;
    subcommands?: CommandObject[];
    hub?: boolean;
}

declare module '../types/net/ccbluex/liquidbounce/script/PolyglotScript' {
    interface PolyglotScript {
        // Override the registerCommand method with improved typing
        registerCommand(commandObject: CommandObject): Unit;
        
        // Override the registerModule method with improved typing
        registerModule<TSettings>(
            moduleObject: ModuleObject<TSettings>, 
            callback: (module: ScriptModule & { settings: SettingsToValues<TSettings> }) => void
        ): Unit;
    }
}
