// PolyglotScript$RegisterScript augmentation - improves script registration typing

import type { PolyglotScript } from '../types/net/ccbluex/liquidbounce/script/PolyglotScript';

// Script info type definition
type ScriptInfo = {
    name: string;
    version: string;
    authors: string[];
};

declare module '../types/net/ccbluex/liquidbounce/script/PolyglotScript$RegisterScript' {
    interface PolyglotScript$RegisterScript {
        // Override apply method with improved typing
        apply(scriptObject: ScriptInfo): PolyglotScript;
    }
}