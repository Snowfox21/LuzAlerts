import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { Navigation, Settings, Zap } from 'lucide-react-native';
import { Outage, OutageSource, OutageStatus } from '../../src/api/types';
import apiClient from '../../src/api/client';
import { OutageCard } from '../../src/components/OutageCard';
import { DS, IconButton, ScreenHeader, sharedStyles } from '../../src/components/DesignSystem';
import { parseApiDate } from '../../src/utils/date';

type Filter = 'all' | 'planned' | 'active' | 'resolved' | 'near';

const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'planned', label: 'Programados' },
    { key: 'active', label: 'Activos' },
    { key: 'resolved', label: 'Resueltos' },
    { key: 'near', label: 'Cerca tuyo' },
];

// ANDE не публикует новые данные с этой даты; используется, пока /status отдаёт null
const ANDE_SILENT_SINCE_FALLBACK = '05/05';
// Данные считаются устаревшими, если последнему official-корту больше суток
const ANDE_STALE_MS = 24 * 60 * 60 * 1000;

const formatDayMonth = (iso: string): string => {
    const d = parseApiDate(iso);
    if (!d) return ANDE_SILENT_SINCE_FALLBACK;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}`;
};

export default function ListScreen() {
    const [outages, setOutages] = useState<Outage[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<Filter>('all');
    const [lastAndeData, setLastAndeData] = useState<string | null>(null);
    const router = useRouter();
    const tabBarHeight = useBottomTabBarHeight();

    const fetchOutages = async () => {
        setLoading(true);
        try {
            let fetchedOutages: Outage[] = [];
            let mappedReports: Outage[] = [];

            try {
                const outagesRes = await apiClient.get<Outage[]>('/outages/');
                fetchedOutages = outagesRes.data || [];
            } catch (err) {
                console.warn('Error fetching official outages:', err);
            }

            try {
                const reportsRes = await apiClient.get<any[]>('/reports/');
                mappedReports = (reportsRes.data || []).map(r => ({
                    id: r.id + 1000000,
                    source: OutageSource.CROWDSOURCE,
                    status: OutageStatus.ACTIVE,
                    title: 'Corte reportado por usuario',
                    barrio: r.barrio || r.city || r.street || 'Zona reportada',
                    created_at: r.created_at,
                    latitude: r.latitude,
                    longitude: r.longitude,
                    confirmation_count: r.confirmation_count ?? 0,
                }));
            } catch (err) {
                console.warn('Error fetching user reports:', err);
            }

            setOutages([...fetchedOutages, ...mappedReports]);

            try {
                const statusRes = await apiClient.get<{ status: string; last_ande_data: string | null }>('/status');
                setLastAndeData(statusRes.data?.last_ande_data ?? null);
            } catch (err) {
                console.warn('Error fetching system status:', err);
            }
        } catch (error) {
            console.warn('Error fetching outages:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchOutages();
    }, []);

    useEffect(() => {
        const interval = setInterval(fetchOutages, 5 * 60 * 1000);
        const subscription = AppState.addEventListener('change', state => {
            if (state === 'active') fetchOutages();
        });
        return () => {
            clearInterval(interval);
            subscription.remove();
        };
    }, []);

    const filtered = useMemo(() => {
        if (filter === 'all' || filter === 'near') return outages;
        const status = {
            planned: OutageStatus.PLANNED,
            active: OutageStatus.ACTIVE,
            resolved: OutageStatus.RESOLVED,
        }[filter];
        return outages.filter(item => item.status === status);
    }, [filter, outages]);

    // ANDE молчит: данных нет вообще или последний official-корт старше суток.
    // Тишина источника != "всё в порядке" — показываем это явно.
    const andeStale = useMemo(() => {
        const date = parseApiDate(lastAndeData ?? undefined);
        if (!date) return true;
        return Date.now() - date.getTime() > ANDE_STALE_MS;
    }, [lastAndeData]);

    const andeSilentSince = lastAndeData ? formatDayMonth(lastAndeData) : ANDE_SILENT_SINCE_FALLBACK;

    if (loading && !refreshing) {
        return (
            <View style={sharedStyles.center}>
                <ActivityIndicator size="large" color={DS.amber} />
            </View>
        );
    }

    return (
        <View style={sharedStyles.screen}>
            <ScreenHeader
                title="Cortes"
                subtitle={`${filtered.length} incidentes encontrados`}
                right={
                    <IconButton onPress={() => router.push('/(tabs)/settings')}>
                        <Settings size={22} color={DS.textMuted} />
                    </IconButton>
                }
            />

            <View style={styles.filtersWrap}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
                    {FILTERS.map(item => {
                        const active = item.key === filter;
                        const disabled = item.key === 'near';
                        return (
                            <TouchableOpacity
                                key={item.key}
                                activeOpacity={disabled ? 1 : 0.8}
                                onPress={disabled ? undefined : () => setFilter(item.key)}
                                style={[styles.filterChip, active && styles.filterChipActive, disabled && styles.filterChipDisabled]}
                            >
                                <Text style={[styles.filterText, active && styles.filterTextActive, disabled && styles.filterTextDisabled]}>{item.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            <View style={styles.listWrap}>
                <FlatList
                    data={filtered}
                    keyExtractor={item => item.id.toString()}
                    renderItem={({ item }) => (
                        <OutageCard
                            outage={item}
                            onPress={item.source === OutageSource.CROWDSOURCE
                                ? () => router.push(`/report/${item.id - 1000000}`)
                                : () => router.push(`/outage/${item.id}`)}
                        />
                    )}
                    ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                    contentContainerStyle={[styles.listContent, filtered.length === 0 && styles.listContentEmpty]}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOutages(); }} tintColor={DS.amber} />
                    }
                    ListEmptyComponent={
                        <View style={styles.emptyWrap}>
                            <View style={styles.emptyIconCircle}>
                                <Zap size={40} color={DS.green} />
                            </View>
                            <Text style={styles.emptyTitle}>Sin cortes por ahora</Text>
                            <Text style={styles.emptyBody}>
                                No hay cortes programados por la ANDE ni reportes de vecinos en tu zona.
                            </Text>
                            <TouchableOpacity
                                activeOpacity={0.8}
                                onPress={() => { setRefreshing(true); fetchOutages(); }}
                                style={styles.refreshBtn}
                            >
                                <Navigation size={15} color={DS.textMuted} />
                                <Text style={styles.refreshText}>Actualizar</Text>
                            </TouchableOpacity>
                        </View>
                    }
                />

                {andeStale && (
                    <View style={[styles.systemStatus, { bottom: tabBarHeight + 16 }]}>
                        <View style={styles.statusRow}>
                            <View style={[styles.statusDot, styles.statusDotOk]} />
                            <Text style={styles.statusTextPrimary}>LuzAlerts funcionando normalmente</Text>
                        </View>
                        <View style={styles.statusDivider} />
                        <View style={styles.statusRow}>
                            <View style={[styles.statusDot, styles.statusDotWarn]} />
                            <Text style={styles.statusTextSecondary}>Datos de ANDE sin novedades desde {andeSilentSince}</Text>
                        </View>
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    filtersWrap: {
        paddingBottom: 12,
    },
    filters: {
        paddingHorizontal: 16,
        gap: 8,
    },
    filterChip: {
        height: 34,
        borderRadius: 17,
        borderWidth: 1,
        borderColor: '#475569',
        paddingHorizontal: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    filterChipDisabled: {
        opacity: 0.35,
    },
    filterTextDisabled: {
        color: DS.textMuted,
    },
    filterChipActive: {
        borderColor: DS.amber,
        backgroundColor: DS.amber,
    },
    filterText: {
        color: DS.textMid,
        fontSize: 13,
    },
    filterTextActive: {
        color: DS.ink,
        fontWeight: '800',
    },
    listWrap: {
        flex: 1,
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 24,
    },
    listContentEmpty: {
        flexGrow: 1,
    },
    emptyWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        paddingBottom: 96,
    },
    emptyIconCircle: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: 'rgba(34,197,94,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(34,197,94,0.25)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    emptyTitle: {
        color: DS.text,
        fontSize: 20,
        fontWeight: '700',
        lineHeight: 27,
        marginBottom: 8,
        textAlign: 'center',
    },
    emptyBody: {
        color: DS.textMid,
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center',
        maxWidth: 270,
    },
    refreshBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 20,
        height: 40,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: DS.border,
    },
    refreshText: {
        color: DS.textMid,
        fontSize: 13,
        fontWeight: '500',
    },
    systemStatus: {
        position: 'absolute',
        // bottom считается от высоты таб-бара (см. inline-стиль в рендере)
        right: 16,
        // ширина фиксированная: у абсолютной коробки без left/width размер идет по контенту,
        // и flex: 1 у текстов внутри схлопывает их в ноль
        width: 250,
        backgroundColor: 'rgba(30,41,59,0.94)',
        borderWidth: 1,
        borderColor: DS.border,
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        gap: 8,
        shadowColor: '#000',
        shadowOpacity: 0.45,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginTop: 5,
    },
    statusDotOk: {
        backgroundColor: DS.green,
        shadowColor: DS.green,
        shadowOpacity: 0.8,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 0 },
    },
    statusDotWarn: {
        backgroundColor: DS.amber,
    },
    statusDivider: {
        height: 1,
        backgroundColor: DS.border,
    },
    statusTextPrimary: {
        flex: 1,
        color: DS.text,
        fontSize: 12,
        fontWeight: '600',
        lineHeight: 16,
    },
    statusTextSecondary: {
        flex: 1,
        color: DS.textMid,
        fontSize: 12,
        lineHeight: 16,
    },
});
