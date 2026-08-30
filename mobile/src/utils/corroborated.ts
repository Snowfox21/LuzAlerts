import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Метки, которые это устройство уже подтвердило ("yo también estoy sin luz").
 *
 * Бэкенд отдаёт исходную метку и не сообщает, подтверждал ли её конкретный
 * телефон, — как и в случае со «своими» метками, помним локально.
 *
 * Без этого флаг подтверждения жил только в стейте экрана: стоило уйти и
 * вернуться, как снова появлялась кнопка «Yo también estoy sin luz», и
 * человек решал, что подтверждение не сохранилось. Данные при этом целы —
 * бэкенд идемпотентен, — но выглядит как потеря.
 */
const KEY = '@luzalerts_corroborated_reports';

let cached: Set<number> | null = null;
let inFlight: Promise<Set<number>> | null = null;

const read = async (): Promise<Set<number>> => {
    try {
        const raw = await AsyncStorage.getItem(KEY);
        if (!raw) return new Set();
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return new Set();
        return new Set(parsed.filter((id): id is number => typeof id === 'number'));
    } catch {
        return new Set();
    }
};

const load = async (): Promise<Set<number>> => {
    if (cached) return cached;
    if (inFlight) return inFlight;
    inFlight = read()
        .then(ids => {
            cached = ids;
            return ids;
        })
        .finally(() => {
            inFlight = null;
        });
    return inFlight;
};

export const markCorroborated = async (id: number): Promise<void> => {
    if (!Number.isFinite(id)) return;
    const ids = await load();
    if (ids.has(id)) return;
    ids.add(id);
    try {
        await AsyncStorage.setItem(KEY, JSON.stringify([...ids]));
    } catch {
        // AsyncStorage недоступен — остаёмся с набором в памяти на эту сессию
    }
};

export const hasCorroborated = async (id: number): Promise<boolean> => {
    return (await load()).has(id);
};
