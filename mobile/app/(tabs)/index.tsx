import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertTriangle, LocateFixed, Settings, Zap } from 'lucide-react-native';
import { Outage, OutageSource, OutageStatus } from '../../src/api/types';
import apiClient from '../../src/api/client';
import { OutageCard } from '../../src/components/OutageCard';
import { DS, IconButton, sharedStyles, statusMeta } from '../../src/components/DesignSystem';

const ASUNCION: Region = {
    latitude: -25.2637,
    longitude: -57.5759,
    latitudeDelta: 0.18,
    longitudeDelta: 0.18,
};

export default function MapScreen() {
    const { top } = useSafeAreaInsets();
    const [outages, setOutages] = useState<Outage[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOutage, setSelectedOutage] = useState<Outage | null>(null);
    const [initialRegion, setInitialRegion] = useState<Region>(ASUNCION);
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
        Location.requestForegroundPermissionsAsync().then(({ status }) => {
            if (status !== 'granted') return;
            Location.getLastKnownPositionAsync()
                .then(pos => pos ?? Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }))
                .then(pos => {
                    if (!pos) return;
                    setInitialRegion({
                        latitude: pos.coords.latitude,
                        longitude: pos.coords.longitude,
                        latitudeDelta: 0.1,
                        longitudeDelta: 0.1,
                    });
                })
                .catch(() => {});
        });
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

    const centerOnUser = async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        mapRef.current?.animateToRegion({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            latitudeDelta: 0.06,
            longitudeDelta: 0.06,
        }, 650);
    };

    if (loading) {
        return (
            <View style={sharedStyles.center}>
                <ActivityIndicator size="large" color={DS.amber} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={initialRegion}
                customMapStyle={darkMapStyle}
                onPress={() => setSelectedOutage(null)}
                zoomEnabled
                zoomControlEnabled={Platform.OS === 'android'}
                scrollEnabled
                pitchEnabled
                rotateEnabled
            >
                {outages.map(outage => {
                    const meta = statusMeta(outage.status, outage.source);
                    return (
                        <Marker
                            key={outage.id}
                            coordinate={{ latitude: outage.latitude!, longitude: outage.longitude! }}
                            onPress={e => {
                                e.stopPropagation();
                                setSelectedOutage(outage);
                            }}
                        >
                            <View style={[styles.markerPulse, selectedOutage?.id === outage.id && { backgroundColor: `${meta.color}30` }]}>
                                <View style={[styles.marker, { backgroundColor: meta.color }]}>
                                    <AlertTriangle size={15} color={DS.ink} strokeWidth={3} />
                                </View>
                                <View style={[styles.markerTail, { borderTopColor: meta.color }]} />
                            </View>
                        </Marker>
                    );
                })}
            </MapView>

            <View style={[styles.topBar, { paddingTop: top + 4 }]}>
                <View style={styles.brand}>
                    <Zap size={22} color={DS.amber} fill={DS.amber} />
                    <Text style={styles.brandText}>LuzAlerts</Text>
                </View>
                <IconButton onPress={() => router.push('/(tabs)/settings')}>
                    <Settings size={22} color={DS.textMuted} />
                </IconButton>
            </View>

            <View style={[styles.fabs, selectedOutage && styles.fabsRaised]}>
                <IconButton style={styles.locateButton} onPress={centerOnUser}>
                    <LocateFixed size={21} color={DS.text} />
                </IconButton>
                <TouchableOpacity
                    style={styles.reportButton}
                    onPress={() => router.push('/(tabs)/reports')}
                    activeOpacity={0.85}
                >
                    <AlertTriangle size={20} color={DS.ink} strokeWidth={2.5} />
                    <Text style={styles.reportButtonText}>Sin luz</Text>
                </TouchableOpacity>
            </View>

            {selectedOutage && (
                <View style={styles.sheet}>
                    <View style={styles.handle} />
                    <OutageCard
                        outage={selectedOutage}
                        compact
                        onPress={selectedOutage.source === OutageSource.CROWDSOURCE
                            ? () => router.push(`/report/${selectedOutage.id - 1000000}`)
                            : () => router.push(`/outage/${selectedOutage.id}`)}
                    />
                    <TouchableOpacity
                        style={styles.sheetAction}
                        activeOpacity={0.8}
                        onPress={selectedOutage.source === OutageSource.CROWDSOURCE
                            ? () => router.push(`/report/${selectedOutage.id - 1000000}`)
                            : () => router.push(`/outage/${selectedOutage.id}`)}
                    >
                        <Text style={styles.sheetActionText}>Ver detalles</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: DS.bg,
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },
    topBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingBottom: 10,
        paddingHorizontal: 8,
        backgroundColor: DS.bg,
        flexDirection: 'row',
        alignItems: 'center',
    },
    brand: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 8,
    },
    brandText: {
        color: DS.text,
        fontSize: 20,
        fontWeight: '800',
    },
    markerPulse: {
        width: 42,
        height: 50,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 21,
    },
    marker: {
        width: 24,
        height: 28,
        borderRadius: 7,
        alignItems: 'center',
        justifyContent: 'center',
    },
    markerTail: {
        width: 0,
        height: 0,
        borderLeftWidth: 7,
        borderRightWidth: 7,
        borderTopWidth: 10,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        marginTop: -1,
    },
    fabs: {
        position: 'absolute',
        right: 16,
        bottom: 92,
        alignItems: 'flex-end',
        gap: 10,
    },
    fabsRaised: {
        bottom: 252,
    },
    locateButton: {
        backgroundColor: DS.surface,
        elevation: 5,
    },
    reportButton: {
        height: 56,
        borderRadius: 28,
        paddingHorizontal: 20,
        backgroundColor: DS.amber,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        elevation: 7,
    },
    reportButtonText: {
        color: DS.ink,
        fontSize: 16,
        fontWeight: '800',
    },
    sheet: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: DS.surface,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 16,
        gap: 10,
    },
    handle: {
        alignSelf: 'center',
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#475569',
        marginBottom: 2,
    },
    sheetAction: {
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#475569',
        borderRadius: 8,
    },
    sheetActionText: {
        color: DS.text,
        fontSize: 14,
        fontWeight: '700',
    },
});

const darkMapStyle = [
    { elementType: 'geometry', stylers: [{ color: '#0D1626' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#0D1626' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#253348' }] },
    { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#64748B' }] },
    { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#334155' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0A1520' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1A2840' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#131E30' }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#334155' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#22314D' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0A1520' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#253348' }] },
];
