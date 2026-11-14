import AsyncStorage from '@react-native-async-storage/async-storage';

export const NIS_KEY = '@luzalerts_ande_nis';
export const NIS_LENGTH = 7;

export function cleanNis(value: string): string {
    return value.replace(/\D/g, '').slice(0, NIS_LENGTH);
}

export function isValidNis(value?: string | null): boolean {
    return !!value && /^\d{7}$/.test(value);
}

export async function getNis(): Promise<string | null> {
    try {
        const value = await AsyncStorage.getItem(NIS_KEY);
        return isValidNis(value) ? value : null;
    } catch {
        return null;
    }
}

export async function setNis(value: string): Promise<void> {
    const clean = cleanNis(value);
    if (isValidNis(clean)) {
        await AsyncStorage.setItem(NIS_KEY, clean);
    } else if (!clean) {
        await AsyncStorage.removeItem(NIS_KEY);
    }
}
