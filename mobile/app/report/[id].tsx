import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { ChevronLeft, Clock3, MapPin, MessageSquare, UsersRound } from 'lucide-react-native';
import apiClient from '../../src/api/client';
import { DS, SectionCard, sharedStyles } from '../../src/components/DesignSystem';
import { formatDateTime24 } from '../../src/utils/date';

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
    const router = useRouter();
    const navigation = useNavigation();
    const [report, setReport] = useState<Report | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        apiClient.get<Report>(`/reports/${id}`)
            .then(res => setReport(res.data))
            .catch(() => setError('No se pudo cargar el reporte.'))
            .finally(() => setLoading(false));
    }, [id]);

    const formatAddress = (r: Report) => {
        const parts = [r.street, r.house, r.barrio, r.city, r.department].filter(Boolean);
        return parts.length > 0 ? parts.join(', ') : 'Dirección no especificada';
    };

    const handleBack = () => {
        if (navigation.canGoBack()) {
            router.back();
            return;
        }
        router.replace('/(tabs)/reports');
    };

    const openOnMap = () => {
        if (!report) return;
        router.push({
            pathname: '/(tabs)',
            params: {
                focusLat: String(report.latitude),
                focusLon: String(report.longitude),
            },
        });
    };

    if (loading) {
        return (
            <View style={sharedStyles.center}>
                <Stack.Screen options={{ title: 'Reporte de usuario' }} />
                <ActivityIndicator size="large" color={DS.amber} />
            </View>
        );
    }

    if (error || !report) {
        return (
            <View style={sharedStyles.center}>
                <Stack.Screen options={{ title: 'Reporte de usuario' }} />
                <Text style={styles.errorText}>{error ?? 'Reporte no encontrado'}</Text>
            </View>
        );
    }

    return (
        <ScrollView style={sharedStyles.screen} contentContainerStyle={styles.content}>
            <Stack.Screen
                options={{
                    title: 'Reporte de usuario',
                    headerStyle: { backgroundColor: DS.bg },
                    headerTintColor: DS.text,
                    headerShadowVisible: false,
                    headerLeft: () => (
                        <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.75}>
                            <ChevronLeft size={18} color={DS.text} />
                            <Text style={styles.backButtonText}>Volver</Text>
                        </TouchableOpacity>
                    ),
                    headerBackVisible: false,
                }}
            />

            <View style={styles.hero}>
                <View style={styles.statusBadge}>
                    <UsersRound size={13} color={DS.violetLight} />
                    <Text style={styles.statusBadgeText}>
                        {report.confirmed ? 'CONFIRMADO' : 'REPORTADO'}
                    </Text>
                </View>
                <Text style={styles.title}>Corte reportado</Text>
                <Text style={styles.subtitle}>{formatAddress(report)}</Text>
            </View>

            <View style={styles.cards}>
                <TouchableOpacity activeOpacity={0.82} onPress={openOnMap}>
                    <SectionCard>
                        <InfoTitle icon={<MapPin size={18} color={DS.amber} />} title="Ubicación" />
                        <Text style={styles.body}>{formatAddress(report)}</Text>
                        <Text style={styles.locationHint}>Ver en el mapa</Text>
                    </SectionCard>
                </TouchableOpacity>

                <SectionCard>
                    <InfoTitle icon={<Clock3 size={18} color={DS.amber} />} title="Momento del reporte" />
                    <Text style={styles.body}>{formatDateTime24(report.created_at)}</Text>
                </SectionCard>

                <SectionCard>
                    <InfoTitle icon={<MessageSquare size={18} color={DS.violet} />} title="Comentario" />
                    <Text style={[styles.body, !report.comment && styles.muted]}>
                        {report.comment ?? 'Información adicional no disponible'}
                    </Text>
                </SectionCard>
            </View>
        </ScrollView>
    );
}

function InfoTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
    return (
        <View style={styles.infoTitle}>
            {icon}
            <Text style={styles.infoTitleText}>{title}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    content: {
        paddingBottom: 24,
    },
    errorText: {
        color: DS.text,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 6,
        paddingRight: 8,
    },
    backButtonText: {
        color: DS.text,
        fontSize: 15,
        fontWeight: '700',
    },
    hero: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 16,
    },
    statusBadge: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderRadius: 6,
        backgroundColor: 'rgba(168,85,247,0.15)',
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    statusBadgeText: {
        color: DS.violetLight,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.8,
    },
    title: {
        color: DS.text,
        fontSize: 22,
        fontWeight: '800',
        lineHeight: 30,
        marginTop: 8,
    },
    subtitle: {
        color: DS.textMid,
        fontSize: 15,
        lineHeight: 21,
        marginTop: 4,
    },
    cards: {
        paddingHorizontal: 16,
        gap: 10,
    },
    infoTitle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
    },
    infoTitleText: {
        color: DS.textMuted,
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
    },
    body: {
        color: DS.text,
        fontSize: 14,
        lineHeight: 20,
    },
    locationHint: {
        color: DS.amber,
        fontSize: 13,
        fontWeight: '700',
        marginTop: 10,
    },
    muted: {
        color: DS.textMuted,
    },
});
