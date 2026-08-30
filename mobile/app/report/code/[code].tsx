import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import apiClient from '../../../src/api/client';
import { DS, PrimaryButton, sharedStyles } from '../../../src/components/DesignSystem';
import { getOrCreateDeviceId } from '../../../src/utils/device';

/**
 * Переходник со ссылки из WhatsApp на экран метки.
 *
 * По ссылке https://luzalerts.lat/r/CODE приходит публичный код, а экран
 * метки работает с id. Резолвим код и сразу заменяем экран в стеке, чтобы
 * "назад" не возвращало на этот промежуточный шаг.
 */
export default function ReportByCodeScreen() {
    const { code } = useLocalSearchParams<{ code: string }>();
    const router = useRouter();
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let active = true;
        setFailed(false);

        (async () => {
            try {
                const deviceId = await getOrCreateDeviceId().catch(() => null);
                const res = await apiClient.get<{ id: number }>(`/reports/by-code/${code}`, {
                    params: deviceId ? { device_id: deviceId } : undefined,
                });
                if (!active) return;
                router.replace(`/report/${res.data.id}`);
            } catch {
                if (active) setFailed(true);
            }
        })();

        return () => { active = false; };
    }, [code]);

    if (failed) {
        return (
            <View style={[sharedStyles.center, styles.padded]}>
                <Stack.Screen options={{ title: 'Reporte' }} />
                <Text style={styles.title}>No encontramos este reporte</Text>
                <Text style={styles.body}>
                    Puede que ya se haya cerrado porque volvió la luz.
                </Text>
                <PrimaryButton
                    label="Ver el mapa"
                    style={styles.button}
                    onPress={() => router.replace('/(tabs)')}
                />
            </View>
        );
    }

    return (
        <View style={sharedStyles.center}>
            <Stack.Screen options={{ title: 'Reporte' }} />
            <ActivityIndicator size="large" color={DS.amber} />
        </View>
    );
}

const styles = StyleSheet.create({
    padded: {
        paddingHorizontal: 28,
    },
    title: {
        color: DS.text,
        fontSize: 20,
        fontWeight: '800',
        textAlign: 'center',
    },
    body: {
        color: DS.textMid,
        fontSize: 15,
        lineHeight: 22,
        textAlign: 'center',
        marginTop: 10,
        marginBottom: 24,
    },
    button: {
        alignSelf: 'stretch',
    },
});
