import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { DS } from '../components/DesignSystem';
import { AddressSearch } from './AddressSearch';
import { FoundAddress, locateInParaguay, saveHomeZone } from './places';

/**
 * Выбор "Mi zona": по GPS или по адресу. GPS принимается только внутри
 * Парагвая — за границей он дал бы точку, где отключений не бывает.
 */
export function HomeZoneEditor({ onSaved }: { onSaved: (place: FoundAddress) => void }) {
    const [locating, setLocating] = useState(false);
    const [outside, setOutside] = useState(false);

    const save = async (place: FoundAddress) => {
        await saveHomeZone(place);
        onSaved(place);
    };

    const useGps = async () => {
        if (locating) return;
        setLocating(true);
        setOutside(false);
        try {
            const result = await locateInParaguay();
            if (result.kind === 'denied') {
                Alert.alert('Permiso denegado', 'Sin permiso de ubicación podés buscar tu zona por dirección.');
            } else if (result.kind === 'outside') {
                setOutside(true);
            } else {
                await save(result.place);
            }
        } catch {
            Alert.alert('Ubicación no disponible', 'Asegurate de que el GPS esté encendido y tengas conexión.');
        } finally {
            setLocating(false);
        }
    };

    return (
        <View style={styles.panel}>
            <TouchableOpacity style={styles.gpsButton} onPress={useGps} disabled={locating}>
                {locating ? <ActivityIndicator size="small" color={DS.amber} /> : <MapPin size={16} color={DS.amber} />}
                <Text style={styles.gpsText}>Usar mi ubicación actual</Text>
            </TouchableOpacity>
            {outside && (
                <Text style={styles.hint}>
                    Estás fuera de Paraguay. Buscá tu casa (o la de tu familia) por dirección y te avisamos de los cortes ahí.
                </Text>
            )}
            <Text style={styles.hint}>O buscá por dirección:</Text>
            <AddressSearch onFound={save} />
        </View>
    );
}

const styles = StyleSheet.create({
    panel: {
        gap: 8,
    },
    gpsButton: {
        minHeight: 40,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    gpsText: {
        color: DS.amber,
        fontSize: 15,
        fontWeight: '700',
    },
    hint: {
        color: DS.textMuted,
        fontSize: 12,
        lineHeight: 17,
    },
});
