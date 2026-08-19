function hasTimezone(value: string): boolean {
    const tPos = value.indexOf('T');
    const tail = tPos >= 0 ? value.slice(tPos + 1) : value;
    return /Z$/i.test(tail) || /[+-]\d{2}:?\d{2}$/.test(tail);
}

// Серверные naive-даты считаем UTC. Явную таймзону всегда сохраняем.
export function parseApiDate(value?: string): Date | null {
    if (!value) return null;

    const trimmed = value.trim();
    const normalized = hasTimezone(trimmed) ? trimmed : `${trimmed}Z`;
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return null;

    return date;
}

// Расписание ANDE без таймзоны уже задано в локальном времени устройства.
export function parseApiLocalDate(value?: string): Date | null {
    if (!value) return null;

    const trimmed = value.trim();
    const normalized = hasTimezone(trimmed)
        ? trimmed
        : /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
            ? `${trimmed}T00:00:00`
            : trimmed.replace(/^(\d{4}-\d{2}-\d{2})\s/, '$1T');
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return null;

    return date;
}

export function formatDateTime24(value?: string): string {
    const date = parseApiDate(value);
    return formatDateTime24Value(date);
}

export function formatLocalDateTime24(value?: string): string {
    const date = parseApiLocalDate(value);
    return formatDateTime24Value(date);
}

function formatDateTime24Value(date: Date | null): string {
    if (!date) return 'No especificado';

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${day}.${month}.${year}, ${hours}:${minutes}`;
}

// Общий хелпер относительного времени ("Hace N min/h/d"). Отрицательный diff
// (дата в будущем из-за рассинхрона часов) трактуем как 0, а не как ошибку.
export function relativeTime(value?: string, opts?: { justNow?: string }): string {
    const date = parseApiDate(value);
    if (!date) return '';

    const diff = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    if (diff < 60) return opts?.justNow ?? 'Ahora';
    if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
    return `Hace ${Math.floor(diff / 86400)} d`;
}

export function ageMinutes(value?: string): number {
    const date = parseApiDate(value);
    if (!date) return 0;
    return Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
}
