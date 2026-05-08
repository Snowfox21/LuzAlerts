import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Settings } from 'lucide-react-native';
import { Outage, OutageSource, OutageStatus } from '../../src/api/types';
import apiClient from '../../src/api/client';
import { OutageCard } from '../../src/components/OutageCard';
import { DS, IconButton, ScreenHeader, sharedStyles } from '../../src/components/DesignSystem';

type Filter = 'all' | 'planned' | 'active' | 'resolved' | 'near';

const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'planned', label: 'Programados' },
    { key: 'active', label: 'Activos' },
    { key: 'resolved', label: 'Resueltos' },
    { key: 'near', label: 'Cerca tuyo' },
];

export default function ListScreen() {
    const [outages, setOutages] = useState<Outage[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<Filter>('all');
    const router = useRouter();

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
                    title: r.comment || 'Corte reportado por usuario',
                    barrio: r.barrio || r.city || r.street || 'Zona reportada',
                    created_at: r.created_at,
                    latitude: r.latitude,
                    longitude: r.longitude,
                }));
            } catch (err) {
                console.warn('Error fetching user reports:', err);
            }

            setOutages([...fetchedOutages, ...mappedReports]);
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
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchOutages(); }} tintColor={DS.amber} />
                }
                ListEmptyComponent={
                    <Text style={styles.emptyText}>No hay cortes reportados actualmente.</Text>
                }
            />
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
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 24,
    },
    emptyText: {
        color: DS.textMuted,
        textAlign: 'center',
        marginTop: 48,
        fontSize: 14,
    },
});
