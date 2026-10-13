import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import apiClient from '../api/client';
import { getWebPushSubscription, registerServiceWorker } from '../push/webPush';
// Единая реализация id устройства: своя копия здесь давала гонку на старте
import { getOrCreateDeviceId } from '../utils/device';

async function getExpoPushToken(): Promise<string | null> {
    // PWA пушится через Web Push (VAPID), не через Expo: см. getWebPushSubscription
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

                const payload: Record<string, unknown> = {
                    device_id: deviceId,
                    fcm_token: pushToken,
                    latitude: location?.latitude ?? null,
                    longitude: location?.longitude ?? null,
                };

                if (Platform.OS === 'web') {
                    // Service worker нужен PWA всегда (иначе пуш некому
                    // показать). Разрешение здесь не спрашиваем — iOS
                    // принимает запрос только из тапа, он живет в Ajustes.
                    // Уже выданную подписку просто досылаем: она могла
                    // смениться, пока приложение было закрыто.
                    await registerServiceWorker();
                    const webPushSubscription = await getWebPushSubscription();
                    if (webPushSubscription) payload.web_push_subscription = webPushSubscription;
                }

                await apiClient.post('/users/', payload);
            } catch (err) {
                // Non-critical — app works without notifications
                console.warn('Device setup failed:', err);
            }
        })();
    }, []);
}
