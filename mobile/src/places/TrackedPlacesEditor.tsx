import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Home, Plus, X } from 'lucide-react-native';
import { DS } from '../components/DesignSystem';
import { AddressSearch } from './AddressSearch';
import { addTrackedPlace, FoundAddress, listTrackedPlaces, MAX_TRACKED_PLACES, removeTrackedPlace, TrackedPlace } from './places';

/**
 * "Lugares que seguís": до двух мест вдобавок к своей зоне — дом родителей,
 * дача, офис. Пуши по ним приходят так же, как по своей зоне.
 *
 * reloadKey — сменить, чтобы перечитать список (после "Eliminar mis datos").
 */
export function TrackedPlacesEditor({ reloadKey = 0 }: { reloadKey?: number }) {
    const [places, setPlaces] = useState<TrackedPlace[]>([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [name, setName] = useState('');
    const [removingId, setRemovingId] = useState<number | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setPlaces(await listTrackedPlaces());
        } catch {
            // Нет сети — оставляем, что было.
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load, reloadKey]);

    const add = async (found: FoundAddress) => {
        // Свое имя ("Casa de mamá") понятнее адреса, особенно в пуше.
        const label = name.trim() || found.label;
        try {
            const place = await addTrackedPlace({ ...found, label });
            setPlaces(prev => [...prev, place]);
            setAdding(false);
            setName('');
        } catch (err: any) {
            const detail = err?.response?.data?.detail;
            Alert.alert('Error', typeof detail === 'string' ? detail : 'No se pudo agregar el lugar.');
        }
    };

    const remove = async (place: TrackedPlace) => {
        setRemovingId(place.id);
        try {
            await removeTrackedPlace(place.id);
            setPlaces(prev => prev.filter(p => p.id !== place.id));
        } catch {
            Alert.alert('Error', 'No se pudo quitar el lugar.');
        } finally {
            setRemovingId(null);
        }
    };

    const canAdd = places.length < MAX_TRACKED_PLACES;

    return (
        <View>
            {loading && places.length === 0 ? (
                <ActivityIndicator color={DS.amber} style={styles.loader} />
            ) : (
                places.map(place => (
                    <View key={place.id} style={styles.placeRow}>
                        <Home size={18} color={DS.textMuted} />
                        <Text style={styles.placeText} numberOfLines={1}>{place.label}</Text>
                        {removingId === place.id ? (
                            <ActivityIndicator size="small" color={DS.textMuted} />
                        ) : (
                            <TouchableOpacity
                                onPress={() => remove(place)}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                accessibilityRole="button"
                                accessibilityLabel={`Dejar de seguir ${place.label}`}
                            >
                                <X size={20} color={DS.textMuted} />
                            </TouchableOpacity>
                        )}
                    </View>
                ))
            )}

            {adding ? (
                <View style={styles.addPanel}>
                    <TextInput
                        style={styles.nameInput}
                        value={name}
                        onChangeText={setName}
                        placeholder="Nombre (opcional), ej: Casa de mamá"
                        placeholderTextColor={DS.textMuted}
                        maxLength={60}
                    />
                    <AddressSearch onFound={add} buttonLabel="Agregar" />
                    <TouchableOpacity onPress={() => { setAdding(false); setName(''); }} style={styles.cancel}>
                        <Text style={styles.cancelText}>Cancelar</Text>
                    </TouchableOpacity>
                </View>
            ) : canAdd ? (
                <TouchableOpacity style={styles.addButton} onPress={() => setAdding(true)}>
                    <Plus size={18} color={DS.amber} />
                    <Text style={styles.addText}>Seguir otro lugar</Text>
                    <Text style={styles.addCount}>{places.length}/{MAX_TRACKED_PLACES}</Text>
                </TouchableOpacity>
            ) : (
                <Text style={styles.limit}>Ya seguís {MAX_TRACKED_PLACES} lugares. Quitá uno para agregar otro.</Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    loader: {
        padding: 16,
    },
    placeRow: {
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: DS.border,
    },
    placeText: {
        flex: 1,
        color: DS.text,
        fontSize: 15,
    },
    addPanel: {
        gap: 8,
        padding: 12,
    },
    nameInput: {
        minHeight: 42,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: DS.border,
        color: DS.text,
        backgroundColor: DS.bg,
        paddingHorizontal: 10,
        fontSize: 14,
    },
    cancel: {
        alignSelf: 'flex-start',
        paddingVertical: 4,
    },
    cancelText: {
        color: DS.textMuted,
        fontSize: 13,
    },
    addButton: {
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
    },
    addText: {
        flex: 1,
        color: DS.amber,
        fontSize: 15,
        fontWeight: '700',
    },
    addCount: {
        color: DS.textMuted,
        fontSize: 12,
    },
    limit: {
        color: DS.textMuted,
        fontSize: 13,
        padding: 16,
    },
});
