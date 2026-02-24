import React, { useState } from 'react';
import { View, Text, StyleSheet, useColorScheme, TouchableOpacity, Platform, Alert, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import { Colors, Spacing, Typography } from '../../src/theme/Theme';
import { AlertTriangle, CheckCircle2 } from 'lucide-react-native';
import apiClient from '../../src/api/client';

export default function ReportsScreen() {
    const colorScheme = useColorScheme() ?? 'light';
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleReport = async () => {
        setSubmitting(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permiso denegado', 'Necesitamos tu ubicación для того чтобы отправить отчет.');
                return;
            }

            const location = await Location.getCurrentPositionAsync({});
            const { latitude, longitude } = location.coords;

            // Mock user_id for now (should come from device info/auth)
            const deviceInfo = {
                device_id: 'test-device-123', // Placeholder
                latitude,
                longitude,
                comment: 'Corte reportado desde la app móvil'
            };

            await apiClient.post('/reports/', deviceInfo);

            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (error) {
            console.error('Error reporting outage:', error);
            Alert.alert('Error', 'Hubo un problema al enviar el reporte. Inténtalo de nuevo.');
        } finally {
            setSubmitting(false);
        }
    };

    if (success) {
        return (
            <View style={[styles.container, styles.center, { backgroundColor: Colors[colorScheme].background }]}>
                <CheckCircle2 size={80} color={Colors[colorScheme].tint} />
                <Text style={[Typography.title, { marginTop: Spacing.md, color: Colors[colorScheme].text }]}>
                    ¡Reporte enviado!
                </Text>
                <Text style={{ color: Colors[colorScheme].icon, textAlign: 'center', marginTop: Spacing.sm }}>
                    Gracias por ayudar a la comunidad.
                </Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
            <View style={styles.content}>
                <AlertTriangle size={64} color={Colors[colorScheme].tint} />
                <Text style={[Typography.title, { color: Colors[colorScheme].text, marginTop: Spacing.md, textAlign: 'center' }]}>
                    ¿No tienes luz?
                </Text>
                <Text style={[Typography.body, { color: Colors[colorScheme].icon, textAlign: 'center', marginVertical: Spacing.md }]}>
                    Informa sobre el corte en tu ubicación actual para que otros usuarios lo sepan.
                </Text>

                <TouchableOpacity
                    style={[styles.button, { backgroundColor: Colors[colorScheme].tint }]}
                    onPress={handleReport}
                    disabled={submitting}
                    activeOpacity={0.7}
                >
                    {submitting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.buttonText}>Reportar ahora</Text>
                    )}
                </TouchableOpacity>

                <Text style={styles.footerNote}>
                    Tu ubicación exacta se utilizará para agrupar reportes en la misma zona.
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: Spacing.lg,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    button: {
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.xl,
        borderRadius: Platform.OS === 'ios' ? 12 : 8,
        width: '100%',
        height: 56,
        justifyContent: 'center',
        alignItems: 'center',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 4,
            },
            android: {
                elevation: 4,
            }
        })
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    footerNote: {
        fontSize: 12,
        color: '#999',
        marginTop: Spacing.xl,
        textAlign: 'center',
        paddingHorizontal: Spacing.md,
    }
});
