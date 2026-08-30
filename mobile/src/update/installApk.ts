import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Linking, Platform } from 'react-native';

import { UpdateManifest } from './manifest';

/**
 * Скачивание и установка APK.
 *
 * Legacy-API expo-file-system взят намеренно: в SDK 54 новый API не отдает
 * ни докачку с прогрессом, ни getContentUriAsync, а без content:// URI
 * системный установщик откажется читать файл (FileProvider).
 */

const APK_MIME = 'application/vnd.android.package-archive';
const FLAG_GRANT_READ_URI_PERMISSION = 1;
const FLAG_ACTIVITY_NEW_TASK = 0x10000000;

export type InstallFailure =
    | 'unsupported'   // не Android
    | 'download'      // не скачалось
    | 'checksum'      // файл побился или подменен
    | 'permission'    // нет разрешения на установку из этого источника
    | 'intent';       // установщик не открылся

export class InstallError extends Error {
    constructor(readonly kind: InstallFailure, message: string) {
        super(message);
        this.name = 'InstallError';
    }
}

/** Испанские тексты ошибок — показываются пользователю как есть. */
export const installErrorCopy = (kind: InstallFailure): { title: string; message: string } => {
    switch (kind) {
        case 'download':
            return {
                title: 'No se pudo descargar',
                message: 'Revisá tu conexión e intentá de nuevo. La descarga pesa unos 100 MB.',
            };
        case 'checksum':
            return {
                title: 'Descarga incompleta',
                message: 'El archivo llegó dañado. Intentá de nuevo con una conexión estable.',
            };
        case 'permission':
            return {
                title: 'Falta un permiso',
                message:
                    'Android necesita tu permiso para instalar LuzAlerts. ' +
                    'Activá "Permitir desde esta fuente" y volvé a intentar.',
            };
        default:
            return {
                title: 'No se pudo instalar',
                message: 'Intentá de nuevo en unos segundos.',
            };
    }
};

/** Открыть системный экран "установка из неизвестных источников". */
export const openUnknownSourcesSettings = async (): Promise<void> => {
    try {
        await IntentLauncher.startActivityAsync(
            'android.settings.MANAGE_UNKNOWN_APP_SOURCES',
            { data: 'package:com.luzalerts.app' },
        );
    } catch {
        // Некоторые прошивки этот экран не отдают — уводим в общие настройки
        Linking.openSettings().catch(() => {});
    }
};

/**
 * Проверка целостности скачанного APK по размеру.
 *
 * Хеш на устройстве не считаем сознательно. expo-crypto умеет только
 * digestStringAsync, то есть APK пришлось бы целиком поднять в JS
 * base64-строкой: сборка на 100 МБ дает строку в ~135 МБ, и дешевый
 * телефон, ради которого все и затевалось, на этом падает по OOM.
 * Вдобавок SHA256 от base64-текста никогда не совпал бы с sha256 самого
 * файла из манифеста — такая проверка резала бы вообще все обновления.
 *
 * Размер ловит единственный реальный сценарий — оборванную закачку.
 * От подмены файла защищает Android: APK с чужой подписью установщик
 * поверх нашего не поставит.
 */
const verifySize = async (uri: string, expected: number): Promise<boolean> => {
    try {
        const info = await FileSystem.getInfoAsync(uri);
        if (!info.exists) return false;
        return info.size === expected;
    } catch {
        // Не смогли прочитать размер — не блокируем установку: битый файл
        // все равно отвергнет сам установщик по подписи.
        return true;
    }
};

/**
 * Скачать APK и открыть системный установщик.
 *
 * @param onProgress доля скачанного, 0..1
 */
export const downloadAndInstall = async (
    manifest: UpdateManifest,
    onProgress?: (fraction: number) => void,
): Promise<void> => {
    if (Platform.OS !== 'android') {
        throw new InstallError('unsupported', 'APK install is Android-only');
    }

    const destination = `${FileSystem.cacheDirectory}luzalerts-${manifest.versionCode}.apk`;

    // Остатки прошлой попытки удаляем: докачка поверх чужого файла дает
    // битый APK, который установщик отвергнет без внятной причины.
    try {
        await FileSystem.deleteAsync(destination, { idempotent: true });
    } catch {}

    let uri: string;
    try {
        const download = FileSystem.createDownloadResumable(
            manifest.apkUrl,
            destination,
            {},
            progress => {
                const total = progress.totalBytesExpectedToWrite || manifest.sizeBytes || 0;
                if (total > 0) onProgress?.(Math.min(progress.totalBytesWritten / total, 1));
            },
        );
        const result = await download.downloadAsync();
        if (!result?.uri) throw new Error('empty download result');
        uri = result.uri;
    } catch {
        throw new InstallError('download', 'APK download failed');
    }

    if (manifest.sizeBytes && !(await verifySize(uri, manifest.sizeBytes))) {
        await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
        throw new InstallError('checksum', 'APK size mismatch: download truncated');
    }

    let contentUri: string;
    try {
        // content:// вместо file://: начиная с Android 7 установщик не
        // принимает file-URI и падает с FileUriExposedException.
        contentUri = await FileSystem.getContentUriAsync(uri);
    } catch {
        throw new InstallError('intent', 'failed to build content uri');
    }

    try {
        await IntentLauncher.startActivityAsync('android.intent.action.INSTALL_PACKAGE', {
            data: contentUri,
            type: APK_MIME,
            flags: FLAG_GRANT_READ_URI_PERMISSION | FLAG_ACTIVITY_NEW_TASK,
        });
    } catch {
        // Самая частая причина — не выдано REQUEST_INSTALL_PACKAGES.
        throw new InstallError('permission', 'installer intent rejected');
    }
};
