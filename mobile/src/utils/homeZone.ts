import AsyncStorage from '@react-native-async-storage/async-storage';

// Грубая рамка Парагвая: отсекает "человек уехал в Европу", а не
// приграничные районы соседей — для этого хватает.
export const PARAGUAY_BOUNDS = {
    minLat: -27.7,
    maxLat: -19.0,
    minLon: -62.9,
    maxLon: -54.1,
};

export function isWithinParaguay(lat: number, lon: number): boolean {
    return lat >= PARAGUAY_BOUNDS.minLat
        && lat <= PARAGUAY_BOUNDS.maxLat
        && lon >= PARAGUAY_BOUNDS.minLon
        && lon <= PARAGUAY_BOUNDS.maxLon;
}

/**
 * "Mi zona": точка, вокруг которой приходят пуши и на которую открывается
 * карта, если человек за пределами Парагвая (следит за домом или родными
 * из-за границы).
 *
 * manual=true — зону выбрали руками в Ajustes. Такую зону автоматическое
 * обновление по GPS при запуске больше не трогает: иначе поездка по городу
 * переносила бы "дом" вслед за телефоном.
 */
export interface HomeZone {
    latitude: number;
    longitude: number;
    label: string | null;
    manual: boolean;
}

export const HOME_ZONE_KEY = '@luzalerts_home_zone';

export async function getHomeZone(): Promise<HomeZone | null> {
    try {
        const raw = await AsyncStorage.getItem(HOME_ZONE_KEY);
        return raw ? (JSON.parse(raw) as HomeZone) : null;
    } catch {
        return null;
    }
}

export async function setHomeZone(zone: HomeZone): Promise<void> {
    try {
        await AsyncStorage.setItem(HOME_ZONE_KEY, JSON.stringify(zone));
    } catch {}
}

/**
 * Что из GPS можно отправить серверу как точку для пушей.
 *
 * null — не трогать то, что уже лежит на сервере: телефон за пределами
 * Парагвая (иначе пуши о доме перестанут приходить, пока человек в
 * поездке) или зона выбрана руками.
 */
export async function zoneFromGps(latitude: number, longitude: number): Promise<{ latitude: number; longitude: number } | null> {
    if (!isWithinParaguay(latitude, longitude)) return null;
    const current = await getHomeZone();
    if (current?.manual) return null;
    const moved = !current || Math.abs(current.latitude - latitude) > 0.005 || Math.abs(current.longitude - longitude) > 0.005;
    // Подпись зоны сохраняем, пока телефон не сдвинулся заметно (~500 м).
    await setHomeZone({ latitude, longitude, label: moved ? null : current.label, manual: false });
    return { latitude, longitude };
}
