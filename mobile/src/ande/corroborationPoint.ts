import AsyncStorage from '@react-native-async-storage/async-storage';

import { reverseGeocode } from '../utils/reverseGeocode';
import { ClaimReport } from './claimMessage';

const KEY_PREFIX = '@luzalerts_corroboration_point:';

let generation = 0;

const keyFor = (reportId: number) => `${KEY_PREFIX}${reportId}`;

async function write(reportId: number, point: ClaimReport, gen: number): Promise<void> {
    if (gen !== generation) return;
    await AsyncStorage.setItem(keyFor(reportId), JSON.stringify(point)).catch(() => {});
}

export async function forgetCorroborationPoints(): Promise<void> {
    generation += 1;
    try {
        const keys = await AsyncStorage.getAllKeys();
        await AsyncStorage.multiRemove(keys.filter(key => key.startsWith(KEY_PREFIX)));
    } catch {}
}

export async function getCorroborationPoint(reportId: number): Promise<ClaimReport | null> {
    try {
        const raw = await AsyncStorage.getItem(keyFor(reportId));
        const parsed = raw ? JSON.parse(raw) : null;
        return parsed && typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number' ? parsed : null;
    } catch {
        return null;
    }
}

export function rememberCorroborationPoint(
    reportId: number,
    latitude: number,
    longitude: number,
    onAddress: (point: ClaimReport) => void,
): ClaimReport {
    const gen = generation;
    const point: ClaimReport = {
        latitude,
        longitude,
        street: null,
        house: null,
        barrio: null,
        city: null,
        created_at: new Date().toISOString(),
    };
    const saved = write(reportId, point, gen);
    reverseGeocode(latitude, longitude)
        .then(async place => {
            if (!place || gen !== generation) return;
            const withAddress: ClaimReport = {
                ...point,
                street: place.street ?? null,
                house: place.streetNumber ?? null,
                barrio: place.district ?? null,
                city: place.city ?? place.subregion ?? null,
            };
            await saved;
            await write(reportId, withAddress, gen);
            onAddress(withAddress);
        })
        .catch(() => {});
    return point;
}
