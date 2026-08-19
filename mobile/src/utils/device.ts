import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';

const DEVICE_ID_KEY = '@luzalerts_device_id';

// Соль, чтобы наружу не уходил сырой ANDROID_ID
const DEVICE_ID_SALT = 'luzalerts.device.v1';

let cachedDeviceId: string | null = null;
// Промис первого вызова: параллельные вызовы переиспользуют его и получают один id
let inFlight: Promise<string> | null = null;

// Приводим hex-дайджест к форме UUID v4, чтобы формат id не отличался от Crypto.randomUUID()
const hexToUuid = (hex: string): string => {
    const h = hex.padEnd(32, '0').slice(0, 32);
    const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
    return [
        h.slice(0, 8),
        h.slice(8, 12),
        `4${h.slice(13, 16)}`,
        `${variant}${h.slice(17, 20)}`,
        h.slice(20, 32),
    ].join('-');
};

// Стабильный id из ANDROID_ID: переживает переустановку приложения
const deriveStableId = async (): Promise<string | null> => {
    if (Platform.OS !== 'android') return null;
    try {
        const androidId = Application.getAndroidId();
        if (!androidId) return null;
        const digest = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            `${DEVICE_ID_SALT}:${androidId}`,
        );
        return hexToUuid(digest.toLowerCase());
    } catch {
        return null;
    }
};

const resolveDeviceId = async (): Promise<string> => {
    try {
        // Уже сохраненный id не трогаем: к нему привязаны существующие репорты
        const stored = await AsyncStorage.getItem(DEVICE_ID_KEY);
        if (stored) return stored;

        const deviceId = (await deriveStableId()) ?? Crypto.randomUUID();
        await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
        return deviceId;
    } catch {
        // AsyncStorage недоступен — пробуем стабильный id, иначе один раз на сессию
        return (await deriveStableId()) ?? Crypto.randomUUID();
    }
};

export const getOrCreateDeviceId = async (): Promise<string> => {
    if (cachedDeviceId) return cachedDeviceId;
    if (inFlight) return inFlight;

    inFlight = resolveDeviceId()
        .then(id => {
            cachedDeviceId = id;
            return id;
        })
        .finally(() => {
            inFlight = null;
        });

    return inFlight;
};
