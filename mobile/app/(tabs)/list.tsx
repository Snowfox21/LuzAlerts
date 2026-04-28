import React, { useEffect, useState } from 'react';
import { AppState, View, Text, FlatList, StyleSheet, useColorScheme, RefreshControl, ActivityIndicator } from 'react-native';
import { Colors, Spacing, Typography } from '../../src/theme/Theme';
import { Outage, OutageStatus, OutageSource } from '../../src/api/types';
import apiClient from '../../src/api/client';
import { OutageCard } from '../../src/components/OutageCard';
import { useRouter } from 'expo-router';

export default function ListScreen() {
    const colorScheme = useColorScheme() ?? 'dark';
    const [outages, setOutages] = useState<Outage[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
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
                console.error('Error fetching official outages:', err);
            }

            try {
                const reportsRes = await apiClient.get<any[]>('/reports/');
                mappedReports = (reportsRes.data || [])
                    .map(r => ({
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
                console.error('Error fetching user reports:', err);
            }

            setOutages([...fetchedOutages, ...mappedReports]);
        } catch (error) {
            console.error('Error fetching outages:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchOutages();
    }, []);

    // Auto-refresh every 5 minutes while app is in foreground
    useEffect(() => {
        const interval = setInterval(fetchOutages, 5 * 60 * 1000);
        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') fetchOutages();
        });
        return () => {
            clearInterval(interval);
            subscription.remove();
        };
    }, []);

    const onRefresh = () => {
        setRefreshing(true);
        fetchOutages();
    };

    if (loading && !refreshing) {
        return (
            <View style={[styles.center, { backgroundColor: Colors[colorScheme].background }]}>
                <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
            <FlatList
                data={outages}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <OutageCard
                        outage={item}
                        onPress={item.source === OutageSource.CROWDSOURCE
                            ? () => router.push(`/report/${item.id - 1000000}`)
                            : () => router.push(`/outage/${item.id}`)}
                    />
                )}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors[colorScheme].tint} />
                }
                ListHeaderComponent={
                    <View style={styles.header}>
                        <Text style={[Typography.title, { color: Colors[colorScheme].text }]}>
                            Cortes reportados
                        </Text>
                        <Text style={{ color: Colors[colorScheme].icon, marginTop: 4 }}>
                            {outages.length} incidentes encontrados
                        </Text>
                    </View>
                }
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={
                    <Text style={styles.emptyText}>No hay cortes reportados actualmente.</Text>
                }
            />
        </View>
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
        padding: Spacing.md,
        paddingBottom: Spacing.sm,
    },
    listContent: {
        paddingBottom: Spacing.xl,
    },
    emptyText: {
        textAlign: 'center',
        marginTop: Spacing.xl,
        color: '#999',
    }
});
