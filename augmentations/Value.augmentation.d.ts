// Value augmentation - enhances Value type with improved type definitions

import type { ClosedFloatingPointRange } from '../types/kotlin/ranges/ClosedFloatingPointRange';
import type { InputUtil$Key } from '../types/net/minecraft/client/util/InputUtil$Key';
import type { NamedChoice } from '../types/net/ccbluex/liquidbounce/config/types/NamedChoice';
import type { Unit } from '../types/kotlin/Unit';

declare module '../types/net/ccbluex/liquidbounce/config/types/Value' {
    interface Value<T extends Object | number | string | boolean> {
        getValue(): T extends ClosedFloatingPointRange<number> ? number[] :
                T extends InputUtil$Key ? string :
                T extends NamedChoice ? string :
                T;

        setValue(value: T |
                (T extends ClosedFloatingPointRange<number> ? number[] : never) |
                (T extends InputUtil$Key ? string : never) |
                (T extends NamedChoice ? string : never)): Unit;
    }
}
