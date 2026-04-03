import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, useColorScheme, ActivityIndicator, ScrollView } from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Colors, Spacing, Typography } from '../../src/theme/Theme';
import apiClient from '../../src/api/client';
import { MapPin, Clock, UserRound, MessageSquare } from 'lucide-react-native';

interface Report {
    id: number;
    latitude: number;
    longitude: number;
    department: string | null;
    city: string | null;
    barrio: string | null;
    street: string | null;
    house: string | null;
    comment: string | null;
    confirmed: boolean;
    created_at: string;
}

export default function ReportDetailScreen() {
    const { id } = useLocalSearchParams();
    const colorScheme = useColorScheme() ?? 'dark';
    const [report, setReport] = useState<Report | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        apiClient.get<Report>(`/reports/${id}`)
            .then(res => setReport(res.data))
            .catch(() => setError('No se pudo cargar el reporte.'))
            .finally(() => setLoading(false));
    }, [id]);

    const formatDate = (dateString: string) =>
        new Date(dateString).toLocaleString('es-PY');

    const formatAddress = (r: Report) => {
        const parts = [r.street, r.house, r.barrio, r.city, r.department].filter(Boolean);
        return parts.length > 0 ? parts.join(', ') : 'Dirección no especificada';
    };

    if (loading) {
        return (
            <View style={[styles.center, { backgroundColor: Colors[colorScheme].background }]}>
                <Stack.Screen options={{ title: 'Reporte de usuario' }} />
                <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
            </View>
        );
    }

    if (error || !report) {
        return (
            <View style={[styles.center, { backgroundColor: Colors[colorScheme].background }]}>
                <Stack.Screen options={{ title: 'Reporte de usuario' }} />
                <Text style={{ color: Colors[colorScheme].text }}>{error ?? 'Reporte no encontrado'}</Text>
            </View>
        );
    }

    return (
        <ScrollView style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
            <Stack.Screen options={{ title: 'Reporte de usuario' }} />

            <View style={[styles.header, { borderBottomColor: Colors[colorScheme].border }]}>
                <View style={styles.statusRow}>
                    <UserRound size={20} color={report.confirmed ? '#10B981' : Colors[colorScheme].icon} />
                    <Text style={[styles.statusText, { color: Colors[colorScheme].text }]}>
                        {report.confirmed ? 'Confirmado por la comunidad' : 'Reporte de usuario'}
                    </Text>
                </View>
                <Text style={[Typography.title, { color: Colors[colorScheme].text, marginTop: Spacing.sm }]}>
                    Corte reportado
                </Text>
            </View>

            <View style={[styles.section, { borderBottomColor: Colors[colorScheme].border }]}>
                <View style={styles.row}>
                    <MapPin size={20} color={Colors[colorScheme].icon} />
                    <Text style={[styles.detailText, { color: Colors[colorScheme].text }]}>
                        {formatAddress(report)}
                    </Text>
                </View>
                <View style={styles.row}>
                    <Clock size={20} color={Colors[colorScheme].icon} />
                    <Text style={[styles.detailText, { color: Colors[colorScheme].text }]}>
                        {formatDate(report.created_at)}
                    </Text>
                </View>
            </View>

            <View style={[styles.section, { borderBottomColor: Colors[colorScheme].border }]}>
                <View style={styles.row}>
                    <MessageSquare size={20} color={Colors[colorScheme].icon} />
                    <Text style={[styles.sectionTitle, { color: Colors[colorScheme].text }]}>Comentario</Text>
                </View>
                <Text style={[styles.comment, { color: report.comment ? Colors[colorScheme].text : Colors[colorScheme].icon }]}>
                    {report.comment ?? 'Información adicional no disponible'}
                </Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        padding: Spacing.lg,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    statusRow: { flexDirection: 'row', alignItems: 'center' },
    statusText: { fontSize: 16, fontWeight: '600', marginLeft: Spacing.sm },
    section: {
        padding: Spacing.lg,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    sectionTitle: { fontSize: 16, fontWeight: '600', marginLeft: Spacing.sm },
    row: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
    detailText: { fontSize: 16, marginLeft: Spacing.md, flex: 1 },
    comment: { fontSize: 16, lineHeight: 24, marginTop: Spacing.sm },
});
