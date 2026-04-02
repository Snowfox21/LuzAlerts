import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, useColorScheme, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Spacing } from '../../src/theme/Theme';
import { Outage, OutageStatus, OutageSource } from '../../src/api/types';
import apiClient from '../../src/api/client';
import { OutageCard } from '../../src/components/OutageCard';
import { AlertTriangle } from 'lucide-react-native';

export default function MapScreen() {
    const colorScheme = useColorScheme() ?? 'dark';
    const [outages, setOutages] = useState<Outage[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOutage, setSelectedOutage] = useState<Outage | null>(null);
    const router = useRouter();
    const mapRef = useRef<MapView>(null);
    const { focusLat, focusLon } = useLocalSearchParams<{ focusLat?: string; focusLon?: string }>();

    const fetchOutages = async () => {
        setLoading(true);
        try {
            let fetchedOutages: Outage[] = [];
            let mappedReports: Outage[] = [];

            try {
                const outagesRes = await apiClient.get<Outage[]>('/outages/');
                fetchedOutages = (outagesRes.data || []).filter(o => o.latitude && o.longitude);
                console.log(`Fetched ${fetchedOutages.length} official outages`);
            } catch (err) {
                console.error('Error fetching official outages:', err);
            }

            try {
                const reportsRes = await apiClient.get<any[]>('/reports/');
                mappedReports = (reportsRes.data || [])
                    .filter(r => r.latitude && r.longitude)
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
                console.log(`Fetched ${mappedReports.length} user reports`);
            } catch (err) {
                console.error('Error fetching user reports:', err);
            }

            setOutages([...fetchedOutages, ...mappedReports]);
        } catch (error) {
            console.error('General error fetching data for map:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOutages();
    }, []);

    useEffect(() => {
        if (!focusLat || !focusLon) return;
        const lat = parseFloat(focusLat);
        const lon = parseFloat(focusLon);
        fetchOutages();
        mapRef.current?.animateToRegion({
            latitude: lat,
            longitude: lon,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
        }, 800);
    }, [focusLat, focusLon]);

    const getMarkerColor = (status: OutageStatus) => {
        switch (status) {
            case OutageStatus.ACTIVE: return '#EF4444';
            case OutageStatus.PLANNED: return '#F59E0B';
            case OutageStatus.RESOLVED: return '#10B981';
            default: return '#6B7280';
        }
    };

    if (loading) {
        return (
            <View style={[styles.center, { backgroundColor: Colors[colorScheme].background }]}>
                <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={{
                    latitude: -25.2637,
                    longitude: -57.5759,
                    latitudeDelta: 0.2,
                    longitudeDelta: 0.2,
                }}
                customMapStyle={colorScheme === 'dark' ? darkMapStyle : []}
                onPress={() => setSelectedOutage(null)}
                zoomEnabled={true}
                zoomControlEnabled={Platform.OS === 'android'}
                scrollEnabled={true}
                pitchEnabled={true}
                rotateEnabled={true}
            >
                {outages.map((outage) => (
                    <Marker
                        key={outage.id}
                        coordinate={{
                            latitude: outage.latitude!,
                            longitude: outage.longitude!,
                        }}
                        pinColor={getMarkerColor(outage.status)}
                        onPress={(e) => {
                            e.stopPropagation();
                            setSelectedOutage(outage);
                        }}
                    />
                ))}
            </MapView>

            {selectedOutage && (
                <View style={styles.cardOverlay}>
                    <OutageCard
                        outage={selectedOutage}
                        onPress={() => router.push(`/outage/${selectedOutage.id}`)}
                    />
                </View>
            )}

            <TouchableOpacity
                style={[styles.reportButton, { backgroundColor: Colors[colorScheme].tint }]}
                onPress={() => router.push('/(tabs)/reports')}
                activeOpacity={0.85}
            >
                <AlertTriangle size={18} color="#fff" />
                <Text style={styles.reportButtonText}>Reportar</Text>
            </TouchableOpacity>
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
    map: {
        ...StyleSheet.absoluteFillObject,
    },
    cardOverlay: {
        position: 'absolute',
        bottom: Spacing.xl + 20,
        left: Spacing.md,
        right: Spacing.md,
        borderRadius: 8,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
            },
            android: {
                elevation: 4,
            }
        })
    },
    reportButton: {
        position: 'absolute',
        top: Spacing.md,
        right: Spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: Spacing.md,
        borderRadius: 24,
        gap: 6,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 6,
            },
            android: {
                elevation: 5,
            }
        })
    },
    reportButtonText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 15,
    },
});

const darkMapStyle = [
    { "elementType": "geometry", "stylers": [{ "color": "#242f3e" }] },
    { "elementType": "labels.text.stroke", "stylers": [{ "color": "#242f3e" }] },
    { "elementType": "labels.text.fill", "stylers": [{ "color": "#746855" }] },
    { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
    { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#d59563" }] },
    { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#263c3f" }] },
    { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#6b9a76" }] },
    { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#38414e" }] },
    { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "color": "#212a37" }] },
    { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#9ca5b3" }] },
    { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#746855" }] },
    { "featureType": "road.highway", "elementType": "geometry.stroke", "stylers": [{ "color": "#1f2835" }] },
    { "featureType": "road.highway", "elementType": "labels.text.fill", "stylers": [{ "color": "#f3d19c" }] },
    { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#17263c" }] },
    { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#515c6d" }] },
    { "featureType": "water", "elementType": "labels.text.stroke", "stylers": [{ "color": "#17263c" }] }
];
