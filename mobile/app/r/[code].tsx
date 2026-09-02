import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Platform, StyleSheet, Text, View } from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';

import apiClient from '../../src/api/client';
import { DS, PrimaryButton, sharedStyles } from '../../src/components/DesignSystem';
import { getOrCreateDeviceId } from '../../src/utils/device';

/**
 * Переходник со ссылки из WhatsApp на экран метки.
 *
 * Путь файла (app/r/[code]) намеренно повторяет URL, который выдает бэкенд:
 * https://luzalerts.lat/r/CODE. expo-router разбирает входящий диплинк сам и
 * делает это раньше любого нашего обработчика — если роута с таким путем нет,
 * сосед из WhatsApp получает экран "Unmatched Route" вместо метки.
 *
 * По ссылке приходит публичный код, а экран метки работает с id. Резолвим код
 * и сразу заменяем экран в стеке, чтобы "назад" не возвращало на этот
 * промежуточный шаг.
 */
export default function ReportByCodeScreen() {
    const { code } = useLocalSearchParams<{ code: string }>();
    const router = useRouter();
    const navigation = useNavigation();
    const [failed, setFailed] = useState(false);

    // Тот же случай, что и на экране метки: при холодном старте по ссылке
    // этот переходник — единственный экран в стеке, и аппаратная "назад"
    // закрыла бы приложение (она идёт к навигатору мимо любых наших кнопок).
    // Уводим на карту, чтобы человек остался внутри продукта.
    useFocusEffect(
        useCallback(() => {
            if (Platform.OS !== 'android') return;
            const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
                if (navigation.canGoBack()) return false;
                router.replace('/(tabs)');
                return true;
            });
            return () => subscription.remove();
        }, [navigation, router]),
    );

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
