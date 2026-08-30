import * as Application from 'expo-application';

/**
 * Проверка обновлений вне Google Play.
 *
 * Приложение раздается APK-файлом с luzalerts.lat, поэтому догонять
 * пользователей новыми версиями некому: без этой проверки установка
 * навсегда остается на той версии, которую человек однажды скачал.
 *
 * Источник истины — versionCode из манифеста. Сравнивать versionName
 * строками нельзя: "1.10.0" строкой меньше "1.9.0".
 */

export const MANIFEST_URL = 'https://luzalerts.lat/dl/latest.json';

export interface UpdateManifest {
    versionCode: number;
    versionName: string;
    apkUrl: string;
    /**
     * Информационное поле: на устройстве не проверяется. Считать SHA256
     * от 100-мегабайтного APK в JS нечем (см. installApk.ts), целостность
     * закачки сверяем по sizeBytes.
     */
    sha256: string | null;
    /** Размер APK в байтах — по нему ловим оборванную закачку. */
    sizeBytes: number | null;
    /** Обязательное обновление пропустить нельзя (сломанная версия). */
    mandatory: boolean;
    /** Что нового — по-испански, показывается как есть. */
    notes_es: string;
}

const isManifest = (value: unknown): value is UpdateManifest => {
    if (typeof value !== 'object' || value === null) return false;
    const m = value as Record<string, unknown>;
    return (
        typeof m.versionCode === 'number' &&
        typeof m.versionName === 'string' &&
        typeof m.apkUrl === 'string' &&
        m.apkUrl.startsWith('https://')
    );
};

/** versionCode установленной сборки. null, если платформа его не отдает. */
export const getInstalledVersionCode = (): number | null => {
    const raw = Application.nativeBuildVersion;
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
};

export const getInstalledVersionName = (): string =>
    Application.nativeApplicationVersion ?? '—';

/** Скачать манифест. null — сети нет или отдали мусор; это не ошибка. */
export const fetchManifest = async (signal?: AbortSignal): Promise<UpdateManifest | null> => {
    try {
        const res = await fetch(MANIFEST_URL, { cache: 'no-store', signal });
        if (!res.ok) return null;
        const data = await res.json();
        if (!isManifest(data)) return null;
        return {
            ...data,
            sha256: typeof data.sha256 === 'string' ? data.sha256 : null,
            sizeBytes: typeof data.sizeBytes === 'number' ? data.sizeBytes : null,
            mandatory: data.mandatory === true,
            notes_es: typeof data.notes_es === 'string' ? data.notes_es : '',
        };
    } catch {
        return null;
    }
};
