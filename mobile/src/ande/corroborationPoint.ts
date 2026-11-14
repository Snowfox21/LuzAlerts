import AsyncStorage from '@react-native-async-storage/async-storage';

import { reverseGeocode } from '../utils/reverseGeocode';
import { ClaimReport } from './claimMessage';

export const CORROBORATION_POINTS_KEY = '@luzalerts_corroboration_points';

type Points = Record<string, ClaimReport>;

async function readAll(): Promise<Points> {
    try {
        const raw = await AsyncStorage.getItem(CORROBORATION_POINTS_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

async function write(reportId: number, point: ClaimReport): Promise<void> {
    const all = await readAll();
    all[String(reportId)] = point;
    await AsyncStorage.setItem(CORROBORATION_POINTS_KEY, JSON.stringify(all)).catch(() => {});
}

export async function getCorroborationPoint(reportId: number): Promise<ClaimReport | null> {
    return (await readAll())[String(reportId)] ?? null;
}

export function rememberCorroborationPoint(
    reportId: number,
    latitude: number,
    longitude: number,
    onAddress: (point: ClaimReport) => void,
): ClaimReport {
    const point: ClaimReport = {
        latitude,
        longitude,
        street: null,
        house: null,
        barrio: null,
        city: null,
        created_at: new Date().toISOString(),
    };
    write(reportId, point);
    reverseGeocode(latitude, longitude)
        .then(place => {
            if (!place) return;
            const withAddress: ClaimReport = {
                ...point,
                street: place.street ?? null,
                house: place.streetNumber ?? null,
                barrio: place.district ?? null,
                city: place.city ?? place.subregion ?? null,
            };
            write(reportId, withAddress);
            onAddress(withAddress);
        })
        .catch(() => {});
    return point;
}
