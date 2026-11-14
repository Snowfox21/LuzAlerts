import { parseApiDate } from '../utils/date';

export const ANDE_WHATSAPP_DISPLAY = '0962 160 160';
export const ANDE_PHONE_DISPLAY = '160';

export interface ComplaintReport {
    latitude: number;
    longitude: number;
    street: string | null;
    house: string | null;
    barrio: string | null;
    city: string | null;
    created_at: string;
}

export interface ComplaintOptions {
    nis?: string | null;
    wholeBlock: boolean;
    now?: Date;
}

const pad = (n: number) => String(n).padStart(2, '0');

function sameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function formatSince(createdAt: string, now: Date = new Date()): string | null {
    const date = parseApiDate(createdAt);
    if (!date) return null;
    const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    if (sameDay(date, now)) return `hoy a las ${time}`;
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (sameDay(date, yesterday)) return `ayer a las ${time}`;
    return `el ${pad(date.getDate())}/${pad(date.getMonth() + 1)} a las ${time}`;
}

export function formatComplaintAddress(r: ComplaintReport): string | null {
    const street = [r.street, r.house].filter(Boolean).join(' ');
    const parts = [street, r.barrio ? `barrio ${r.barrio}` : null, r.city].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
}

export function buildAndeComplaint(report: ComplaintReport, opts: ComplaintOptions): string {
    const address = formatComplaintAddress(report);
    const since = formatSince(report.created_at, opts.now);
    const nis = opts.nis?.trim();
    const lat = report.latitude.toFixed(6);
    const lng = report.longitude.toFixed(6);

    const lines = [
        'Buenas. Quiero reportar falta de energía eléctrica.',
        '',
        address ? `📍 Dirección: ${address}` : null,
        `🗺️ Ubicación: https://maps.google.com/?q=${lat},${lng}`,
        since ? `🕒 Sin luz desde ${since}` : null,
        nis ? `🔢 NIS: ${nis}` : null,
        opts.wholeBlock ? '🏘️ Se cortó en toda la cuadra.' : '🏠 Por ahora solo en mi casa.',
        '',
        '¿Me pasan el número de reclamo, por favor? Gracias.',
    ];
    return lines.filter((line): line is string => line !== null).join('\n');
}
