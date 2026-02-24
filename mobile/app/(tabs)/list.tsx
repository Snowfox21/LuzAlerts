import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, useColorScheme, RefreshControl, ActivityIndicator } from 'react-native';
import { Colors, Spacing, Typography } from '../../src/theme/Theme';
import { Outage } from '../../src/api/types';
import apiClient from '../../src/api/client';
import { OutageCard } from '../../src/components/OutageCard';

export default function ListScreen() {
    const colorScheme = useColorScheme() ?? 'light';
    const [outages, setOutages] = useState<Outage[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchOutages = async () => {
        try {
            const response = await apiClient.get<Outage[]>('/outages/');
            setOutages(response.data);
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
                renderItem={({ item }) => <OutageCard outage={item} />}
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
