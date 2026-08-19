import AsyncStorage from '@react-native-async-storage/async-storage';

const MY_REPORTS_KEY = '@luzalerts_my_reports';

// Бэкенд не отдает device_id в списке репортов, поэтому "свои" репорты
// помним локально: сохраняем id сразу после успешного создания.
let cachedIds: Set<number> | null = null;
// Промис первой загрузки: параллельные вызовы переиспользуют один набор id
let inFlight: Promise<Set<number>> | null = null;
// Изменения выполняем по очереди, чтобы записи в AsyncStorage не обгоняли друг друга
let mutationQueue: Promise<void> = Promise.resolve();

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

const resolveMyReportIds = async (): Promise<Set<number>> => {
    try {
        return parseIds(await AsyncStorage.getItem(MY_REPORTS_KEY));
    } catch {
        return new Set();
    }
};

export const getMyReportIds = async (): Promise<Set<number>> => {
    if (cachedIds) return cachedIds;
    if (inFlight) return inFlight;

    inFlight = resolveMyReportIds()
        .then(ids => {
            cachedIds = ids;
            return ids;
        })
        .finally(() => {
            inFlight = null;
        });

    return inFlight;
};

const enqueueMutation = (mutate: (ids: Set<number>) => boolean): Promise<void> => {
    const operation = mutationQueue.then(async () => {
        const ids = await getMyReportIds();
        if (!mutate(ids)) return;
        await persist(ids);
    });
    mutationQueue = operation.catch(() => {});
    return operation;
};

export const addMyReportId = async (id: number): Promise<void> => {
    if (!Number.isFinite(id)) return;
    await enqueueMutation(ids => {
        if (ids.has(id)) return false;
        ids.add(id);
        return true;
    });
};

export const removeMyReportId = async (id: number): Promise<void> => {
    await enqueueMutation(ids => ids.delete(id));
};

export const isMyReport = async (id: number): Promise<boolean> => {
    const ids = await getMyReportIds();
    return ids.has(id);
};
