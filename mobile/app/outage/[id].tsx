import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, useColorScheme, ActivityIndicator, ScrollView, TouchableOpacity, Linking, Platform } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Colors, Spacing, Typography } from '../../src/theme/Theme';
import { Outage, OutageStatus } from '../../src/api/types';
import apiClient from '../../src/api/client';
import { MapPin, Calendar, Info, Clock, CheckCircle2, AlertTriangle } from 'lucide-react-native';
import { FEATURES, ANDE_WHATSAPP_NUMBER } from '../../src/constants/features';

export default function OutageDetailScreen() {
    const { id } = useLocalSearchParams();
    const colorScheme = useColorScheme() ?? 'dark';
    const [outage, setOutage] = useState<Outage | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchOutage = async () => {
            try {
                const response = await apiClient.get<Outage>(`/outages/${id}`);
                setOutage(response.data);
            } catch (err) {
                console.warn('Error fetching outage details:', err);
                setError('No se pudo cargar la información del corte.');
            } finally {
                setLoading(false);
            }
        };
        fetchOutage();
    }, [id]);

    if (loading) {
        return (
            <View style={[styles.center, { backgroundColor: Colors[colorScheme].background }]}>
                <Stack.Screen options={{ title: 'Detalles del Corte' }} />
                <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
            </View>
        );
    }

    if (error || !outage) {
        return (
            <View style={[styles.center, { backgroundColor: Colors[colorScheme].background }]}>
                <Stack.Screen options={{ title: 'Detalles del Corte' }} />
                <Text style={{ color: Colors[colorScheme].text }}>{error || 'Corte no encontrado'}</Text>
            </View>
        );
    }

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'No especificado';
        return new Date(dateString).toLocaleString('es-PY');
    };

    const getStatusText = (status: OutageStatus) => {
        switch (status) {
            case OutageStatus.ACTIVE: return 'Activo';
            case OutageStatus.PLANNED: return 'Planificado';
            case OutageStatus.RESOLVED: return 'Resuelto';
            default: return 'Desconocido';
        }
    };

    const getStatusIcon = () => {
        switch (outage.status) {
            case OutageStatus.ACTIVE: return <AlertTriangle color="#EF4444" size={24} />;
            case OutageStatus.PLANNED: return <Calendar color="#F59E0B" size={24} />;
            case OutageStatus.RESOLVED: return <CheckCircle2 color="#10B981" size={24} />;
            default: return <Info color={Colors[colorScheme].icon} size={24} />;
        }
    };

    return (
        <ScrollView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
            <Stack.Screen options={{ title: 'Detalles del Corte' }} />

            <View style={styles.header}>
                <View style={styles.statusRow}>
                    {getStatusIcon()}
                    <Text style={[styles.statusText, { color: Colors[colorScheme].text }]}>
                        {getStatusText(outage.status)}
                    </Text>
                </View>
                <Text style={[Typography.title, { color: Colors[colorScheme].text, marginTop: Spacing.sm }]}>
                    {outage.title}
                </Text>
            </View>

            <View style={styles.section}>
                <View style={styles.row}>
                    <MapPin color={Colors[colorScheme].icon} size={20} />
                    <Text style={[styles.detailText, { color: Colors[colorScheme].text }]}>
                        {outage.barrio || 'Zona no especificada'}
                    </Text>
                </View>

                {outage.scheduled_start && (
                    <View style={styles.row}>
                        <Clock color={Colors[colorScheme].icon} size={20} />
                        <Text style={[styles.detailText, { color: Colors[colorScheme].text }]}>
                            Inicio: {formatDate(outage.scheduled_start)}
                        </Text>
                    </View>
                )}

                {outage.scheduled_end && (
                    <View style={styles.row}>
                        <Clock color={Colors[colorScheme].icon} size={20} />
                        <Text style={[styles.detailText, { color: Colors[colorScheme].text }]}>
                            Fin estimado: {formatDate(outage.scheduled_end)}
                        </Text>
                    </View>
                )}
            </View>

            {outage.description && (
                <View style={styles.section}>
                    <Text style={[Typography.title, { color: Colors[colorScheme].text, marginBottom: Spacing.sm }]}>
                        Descripción
                    </Text>
                    <Text style={[Typography.body, { color: Colors[colorScheme].text, lineHeight: 22 }]}>
                        {outage.description}
                    </Text>
                </View>
            )}

            {FEATURES.WHATSAPP_ANDE_BOT && (
                <View style={[styles.section, { borderBottomWidth: 0 }]}>
                    <TouchableOpacity
                        style={styles.whatsappButton}
                        activeOpacity={0.8}
                        onPress={() => Linking.openURL(`https://wa.me/${ANDE_WHATSAPP_NUMBER.replace('+', '')}`)}
                    >
                        <Text style={styles.whatsappButtonText}>Reportar a ANDE por WhatsApp</Text>
                    </TouchableOpacity>
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        padding: Spacing.lg,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: Colors.dark.border,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusText: {
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: Spacing.sm,
    },
    section: {
        padding: Spacing.lg,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: Colors.dark.border,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    detailText: {
        fontSize: 16,
        marginLeft: Spacing.md,
        flex: 1,
    },
    whatsappButton: {
        backgroundColor: '#25D366',
        borderRadius: Platform.OS === 'ios' ? 12 : 8,
        paddingVertical: 14,
        alignItems: 'center',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 4,
            },
            android: { elevation: 3 },
        }),
    },
    whatsappButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
});
