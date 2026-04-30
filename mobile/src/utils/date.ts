export function formatDateTime24(value?: string): string {
    if (!value) return 'No especificado';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'No especificado';

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${day}.${month}.${year}, ${hours}:${minutes}`;
}
