import * as Location from 'expo-location';
import apiClient from '../api/client';
import { getOrCreateDeviceId } from '../utils/device';
import { isWithinParaguay, setHomeZone } from '../utils/homeZone';
import { reverseGeocode } from '../utils/reverseGeocode';

/** Сколько мест можно отслеживать вдобавок к своей зоне (как на бэкенде). */
export const MAX_TRACKED_PLACES = 2;

export interface TrackedPlace {
    id: number;
    label: string;
    latitude: number;
    longitude: number;
}

export interface FoundAddress {
    latitude: number;
    longitude: number;
    /** Короткая подпись: "Villa Morra, Asunción". */
    label: string;
}

/** Адрес → координаты, только в Парагвае. null — не нашли. */
export async function searchAddress(query: string): Promise<FoundAddress | null> {
    try {
        const { data } = await apiClient.get<{ lat: number; lon: number; display_name: string | null }>(
            '/geocode/search',
            { params: { q: query } },
        );
        // "Luque, Departamento de Central, Paraguay" → "Luque, Central".
        const parts = (data.display_name ?? query)
            .split(',')
            .map(p => p.trim().replace(/^Departamento (de )?/i, ''))
            .filter(Boolean);
        return { latitude: data.lat, longitude: data.lon, label: parts.slice(0, 2).join(', ') || query };
    } catch (err: any) {
        if (err?.response?.status === 404) return null;
        throw err;
    }
}

/** Подпись места по координатам: "barrio, город" или сами координаты. */
export async function describeLocation(latitude: number, longitude: number): Promise<string> {
    try {
        const place = await reverseGeocode(latitude, longitude);
        const parts = [place?.district ?? place?.subregion, place?.city ?? place?.region].filter(Boolean);
        if (parts.length) return Array.from(new Set(parts)).join(', ');
    } catch {}
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}

export type GpsResult =
    | { kind: 'ok'; place: FoundAddress }
    | { kind: 'denied' }
    | { kind: 'outside' };

/** Текущее место телефона — только если он в Парагвае. */
export async function locateInParaguay(): Promise<GpsResult> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return { kind: 'denied' };
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const { latitude, longitude } = pos.coords;
    if (!isWithinParaguay(latitude, longitude)) return { kind: 'outside' };
    return { kind: 'ok', place: { latitude, longitude, label: await describeLocation(latitude, longitude) } };
}

/** "Mi zona", выбранная руками: на сервер (пуши) и локально (карта). */
export async function saveHomeZone(place: FoundAddress): Promise<void> {
    const id = await getOrCreateDeviceId();
    await apiClient.post('/users/', { device_id: id, latitude: place.latitude, longitude: place.longitude });
    await setHomeZone({ ...place, manual: true });
}

export async function listTrackedPlaces(): Promise<TrackedPlace[]> {
    const id = await getOrCreateDeviceId();
    const { data } = await apiClient.get<TrackedPlace[]>(`/users/${id}/places`);
    return data ?? [];
}

export async function addTrackedPlace(place: FoundAddress): Promise<TrackedPlace> {
    const id = await getOrCreateDeviceId();
    const { data } = await apiClient.post<TrackedPlace>(`/users/${id}/places`, place);
    return data;
}

export async function removeTrackedPlace(placeId: number): Promise<void> {
    const id = await getOrCreateDeviceId();
    await apiClient.delete(`/users/${id}/places/${placeId}`);
}
