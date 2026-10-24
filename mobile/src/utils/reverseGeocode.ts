import { Platform } from 'react-native';
import * as Location from 'expo-location';
import apiClient from '../api/client';

interface ServerAddress {
    barrio: string | null;
    street: string | null;
    city: string | null;
    department: string | null;
    house: string | null;
    country_code: string | null;
}

/**
 * Адрес по координатам, одинаково на всех платформах.
 *
 * В вебе (PWA) у expo-location нет reverseGeocodeAsync — он бросает
 * исключение, поэтому там спрашиваем бэкенд (/geocode/reverse, Nominatim)
 * и приводим ответ к форме LocationGeocodedAddress: вызывающий код не
 * различает платформы. null — адрес определить не удалось.
 */
export async function reverseGeocode(latitude: number, longitude: number): Promise<Location.LocationGeocodedAddress | null> {
    if (Platform.OS !== 'web') {
        const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
        return place ?? null;
    }

    const { data } = await apiClient.get<ServerAddress>('/geocode/reverse', { params: { lat: latitude, lon: longitude } });
    return {
        city: data.city,
        district: data.barrio,
        street: data.street,
        streetNumber: data.house,
        region: data.department,
        subregion: null,
        country: null,
        isoCountryCode: data.country_code,
        postalCode: null,
        name: null,
        timezone: null,
        formattedAddress: null,
    };
}
