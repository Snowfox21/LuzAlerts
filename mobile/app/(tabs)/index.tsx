import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, useColorScheme, ActivityIndicator } from 'react-native';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import { Colors, Spacing } from '../../src/theme/Theme';
import { Outage, OutageStatus } from '../../src/api/types';
import apiClient from '../../src/api/client';

export default function MapScreen() {
    const colorScheme = useColorScheme() ?? 'light';
    const [outages, setOutages] = useState<Outage[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchOutages = async () => {
        try {
            const response = await apiClient.get<Outage[]>('/outages/');
            // Filter out outages without coordinates for the map
            setOutages(response.data.filter(o => o.latitude && o.longitude));
        } catch (error) {
            console.error('Error fetching outages for map:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOutages();
    }, []);

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
                provider={PROVIDER_GOOGLE}
                style={styles.map}
                initialRegion={{
                    latitude: -25.2637,
                    longitude: -57.5759,
                    latitudeDelta: 0.2,
                    longitudeDelta: 0.2,
                }}
                customMapStyle={colorScheme === 'dark' ? darkMapStyle : []}
            >
                {outages.map((outage) => (
                    <Marker
                        key={outage.id}
                        coordinate={{
                            latitude: outage.latitude!,
                            longitude: outage.longitude!,
                        }}
                        pinColor={getMarkerColor(outage.status)}
                    >
                        <Callout>
                            <View style={styles.callout}>
                                <Text style={styles.calloutTitle}>{outage.title}</Text>
                                <Text style={styles.calloutDescription}>{outage.barrio || 'Zona desconocida'}</Text>
                            </View>
                        </Callout>
                    </Marker>
                ))}
            </MapView>
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
    callout: {
        padding: Spacing.xs,
        width: 200,
    },
    calloutTitle: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    calloutDescription: {
        fontSize: 12,
        marginTop: 2,
        color: '#666',
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
