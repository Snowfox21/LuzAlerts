import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const DEVICE_ID_KEY = '@luzalerts_device_id';

export const getOrCreateDeviceId = async (): Promise<string> => {
    try {
        let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
        if (!deviceId) {
            deviceId = Crypto.randomUUID();
            await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
        }
        return deviceId;
    } catch (e) {
        console.error('Error with Async Storage', e);
        return `fallback-${Crypto.randomUUID()}`;
    }
};
