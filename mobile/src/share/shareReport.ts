import { Linking, Platform, Share } from 'react-native';

import apiClient from '../api/client';
import { buildShareMessage, ShareMessageContext } from './messages';

/**
 * Шеринг метки: WhatsApp напрямую и системный share sheet для всего остального.
 *
 * Почему у Facebook отдельный путь: FB намеренно вырезает предзаполненный
 * текст из шеринга, sharer.php принимает только URL. Поэтому туда уходит
 * голая ссылка, а весь текст берется из og-тегов страницы /r/{code} —
 * их отдает бэкенд.
 */

const WHATSAPP_SCHEME = 'whatsapp://send';
const FACEBOOK_SHARER = 'https://www.facebook.com/sharer/sharer.php';

export interface ShareTarget extends ShareMessageContext {
    /** id метки — по нему считаем share_count на бэкенде. */
    reportId?: number;
}

/** Отметить факт шеринга. Тихо: провал счетчика не должен ломать шеринг. */
const trackShare = (reportId?: number): void => {
    if (typeof reportId !== 'number') return;
    apiClient.post(`/reports/${reportId}/shared`).catch(() => {});
};

/**
 * Открыть WhatsApp с готовым текстом.
 * Возвращает false, если WhatsApp не установлен — вызывающий код тогда
 * показывает системный лист, а не пустой алерт.
 */
export const shareToWhatsApp = async (target: ShareTarget): Promise<boolean> => {
    const message = buildShareMessage(target);
    const url = `${WHATSAPP_SCHEME}?text=${encodeURIComponent(message)}`;

    try {
        // canOpenURL на Android требует whatsapp в queries манифеста, и без
        // него честно вернет false даже на устройстве с WhatsApp. Поэтому
        // сначала пробуем открыть, а на отказе откатываемся на share sheet.
        await Linking.openURL(url);
        trackShare(target.reportId);
        return true;
    } catch {
        return false;
    }
};

/** Системный share sheet: контакты, Telegram, Messenger, SMS, что угодно. */
export const shareToSystemSheet = async (target: ShareTarget): Promise<boolean> => {
    const message = buildShareMessage(target);

    try {
        const result = await Share.share(
            // На iOS текст и ссылку разносим, иначе превью ссылки не строится.
            Platform.OS === 'ios' ? { message, url: target.url } : { message },
        );
        const shared = result.action === Share.sharedAction;
        if (shared) trackShare(target.reportId);
        return shared;
    } catch {
        return false;
    }
};

/**
 * Facebook. Текст сюда не передаем — он все равно будет отброшен;
 * что увидит читатель, решают og-теги страницы метки.
 */
export const shareToFacebook = async (target: ShareTarget): Promise<boolean> => {
    try {
        await Linking.openURL(`${FACEBOOK_SHARER}?u=${encodeURIComponent(target.url)}`);
        trackShare(target.reportId);
        return true;
    } catch {
        return false;
    }
};

/** WhatsApp с автоматическим откатом на системный лист. */
export const shareWithFallback = async (target: ShareTarget): Promise<boolean> => {
    if (await shareToWhatsApp(target)) return true;
    return shareToSystemSheet(target);
};
