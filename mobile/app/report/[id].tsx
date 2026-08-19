import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { CheckCircle2, ChevronLeft, Clock3, MapPin, MessageSquare, UsersRound } from 'lucide-react-native';
import apiClient from '../../src/api/client';
import { confirmAndResolveReport } from '../../src/api/reports';
import { DS, PrimaryButton, SectionCard, sharedStyles } from '../../src/components/DesignSystem';
import { formatDateTime24 } from '../../src/utils/date';
import { isMyReport } from '../../src/utils/myReports';
import { getOrCreateDeviceId } from '../../src/utils/device';

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
    resolved: boolean;
    resolved_at: string | null;
    // Автора определяет сервер по device_id из query; старый бэкенд поле не отдает
    is_mine?: boolean;
}

export default function ReportDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const navigation = useNavigation();
    const [report, setReport] = useState<Report | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [mine, setMine] = useState(false);
    const [resolving, setResolving] = useState(false);

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const deviceId = await getOrCreateDeviceId().catch(() => null);
                const res = await apiClient.get<Report>(`/reports/${id}`, {
                    params: deviceId ? { device_id: deviceId } : undefined,
                });
                if (!active) return;
                setReport(res.data);
                // Приоритет у серверного флага, локальный реестр — запасной путь
                if (res.data?.is_mine === true) setMine(true);
            } catch {
                if (active) setError('No se pudo cargar el reporte.');
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, [id]);

    // Запасной путь: репорт, созданный на этом устройстве, помним локально
    useEffect(() => {
        let active = true;
        const reportId = Number(id);
        if (!Number.isFinite(reportId)) return;
        isMyReport(reportId).then(value => {
            if (active && value) setMine(true);
        });
        return () => { active = false; };
    }, [id]);

    const handleResolve = () => {
        if (!report || resolving) return;
        confirmAndResolveReport({
            reportId: report.id,
            onStart: () => setResolving(true),
            onResolved: resolved => setReport(prev => (prev ? {
                ...prev,
                resolved: true,
                resolved_at: resolved.resolved_at ?? new Date().toISOString(),
            } : prev)),
            onFinish: () => {
                setResolving(false);
                // после 403 реестр мог обновиться — перечитываем принадлежность
                isMyReport(report.id).then(setMine);
            },
        });
    };

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
                    headerBackTitle: 'Mapa',
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
                <View style={styles.badgeRow}>
                    <View style={styles.statusBadge}>
                        <UsersRound size={13} color={DS.violetLight} />
                        <Text style={styles.statusBadgeText}>
                            {report.confirmed ? 'CONFIRMADO' : 'REPORTADO'}
                        </Text>
                    </View>
                    {report.resolved ? (
                        <View style={[styles.statusBadge, styles.closedBadge]}>
                            <CheckCircle2 size={13} color={DS.greenLight} />
                            <Text style={[styles.statusBadgeText, styles.closedBadgeText]}>CERRADO</Text>
                        </View>
                    ) : null}
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

                {report.resolved ? (
                    <View style={styles.closedNotice}>
                        <View style={[styles.statusBadge, styles.closedBadge]}>
                            <CheckCircle2 size={13} color={DS.greenLight} />
                            <Text style={[styles.statusBadgeText, styles.closedBadgeText]}>CERRADO</Text>
                        </View>
                        <Text style={styles.closedNoticeText}>
                            La luz volvio el {formatDateTime24(report.resolved_at ?? undefined)}
                        </Text>
                    </View>
                ) : mine ? (
                    <PrimaryButton onPress={handleResolve} disabled={resolving} style={styles.resolveButton}>
                        {resolving
                            ? <ActivityIndicator color={DS.ink} />
                            : <Text style={styles.resolveButtonText}>Ya volvio la luz</Text>}
                    </PrimaryButton>
                ) : null}
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
    badgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
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
    closedBadge: {
        backgroundColor: 'rgba(74,222,128,0.15)',
    },
    closedBadgeText: {
        color: DS.greenLight,
    },
    closedNotice: {
        alignItems: 'flex-start',
        gap: 8,
        marginTop: 4,
    },
    closedNoticeText: {
        color: DS.textMid,
        fontSize: 13,
        lineHeight: 19,
    },
    resolveButton: {
        marginTop: 4,
    },
    resolveButtonText: {
        color: DS.ink,
        fontSize: 16,
        fontWeight: '800',
    },
});
