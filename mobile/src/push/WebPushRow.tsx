import React, { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BellRing, Share } from 'lucide-react-native';
import { DS } from '../components/DesignSystem';
import { disableWebPush, enableWebPush, getWebPushState, WebPushState } from './webPush';

const COPY: Record<WebPushState, { label: string; sub: string }> = {
    'needs-install': {
        label: 'Instalá LuzAlerts para recibir avisos',
        sub: 'En Safari tocá Compartir y después "Agregar a pantalla de inicio". Abrí LuzAlerts desde el ícono y activá las notificaciones acá.',
    },
    default: {
        label: 'Activar notificaciones',
        sub: 'Tocá para recibir avisos de cortes cerca tuyo.',
    },
    granted: {
        label: 'Notificaciones activadas',
        sub: 'Te avisamos cuando haya cortes cerca tuyo. Tocá para desactivarlas.',
    },
    off: {
        label: 'Notificaciones desactivadas',
        sub: 'Tocá para volver a activarlas.',
    },
    denied: {
        label: 'Notificaciones bloqueadas',
        sub: 'Habilitalas en Ajustes > Notificaciones > LuzAlerts.',
    },
    unsupported: {
        label: 'Notificaciones no disponibles',
        sub: 'Este navegador no soporta avisos push.',
    },
};

/** Строка настроек PWA: статус Web Push и кнопка включения (только web). */
export function WebPushRow() {
    const [state, setState] = useState<WebPushState>(() => getWebPushState());
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Разрешение могли поменять в системных настройках, пока PWA была в фоне.
    useEffect(() => {
        const sub = AppState.addEventListener('change', s => {
            if (s === 'active') setState(getWebPushState());
        });
        return () => sub.remove();
    }, []);

    const onPress = () => {
        if (busy || !(state === 'default' || state === 'off' || state === 'granted')) return;
        setBusy(true);
        setError(null);
        // Без await до вызова: enableWebPush сам первым делом спрашивает
        // разрешение, пока iOS еще считает это ответом на тап.
        (state === 'granted' ? disableWebPush() : enableWebPush())
            .then(setState)
            .catch(() => setError('No se pudo activar. Probá de nuevo.'))
            .finally(() => setBusy(false));
    };

    const copy = COPY[state];
    const Icon = state === 'needs-install' ? Share : BellRing;
    const color = state === 'granted' ? DS.greenLight : state === 'denied' ? DS.redLight : state === 'off' ? DS.textMuted : DS.amber;

    return (
        <TouchableOpacity style={styles.row} onPress={onPress} disabled={!(state === 'default' || state === 'off' || state === 'granted') || busy} activeOpacity={0.7}>
            <Icon size={20} color={color} />
            <View style={styles.text}>
                <Text style={styles.label}>{copy.label}</Text>
                <Text style={styles.sub}>{error ?? copy.sub}</Text>
            </View>
            {busy ? <ActivityIndicator size="small" color={DS.amber} /> : null}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    row: {
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: DS.border,
    },
    text: {
        flex: 1,
    },
    label: {
        color: DS.text,
        fontSize: 15,
    },
    sub: {
        color: DS.textMuted,
        fontSize: 12,
        lineHeight: 17,
        marginTop: 2,
    },
});
