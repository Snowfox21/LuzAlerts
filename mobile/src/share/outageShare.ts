import { Linking, Share } from 'react-native';

import apiClient from '../api/client';
import { Outage, OutageSource, OutageStatus } from '../api/types';
import { parseApiLocalDate } from '../utils/date';
import { shareWithFallback } from './shareReport';

/**
 * Шеринг корта (ANDE или вечинального) в WhatsApp: "Abu, mañana cortan la
 * luz en tu barrio". Сообщение — для семьи, а не для соседей: у корта ANDE
 * нечего "подтверждать", человеку нужны время, зона и ссылка на карту.
 *
 * Ссылка — share_url с бэкенда (luzalerts.lat/o/{id}: og-превью в WhatsApp,
 * App Link в приложение). Старый бэкенд ее не отдает — тогда собираем сами.
 */

/** Смещение id вечинальных меток в общем списке кортов (см. бэкенд /outages). */
export const CROWDSOURCE_ID_OFFSET = 1000000;

export const outageShareUrl = (outage: Outage): string =>
    outage.share_url || `https://luzalerts.lat/o/${outage.id}`;

const STATUS_LINE: Record<OutageStatus, string> = {
    [OutageStatus.PLANNED]: 'Corte programado',
    [OutageStatus.ACTIVE]: 'Corte de luz activo',
    [OutageStatus.RESOLVED]: 'Volvió la luz',
};

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** "hoy", "mañana" или "jue 30/10" — так пишут в семейном чате, не "30.10.2026". */
function dayLabel(d: Date, now = new Date()): string {
    const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const days = Math.round((startOf(d) - startOf(now)) / 86400000);
    if (days === 0) return 'hoy';
    if (days === 1) return 'mañana';
    const weekday = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'][d.getDay()];
    return `${weekday} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

/** "mañana 09:00 – 13:00" или null, если у корта нет расписания. */
export function outageScheduleLabel(outage: Pick<Outage, 'scheduled_start' | 'scheduled_end'>): string | null {
    const start = parseApiLocalDate(outage.scheduled_start);
    const end = parseApiLocalDate(outage.scheduled_end);
    if (start && end) {
        const sameDay = start.toDateString() === end.toDateString();
        return sameDay
            ? `${dayLabel(start)} ${hhmm(start)} – ${hhmm(end)}`
            : `${dayLabel(start)} ${hhmm(start)} – ${dayLabel(end)} ${hhmm(end)}`;
    }
    if (start) return `desde ${dayLabel(start)} ${hhmm(start)}`;
    if (end) return `hasta ${dayLabel(end)} ${hhmm(end)}`;
    return null;
}

export function buildOutageShareMessage(outage: Outage, url: string): string {
    const source = outage.source === OutageSource.CROWDSOURCE ? 'reportado por vecinos' : 'ANDE';
    const place = outage.barrio?.trim() || outage.title?.trim() || 'tu zona';
    const schedule = outageScheduleLabel(outage);

    const lines = [
        `⚡ ${STATUS_LINE[outage.status] ?? STATUS_LINE[OutageStatus.ACTIVE]} · ${source}`,
        `📍 ${place}`,
    ];
    if (schedule) lines.push(`🕘 ${schedule}`);
    lines.push('', `Mirá el mapa y los detalles en LuzAlerts 👇`, url);
    return lines.join('\n');
}

/**
 * WhatsApp с откатом на системный лист. Вечинальную метку шарим ее же
 * ссылкой /r/{code}: там og-превью и кнопка "yo también".
 */
export async function shareOutage(outage: Outage, via: 'whatsapp' | 'sheet' = 'whatsapp'): Promise<boolean> {
    if (outage.source === OutageSource.CROWDSOURCE && outage.id > CROWDSOURCE_ID_OFFSET) {
        const reportId = outage.id - CROWDSOURCE_ID_OFFSET;
        try {
            const { data } = await apiClient.get<{ share_url?: string | null; barrio?: string | null; city?: string | null }>(
                `/reports/${reportId}`,
            );
            if (data?.share_url) {
                return shareWithFallback({ reportId, url: data.share_url, place: data.barrio ?? data.city });
            }
        } catch {
            // Нет сети или старая метка без кода — шерим как обычный корт.
        }
    }

    const message = buildOutageShareMessage(outage, outageShareUrl(outage));
    if (via === 'whatsapp') {
        try {
            // canOpenURL без queries в манифесте врет на Android — сразу открываем.
            await Linking.openURL(`whatsapp://send?text=${encodeURIComponent(message)}`);
            return true;
        } catch {
            // WhatsApp не установлен — дальше системный лист.
        }
    }
    try {
        const result = await Share.share({ message });
        return result.action === Share.sharedAction;
    } catch {
        return false;
    }
}
