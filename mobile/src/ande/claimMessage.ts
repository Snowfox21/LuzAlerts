import { parseApiDate } from '../utils/date';
import { isValidNis } from './nis';

export const ANDE_WHATSAPP_DISPLAY = '0962 160 160';
export const ANDE_WHATSAPP_URL = 'https://wa.me/595962160160';
export const ANDE_PHONE_DISPLAY = '160';
export const ANDE_PHONE_URL = 'tel:160';

// Paraguay usa UTC-3 todo el año desde octubre de 2024 (ley 7344).
const PARAGUAY_OFFSET_MIN = -3 * 60;

export type ClaimScope = 'block' | 'house';

export interface ClaimReport {
    latitude: number;
    longitude: number;
    street: string | null;
    house: string | null;
    barrio: string | null;
    city: string | null;
    created_at: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

function paraguayParts(date: Date) {
    const shifted = new Date(date.getTime() + PARAGUAY_OFFSET_MIN * 60000);
    return {
        dayKey: Math.floor(shifted.getTime() / 86400000),
        day: shifted.getUTCDate(),
        month: shifted.getUTCMonth() + 1,
        hours: shifted.getUTCHours(),
        minutes: shifted.getUTCMinutes(),
    };
}

export function formatSince(createdAt: string, now: Date = new Date()): string | null {
    const date = parseApiDate(createdAt);
    if (!date) return null;
    const at = paraguayParts(date);
    const today = paraguayParts(now);
    const time = `${pad(at.hours)}:${pad(at.minutes)}`;
    if (at.dayKey === today.dayKey) return `hoy a las ${time}`;
    if (at.dayKey === today.dayKey - 1) return `ayer a las ${time}`;
    return `el ${pad(at.day)}/${pad(at.month)} a las ${time}`;
}

export function formatClaimAddress(r: ClaimReport): string | null {
    const street = [r.street, r.house].filter(Boolean).join(' ');
    const parts = [street, r.barrio ? `barrio ${r.barrio}` : null, r.city].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
}

export function buildClaimMessage(report: ClaimReport, opts: {
    scope: ClaimScope;
    nis?: string | null;
    now?: Date;
}): string {
    const address = formatClaimAddress(report);
    const since = formatSince(report.created_at, opts.now);
    const withNis = opts.scope === 'house' && isValidNis(opts.nis);

    const lines = [
        'Buenas. Quiero reportar falta de energía eléctrica.',
        '',
        address ? `📍 Dirección: ${address}` : null,
        `🗺️ Ubicación: https://maps.google.com/?q=${report.latitude.toFixed(6)},${report.longitude.toFixed(6)}`,
        since ? `🕒 Sin luz desde ${since}` : null,
        withNis ? `🔢 NIS: ${opts.nis}` : null,
        opts.scope === 'block' ? '🏘️ Se cortó en toda la cuadra.' : '🏠 Por ahora solo en mi casa.',
        '',
        '¿Me pasan el número de reclamo, por favor? Gracias.',
    ];
    return lines.filter((line): line is string => line !== null).join('\n');
}
