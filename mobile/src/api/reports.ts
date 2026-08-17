import axios from 'axios';
import { Alert } from 'react-native';
import apiClient from './client';
import { getOrCreateDeviceId } from '../utils/device';
import { removeMyReportId } from '../utils/myReports';

export interface ResolvedReport {
    id: number;
    resolved: boolean;
    resolved_at: string | null;
}

// Единая точка вызова закрытия репорта: ручка идемпотентна, повторный вызов тоже 200.
export const resolveReport = async (reportId: number): Promise<ResolvedReport> => {
    const deviceId = await getOrCreateDeviceId();
    const res = await apiClient.post<ResolvedReport>(`/reports/${reportId}/resolve`, { device_id: deviceId });
    return res.data;
};

const getResolveErrorCopy = (error: unknown): { title: string; message: string } => {
    if (axios.isAxiosError(error)) {
        const status = error.response?.status;

        if (status === 403) {
            return {
                title: 'No podes cerrar este reporte',
                message: 'Solo el autor puede cerrarlo desde el dispositivo con el que lo creo.',
            };
        }

        if (status === 404) {
            return {
                title: 'Reporte no encontrado',
                message: 'Este reporte ya no existe.',
            };
        }

        if (!error.response) {
            return {
                title: 'Sin conexion',
                message: 'No pudimos comunicarnos con el servidor. Revisa tu conexion e intenta de nuevo.',
            };
        }
    }

    return {
        title: 'Error',
        message: 'No pudimos cerrar el reporte. Intenta de nuevo en unos segundos.',
    };
};

// Подтверждение + запрос + разбор ошибок в одном месте, чтобы список и деталь не дублировали логику.
export const confirmAndResolveReport = (options: {
    reportId: number;
    onStart?: () => void;
    onResolved: (report: ResolvedReport) => void;
    onFinish?: () => void;
}): void => {
    const { reportId, onStart, onResolved, onFinish } = options;

    Alert.alert(
        '¿Ya volvio la luz?',
        'Vamos a cerrar tu reporte y dejara de aparecer en el mapa.',
        [
            { text: 'Todavia no', style: 'cancel' },
            {
                text: 'Si, cerrar',
                style: 'default',
                onPress: async () => {
                    onStart?.();
                    try {
                        onResolved(await resolveReport(reportId));
                    } catch (error) {
                        // 403 = устройство больше не автор, локальный реестр разъехался с сервером
                        if (axios.isAxiosError(error) && error.response?.status === 403) {
                            await removeMyReportId(reportId);
                        }
                        const copy = getResolveErrorCopy(error);
                        Alert.alert(copy.title, copy.message);
                    } finally {
                        onFinish?.();
                    }
                },
            },
        ],
    );
};
