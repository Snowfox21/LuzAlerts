// Форматирует числовой id в hex-идентификатор фиксированной минимальной длины
// (дополняем нулями слева), чтобы "Vecino #A" не выглядел как ошибка.
// Id длиннее MIN_LENGTH не обрезаем.
const MIN_LENGTH = 4;

export const formatVecinoId = (id: number): string => {
    return id.toString(16).toUpperCase().padStart(MIN_LENGTH, '0');
};
