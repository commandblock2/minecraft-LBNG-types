// ScriptSetting augmentation - adds improved setting type definitions

import type { Value } from '../types/net/ccbluex/liquidbounce/config/types/Value';
import type { ChooseListValue } from '../types/net/ccbluex/liquidbounce/config/types/ChooseListValue';
import type { NamedChoice } from '../types/net/ccbluex/liquidbounce/config/types/NamedChoice';
import type { RangedValue } from '../types/net/ccbluex/liquidbounce/config/types/RangedValue';
import type { MultiChooseStringListValue } from '../types/net/ccbluex/liquidbounce/config/types/MultiChooseStringListValue';
import type { ClosedFloatingPointRange } from '../types/kotlin/ranges/ClosedFloatingPointRange';
import type { InputUtil$Key } from '../types/net/minecraft/client/util/InputUtil$Key';

// Value configuration interfaces
interface BaseValue {
    name: string;
}

interface BooleanValue extends BaseValue {
    default: boolean;
}

interface ChooseValue extends BaseValue {
    default: string;
    choices: string[];
}

interface FloatValue extends BaseValue {
    default: number;
    range: [number, number];
    suffix?: string;
}

interface FloatRangeValue extends BaseValue {
    default: [number, number];
    range: [number, number];
    suffix?: string;
}

interface IntValue extends BaseValue {
    default: number;
    range: [number, number];
    suffix?: string;
}

interface IntRangeValue extends BaseValue {
    default: [number, number];
    range: [number, number];
    suffix?: string;
}

interface KeyValue extends BaseValue {
    default: string;
}

interface TextView extends BaseValue {
    default: string;
}

interface TextArrayValue extends BaseValue {
    default: string[];
}

interface ScriptMultiChooseStringListValue extends BaseValue {
    default: string[] | undefined;
    choices: string[];
    canBeNone: boolean | undefined;
}

declare module '../types/net/ccbluex/liquidbounce/script/bindings/features/ScriptSetting' {
    interface ScriptSetting {
        // Override methods with improved typing
        boolean(value: BooleanValue): Value<boolean>;
        choose(value: ChooseValue): ChooseListValue<NamedChoice>;
        float(value: FloatValue): RangedValue<number>;
        floatRange(value: FloatRangeValue): RangedValue<ClosedFloatingPointRange<number>>;
        int(value: IntValue): RangedValue<number>;
        intRange(value: IntRangeValue): RangedValue<number[]>;
        key(value: KeyValue): Value<InputUtil$Key>;
        text(value: TextView): Value<string>;
        textArray(value: TextArrayValue): Value<string[]>;
        multiChoose(value: ScriptMultiChooseStringListValue): MultiChooseStringListValue;
    }
}
