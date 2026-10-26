import apiClient from '../api/client';
import { getOrCreateDeviceId } from '../utils/device';
import { FoundAddress, TrackedPlace } from './places';

/**
 * Радиус и вкл/выкл у каждого места (экран "Mis zonas").
 *
 * Поля необязательные: старый бэкенд их не отдает. Тогда переключателя нет,
 * а радиус показывается общий — notify_radius_m пользователя.
 */
export interface PlaceSettings {
    radius_m?: number;
    enabled?: boolean;
}

export type TrackedPlaceWithSettings = TrackedPlace & PlaceSettings;

/** Чипы радиуса из макета; бэкенд принимает ровно эти значения. */
export const PLACE_RADIUS_STEPS_M = [1000, 2000, 5000, 10000];
export const DEFAULT_PLACE_RADIUS_M = 2000;

export async function updateTrackedPlace(placeId: number, patch: PlaceSettings): Promise<TrackedPlaceWithSettings> {
    const id = await getOrCreateDeviceId();
    const { data } = await apiClient.patch<TrackedPlaceWithSettings>(`/users/${id}/places/${placeId}`, patch);
    return data;
}

/** Как addTrackedPlace, но сразу со своим радиусом (старый бэкенд его игнорирует). */
export async function addTrackedPlaceWithRadius(place: FoundAddress, radius_m: number): Promise<TrackedPlaceWithSettings> {
    const id = await getOrCreateDeviceId();
    const { data } = await apiClient.post<TrackedPlaceWithSettings>(`/users/${id}/places`, { ...place, radius_m });
    return data;
}
