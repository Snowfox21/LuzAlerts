import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import apiClient from '../api/client';
// Единая реализация id устройства: своя копия здесь давала гонку на старте
import { getOrCreateDeviceId } from '../utils/device';

async function getExpoPushToken(): Promise<string | null> {
    if (Platform.OS === 'web') return null;

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') return null;

    try {
        const token = await Notifications.getExpoPushTokenAsync();
        return token.data;
    } catch (e) {
        console.warn('Could not get Expo push token:', e);
        return null;
    }
}

async function getUserLocation(): Promise<{ latitude: number; longitude: number } | null> {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    try {
        const pos =
            (await Location.getLastKnownPositionAsync()) ??
            (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        return pos ? { latitude: pos.coords.latitude, longitude: pos.coords.longitude } : null;
    } catch {
        return null;
    }
}

export function useDeviceSetup() {
    useEffect(() => {
        (async () => {
            try {
                const [deviceId, pushToken, location] = await Promise.all([
                    getOrCreateDeviceId(),
                    getExpoPushToken(),
                    getUserLocation(),
                ]);

                await apiClient.post('/users/', {
                    device_id: deviceId,
                    fcm_token: pushToken,
                    latitude: location?.latitude ?? null,
                    longitude: location?.longitude ?? null,
                });
            } catch (err) {
                // Non-critical — app works without notifications
                console.warn('Device setup failed:', err);
            }
        })();
    }, []);
}
