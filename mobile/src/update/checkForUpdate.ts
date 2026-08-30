import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import {
    UpdateManifest,
    fetchManifest,
    getInstalledVersionCode,
} from './manifest';

const LAST_CHECK_KEY = '@luzalerts_update_last_check';
const SKIPPED_VERSION_KEY = '@luzalerts_update_skipped';

/** Автопроверка не чаще раза в сутки: манифест меняется куда реже. */
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

export interface UpdateCheckResult {
    manifest: UpdateManifest;
    installedVersionCode: number;
}

const readNumber = async (key: string): Promise<number | null> => {
    try {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) return null;
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : null;
    } catch {
        return null;
    }
};

const writeNumber = async (key: string, value: number): Promise<void> => {
    try {
        await AsyncStorage.setItem(key, String(value));
    } catch {
        // AsyncStorage недоступен — проверимся в следующий запуск
    }
};

/** Запомнить пропущенную версию. Обязательные обновления это не глушит. */
export const skipVersion = (versionCode: number): Promise<void> =>
    writeNumber(SKIPPED_VERSION_KEY, versionCode);

/**
 * Есть ли обновление.
 *
 * @param force  ручная проверка из настроек: игнорирует и суточный
 *               интервал, и ранее нажатое "Después".
 */
export const checkForUpdate = async (
    { force = false }: { force?: boolean } = {},
): Promise<UpdateCheckResult | null> => {
    // Механизм существует только ради сайдлоада APK.
    if (Platform.OS !== 'android') return null;

    const installed = getInstalledVersionCode();
    if (installed === null) return null;

    if (!force) {
        const lastCheck = await readNumber(LAST_CHECK_KEY);
        if (lastCheck !== null && Date.now() - lastCheck < CHECK_INTERVAL_MS) return null;
    }

    const manifest = await fetchManifest();
    // Отметку о проверке ставим только после реального похода в сеть,
    // иначе один offline-запуск подавил бы проверки на сутки вперед.
    if (!manifest) return null;
    await writeNumber(LAST_CHECK_KEY, Date.now());

    if (manifest.versionCode <= installed) return null;

    if (!force && !manifest.mandatory) {
        const skipped = await readNumber(SKIPPED_VERSION_KEY);
        if (skipped !== null && skipped >= manifest.versionCode) return null;
    }

    return { manifest, installedVersionCode: installed };
};
