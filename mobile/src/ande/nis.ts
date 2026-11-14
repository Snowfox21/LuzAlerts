import AsyncStorage from '@react-native-async-storage/async-storage';

export const NIS_KEY = '@luzalerts_ande_nis';

export async function getNis(): Promise<string | null> {
    try {
        return (await AsyncStorage.getItem(NIS_KEY)) || null;
    } catch {
        return null;
    }
}

export async function setNis(value: string): Promise<void> {
    const clean = value.replace(/\D/g, '');
    if (clean) {
        await AsyncStorage.setItem(NIS_KEY, clean);
    } else {
        await AsyncStorage.removeItem(NIS_KEY);
    }
}
