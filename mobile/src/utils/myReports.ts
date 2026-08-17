import AsyncStorage from '@react-native-async-storage/async-storage';

const MY_REPORTS_KEY = '@luzalerts_my_reports';

// Бэкенд не отдает device_id в списке репортов, поэтому "свои" репорты
// помним локально: сохраняем id сразу после успешного создания.
let cachedIds: Set<number> | null = null;

const parseIds = (raw: string | null): Set<number> => {
    if (!raw) return new Set();
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return new Set();
        return new Set(parsed.filter((id): id is number => typeof id === 'number'));
    } catch {
        return new Set();
    }
};

const persist = async (ids: Set<number>): Promise<void> => {
    try {
        await AsyncStorage.setItem(MY_REPORTS_KEY, JSON.stringify([...ids]));
    } catch {
        // AsyncStorage недоступен — остаемся с кешем в памяти на эту сессию
    }
};

export const getMyReportIds = async (): Promise<Set<number>> => {
    if (cachedIds) return cachedIds;
    try {
        cachedIds = parseIds(await AsyncStorage.getItem(MY_REPORTS_KEY));
    } catch {
        cachedIds = new Set();
    }
    return cachedIds;
};

export const addMyReportId = async (id: number): Promise<void> => {
    if (!Number.isFinite(id)) return;
    const ids = await getMyReportIds();
    if (ids.has(id)) return;
    ids.add(id);
    await persist(ids);
};

export const removeMyReportId = async (id: number): Promise<void> => {
    const ids = await getMyReportIds();
    if (!ids.delete(id)) return;
    await persist(ids);
};

export const isMyReport = async (id: number): Promise<boolean> => {
    const ids = await getMyReportIds();
    return ids.has(id);
};
