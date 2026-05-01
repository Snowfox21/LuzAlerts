import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const DEVICE_ID_KEY = '@luzalerts_device_id';

let cachedDeviceId: string | null = null;

export const getOrCreateDeviceId = async (): Promise<string> => {
    if (cachedDeviceId) return cachedDeviceId;
    try {
        let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
        if (!deviceId) {
            deviceId = Crypto.randomUUID();
            await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
        }
        cachedDeviceId = deviceId;
        return deviceId;
    } catch {
        // AsyncStorage unavailable — generate once per session
        if (!cachedDeviceId) cachedDeviceId = Crypto.randomUUID();
        return cachedDeviceId;
    }
};
