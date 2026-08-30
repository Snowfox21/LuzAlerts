/**
 * Тексты для шеринга репорта в WhatsApp и контакты.
 *
 * Требования к языку — не косметика, а условие того, что сообщение
 * перешлют дальше:
 *  - voseo (vos/tenés/podés/confirmá/sumate). "tú" в Парагвае звучит
 *    как дубляж иностранного сериала, и сообщение читается как реклама;
 *  - "che" — парагвайское обращение к своему, из гуарани;
 *  - ANDE и жара — общий раздражитель, объединяющий соседей;
 *  - никакого корпоративного тона: это сообщение пишет сосед соседям
 *    в группу квартала, а не сервис мониторинга своим пользователям.
 */

export interface ShareMessageContext {
    /** Barrio или город метки. Подставляется в текст. */
    place?: string | null;
    /** Публичная ссылка на метку. */
    url: string;
    /** Сколько соседей уже подтвердили. */
    confirmations?: number;
}

const FALLBACK_PLACE = 'mi zona';

type Builder = (ctx: Required<Pick<ShareMessageContext, 'url'>> & {
    place: string;
    confirmations: number;
}) => string;

const BUILDERS: Builder[] = [
    // Соседский, короткий. Лучше всего заходит в группу квартала: его
    // дочитывают до ссылки и не воспринимают как рассылку.
    ({ place, url }) =>
        `⚡ Che, se cortó la luz acá en ${place}. ¿A vos también?\n\n` +
        `Confirmalo en LuzAlerts así vemos cuántos estamos sin luz en la zona 👇\n${url}`,

    // Эмоциональный: жара и дом. Работает в личных чатах и в семье.
    ({ place, url }) =>
        `😩 Otra vez sin luz en ${place}, y con este calor...\n\n` +
        `Si a vos también se te cortó, confirmalo acá. Cuantos más seamos, ` +
        `más claro queda que no es solo mi casa 👇\n${url}`,

    // Прагматичный: коллективный вес. Уместен, когда подтверждения уже есть.
    ({ place, url, confirmations }) =>
        `⚡ Sin luz en ${place}.\n\n` +
        `Ya somos ${confirmations} vecinos reportando. Si estás sin luz, sumate — ` +
        `así sabemos si el corte es de todo el barrio o solo de casa 👇\n${url}`,
];

/**
 * Собрать текст сообщения.
 *
 * Вариант выбирается по данным, а не случайно: обещать "ya somos N vecinos"
 * при одном-единственном репорте — значит соврать в первом же сообщении,
 * которое человек отправит соседям.
 */
export const buildShareMessage = (ctx: ShareMessageContext): string => {
    const place = ctx.place?.trim() || FALLBACK_PLACE;
    const confirmations = ctx.confirmations ?? 0;

    const index = confirmations >= 2 ? 2 : 0;
    return BUILDERS[index]({ place, url: ctx.url, confirmations });
};

/** Вариант для явной кнопки "ещё раз попросить соседей" — более личный. */
export const buildEmotionalShareMessage = (ctx: ShareMessageContext): string =>
    BUILDERS[1]({
        place: ctx.place?.trim() || FALLBACK_PLACE,
        url: ctx.url,
        confirmations: ctx.confirmations ?? 0,
    });

export const SHARE_TITLE = 'Avisá a tus vecinos';
export const SHARE_SUBTITLE = 'Cuantos más confirmen, más rápido se detecta el corte.';
