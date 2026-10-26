/**
 * Web Push для PWA (iOS Safari "На экран Домой").
 *
 * Параллельно нативному Expo Push -> FCM: подписка уходит на бэкенд
 * отдельным полем web_push_subscription, fcm_token не трогается.
 * На нативных платформах все функции — no-op.
 *
 * Ограничения iOS, под которые все устроено:
 * - Push API есть только у PWA, установленной на домашний экран
 *   (display-mode: standalone). В обычной вкладке Safari просить
 *   разрешение бессмысленно — вместо этого показываем инструкцию.
 * - Notification.requestPermission() iOS принимает только из жеста
 *   пользователя (тап по кнопке), поэтому на старте приложения мы лишь
 *   обновляем уже выданную подписку, а запрос живет в enableWebPush().
 */
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import apiClient from '../api/client';
import { getOrCreateDeviceId } from '../utils/device';
import { zoneFromGps } from '../utils/homeZone';

export type WebPushState =
    | 'unsupported' // не веб или браузер без Push API
    | 'needs-install' // iOS Safari во вкладке: сначала "На экран Домой"
    | 'default' // можно спросить разрешение
    | 'granted'
    | 'off' // разрешение есть, но пользователь сам отключил пуши в приложении
    | 'denied';

const SW_URL = '/app/sw.js';
const OFF_KEY = 'luzalerts.webpush.off';

// Отключение живет локально: после unsubscribe() разрешение браузера остается
// 'granted', и без флага старт приложения тут же подписал бы заново.
const isOptedOut = (): boolean => {
    try {
        return window.localStorage.getItem(OFF_KEY) === '1';
    } catch {
        return false;
    }
};
const setOptedOut = (value: boolean) => {
    try {
        if (value) window.localStorage.setItem(OFF_KEY, '1');
        else window.localStorage.removeItem(OFF_KEY);
    } catch {
        // приватный режим: флаг просто не переживет перезапуск
    }
};

const isWeb = () => Platform.OS === 'web' && typeof window !== 'undefined';

export function isStandalone(): boolean {
    if (!isWeb()) return false;
    const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    return iosStandalone || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

export function isIos(): boolean {
    if (!isWeb()) return false;
    const ua = window.navigator.userAgent;
    // iPadOS маскируется под Mac, отличаем по тач-экрану
    return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

const hasPushApi = () =>
    isWeb() && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export function getWebPushState(): WebPushState {
    if (!isWeb()) return 'unsupported';
    // В iOS-вкладке PushManager нет вовсе, поэтому проверка установки идет
    // раньше проверки API: иначе человек увидит "не поддерживается" вместо
    // подсказки, как это починить.
    if (isIos() && !isStandalone()) return 'needs-install';
    if (!hasPushApi()) return 'unsupported';
    if (Notification.permission === 'granted' && isOptedOut()) return 'off';
    return Notification.permission as WebPushState;
}

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (!isWeb() || !('serviceWorker' in navigator)) return Promise.resolve(null);
    if (!registrationPromise) {
        registrationPromise = navigator.serviceWorker
            .register(SW_URL, { scope: '/app/' })
            .then(() => navigator.serviceWorker.ready)
            .catch(err => {
                console.warn('Service worker registration failed:', err);
                registrationPromise = null;
                return null;
            });
    }
    return registrationPromise;
}

const base64UrlToUint8Array = (value: string): Uint8Array<ArrayBuffer> => {
    const padding = '='.repeat((4 - (value.length % 4)) % 4);
    const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = window.atob(base64);
    const out = new Uint8Array(new ArrayBuffer(raw.length));
    for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
    return out;
};

// Ключ берется с бэкенда, а не из бандла: ротация ключа не требует
// пересборки PWA.
async function fetchVapidPublicKey(): Promise<string> {
    const res = await apiClient.get<{ public_key: string }>('/config/vapid-public-key');
    return res.data.public_key;
}

/**
 * Текущая подписка в виде JSON-строки для бэкенда, или null.
 * Разрешение НЕ запрашивает: годится для вызова на старте приложения.
 */
export async function getWebPushSubscription(): Promise<string | null> {
    if (getWebPushState() !== 'granted') return null;
    try {
        const registration = await registerServiceWorker();
        if (!registration) return null;

        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
            const key = await fetchVapidPublicKey();
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: base64UrlToUint8Array(key),
            });
        }
        return JSON.stringify(subscription);
    } catch (err) {
        console.warn('Web push subscription failed:', err);
        return null;
    }
}

async function getCoordsIfGranted(): Promise<{ latitude: number; longitude: number } | null> {
    try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') return null;
        const pos =
            (await Location.getLastKnownPositionAsync()) ??
            (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        // Та же политика, что в useDeviceSetup: дом за границей не переезжает.
        return pos ? await zoneFromGps(pos.coords.latitude, pos.coords.longitude) : null;
    } catch {
        return null;
    }
}

/**
 * Включить уведомления по тапу пользователя: спросить разрешение,
 * подписаться и сохранить подписку на бэкенде.
 */
export async function enableWebPush(): Promise<WebPushState> {
    const state = getWebPushState();
    if (state === 'unsupported' || state === 'needs-install' || state === 'denied') return state;

    // Первым делом, до любых await: iOS засчитывает жест пользователя только
    // синхронно в обработчике тапа.
    const permission = state === 'granted' || state === 'off' ? 'granted' : await Notification.requestPermission();
    if (permission !== 'granted') return permission as WebPushState;

    setOptedOut(false);
    const subscription = await getWebPushSubscription();
    if (!subscription) throw new Error('No se pudo activar las notificaciones');

    const deviceId = await getOrCreateDeviceId();
    // Координаты шлем вместе с подпиской: пуши идут только пользователям с
    // известным положением, а если геолокацию выдали уже после первого
    // запуска, useDeviceSetup их еще не отправлял.
    const coords = await getCoordsIfGranted();
    await apiClient.post('/users/', { device_id: deviceId, web_push_subscription: subscription, ...(coords ?? {}) });
    return 'granted';
}

/** Отключить уведомления: отписать браузер, стереть подписку на сервере. */
export async function disableWebPush(): Promise<WebPushState> {
    setOptedOut(true);
    try {
        const registration = await registerServiceWorker();
        const subscription = await registration?.pushManager.getSubscription();
        await subscription?.unsubscribe();
    } catch (err) {
        console.warn('Web push unsubscribe failed:', err);
    }
    const deviceId = await getOrCreateDeviceId();
    await apiClient.delete(`/users/${deviceId}/web-push`).catch(err => {
        // 404: устройство на сервере не зарегистрировано, стирать нечего
        if (err?.response?.status !== 404) throw err;
    });
    return getWebPushState();
}
