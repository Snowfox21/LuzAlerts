import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, MapPin, Plus, X } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { DS, PrimaryButton } from '../src/components/DesignSystem';
import {
    addTrackedPlace,
    listTrackedPlaces,
    MAX_TRACKED_PLACES,
    removeTrackedPlace,
    searchAddress,
    TrackedPlace,
} from '../src/places/places';
import { getHomeZone, HomeZone } from '../src/utils/homeZone';

// Те же ключ и дефолт, что в Ajustes: радиус один на все места (бэкенд
// берет notify_radius_m пользователя и для своей зоны, и для мест).
const PREFS_KEY = '@luzalerts_notify_prefs';
const DEFAULT_RADIUS_M = 5000;

// Цвета мест по порядку: дом мамы — синий, второй — розовый (как в макете).
const PLACE_COLORS = [DS.blue, '#F472B6'];

/**
 * "Mis zonas": своя зона и до двух мест, за которыми человек следит
 * (дом родителей, офис). Пуши по местам приходят так же, как по своей зоне.
 */
export default function ZonesScreen() {
    const [home, setHome] = useState<HomeZone | null>(null);
    const [places, setPlaces] = useState<TrackedPlace[]>([]);
    const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_M / 1000);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [removingId, setRemovingId] = useState<number | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        getHomeZone().then(setHome).catch(() => {});
        AsyncStorage.getItem(PREFS_KEY)
            .then(raw => {
                const radius = raw ? JSON.parse(raw).notify_radius_m : null;
                if (typeof radius === 'number') setRadiusKm(radius / 1000);
            })
            .catch(() => {});
        try {
            setPlaces(await listTrackedPlaces());
        } catch {
            // Нет сети — оставляем, что было.
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const remove = (place: TrackedPlace) => {
        Alert.alert('Dejar de seguir', `¿Dejar de recibir avisos de "${place.label}"?`, [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Quitar',
                style: 'destructive',
                onPress: async () => {
                    setRemovingId(place.id);
                    try {
                        await removeTrackedPlace(place.id);
                        setPlaces(prev => prev.filter(p => p.id !== place.id));
                    } catch {
                        Alert.alert('Error', 'No se pudo quitar el lugar.');
                    } finally {
                        setRemovingId(null);
                    }
                },
            },
        ]);
    };

    const canAdd = places.length < MAX_TRACKED_PLACES;
    const radius = `radio ${radiusKm} km`;

    return (
        <View style={styles.screen}>
            <Stack.Screen
                options={{
                    title: 'Mis zonas',
                    headerBackTitle: 'Ajustes',
                    headerStyle: { backgroundColor: DS.bg },
                    headerTintColor: DS.text,
                    headerShadowVisible: false,
                }}
            />
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.intro}>Te avisamos de cortes en cada zona activa, estés donde estés.</Text>

                <ZoneCard
                    Icon={MapPin}
                    color={DS.amber}
                    name="Mi zona"
                    place={home?.label ?? (home ? 'Tu ubicación actual' : 'Sin definir')}
                    radius={radius}
                    gps={!!home && !home.manual}
                />

                {loading && places.length === 0 ? (
                    <ActivityIndicator color={DS.amber} style={styles.loader} />
                ) : (
                    places.map((place, i) => (
                        <ZoneCard
                            key={place.id}
                            Icon={Home}
                            color={PLACE_COLORS[i % PLACE_COLORS.length]}
                            name={place.label}
                            radius={radius}
                            right={removingId === place.id ? (
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
                        />
                    ))
                )}

                <TouchableOpacity
                    style={[styles.addButton, !canAdd && styles.addButtonDisabled]}
                    onPress={() => setAdding(true)}
                    disabled={!canAdd}
                    activeOpacity={0.75}
                >
                    <Plus size={18} color={canAdd ? DS.amber : DS.textMuted} />
                    <Text style={[styles.addText, !canAdd && { color: DS.textMuted }]}>Agregar lugar</Text>
                </TouchableOpacity>
                <Text style={styles.limit}>
                    {canAdd
                        ? `Podés seguir hasta ${MAX_TRACKED_PLACES} lugares además de tu zona · ${places.length} de ${MAX_TRACKED_PLACES}`
                        : `Llegaste al máximo de ${MAX_TRACKED_PLACES} lugares. Borrá uno para agregar otro.`}
                </Text>
            </ScrollView>

            <NewPlaceSheet
                visible={adding}
                used={places.length}
                radiusKm={radiusKm}
                onClose={() => setAdding(false)}
                onAdded={place => { setPlaces(prev => [...prev, place]); setAdding(false); }}
            />
        </View>
    );
}

function ZoneCard({ Icon, color, name, place, radius, gps, right }: {
    Icon: typeof Home;
    color: string;
    name: string;
    /** Подпись под именем; у мест имя и есть адрес, поэтому не дублируем. */
    place?: string;
    radius: string;
    gps?: boolean;
    right?: React.ReactNode;
}) {
    return (
        <View style={styles.card}>
            <View style={[styles.cardIcon, { backgroundColor: `${color}22` }]}>
                <Icon size={20} color={color} />
            </View>
            <View style={styles.cardText}>
                <View style={styles.cardNameRow}>
                    <Text style={styles.cardName} numberOfLines={1}>{name}</Text>
                    {gps && <Text style={styles.gpsBadge}>GPS</Text>}
                </View>
                <Text style={styles.cardSub} numberOfLines={1}>{place ? `${place} · ${radius}` : radius}</Text>
            </View>
            {right}
        </View>
    );
}

/** Нижняя панель "Nuevo lugar": имя + адрес → поиск координат → сохранить. */
function NewPlaceSheet({ visible, used, radiusKm, onClose, onAdded }: {
    visible: boolean;
    used: number;
    radiusKm: number;
    onClose: () => void;
    onAdded: (place: TrackedPlace) => void;
}) {
    const { bottom } = useSafeAreaInsets();
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [focused, setFocused] = useState<'name' | 'address' | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!visible) { setName(''); setAddress(''); setFocused(null); }
    }, [visible]);

    const save = async () => {
        const q = address.trim();
        if (q.length < 3 || saving) return;
        setSaving(true);
        try {
            const found = await searchAddress(q);
            if (!found) {
                Alert.alert('No encontrada', 'No encontramos esa dirección en Paraguay. Probá con barrio y ciudad, por ejemplo "Villa Morra, Asunción".');
                return;
            }
            // Свое имя ("Casa de mamá") понятнее адреса, особенно в пуше.
            onAdded(await addTrackedPlace({ ...found, label: name.trim() || found.label }));
        } catch (err: any) {
            const detail = err?.response?.data?.detail;
            Alert.alert('Error', typeof detail === 'string' ? detail : 'No se pudo agregar el lugar.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
            <KeyboardAvoidingView style={styles.sheetRoot} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Cerrar" />
                <View style={[styles.sheet, { paddingBottom: bottom + 24 }]}>
                    <View style={styles.handle} />
                    <Text style={styles.sheetTitle}>Nuevo lugar</Text>

                    <View style={styles.field}>
                        <Text style={styles.fieldLabel}>NOMBRE</Text>
                        <TextInput
                            style={[styles.input, focused === 'name' && styles.inputFocused]}
                            value={name}
                            onChangeText={setName}
                            onFocus={() => setFocused('name')}
                            onBlur={() => setFocused(null)}
                            placeholder="Ej: Casa de mamá"
                            placeholderTextColor={DS.textMuted}
                            maxLength={60}
                        />
                    </View>

                    <View style={styles.field}>
                        <Text style={styles.fieldLabel}>DIRECCIÓN O BARRIO</Text>
                        <View style={[styles.input, styles.inputRow, focused === 'address' && styles.inputFocused]}>
                            <MapPin size={16} color={DS.textMuted} />
                            <TextInput
                                style={styles.inputInner}
                                value={address}
                                onChangeText={setAddress}
                                onFocus={() => setFocused('address')}
                                onBlur={() => setFocused(null)}
                                placeholder="Ej: Fernando de la Mora, Central"
                                placeholderTextColor={DS.textMuted}
                                returnKeyType="done"
                                onSubmitEditing={save}
                            />
                        </View>
                    </View>

                    <Text style={styles.sheetHint}>
                        Te avisamos de cortes a menos de {radiusKm} km, igual que en tu zona. · {used + 1} de {MAX_TRACKED_PLACES}
                    </Text>

                    <PrimaryButton
                        label={saving ? undefined : 'Guardar lugar'}
                        onPress={save}
                        disabled={saving || address.trim().length < 3}
                    >
                        {saving ? <ActivityIndicator color={DS.ink} /> : null}
                    </PrimaryButton>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: DS.bg,
    },
    content: {
        paddingHorizontal: 16,
        paddingTop: 4,
        paddingBottom: 24,
        gap: 10,
    },
    intro: {
        color: DS.textMid,
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 6,
    },
    loader: {
        padding: 16,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: DS.surface,
        borderRadius: 14,
        padding: 14,
    },
    cardIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardText: {
        flex: 1,
        minWidth: 0,
    },
    cardNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    cardName: {
        flexShrink: 1,
        color: DS.text,
        fontSize: 15,
        fontWeight: '600',
    },
    gpsBadge: {
        color: DS.amber,
        backgroundColor: 'rgba(251,191,36,0.15)',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.4,
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 5,
        overflow: 'hidden',
    },
    cardSub: {
        color: DS.textMuted,
        fontSize: 13,
    },
    addButton: {
        height: 52,
        borderRadius: 12,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: '#475569',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 4,
    },
    addButtonDisabled: {
        borderColor: DS.border,
        opacity: 0.6,
    },
    addText: {
        color: DS.amber,
        fontSize: 15,
        fontWeight: '600',
    },
    limit: {
        color: DS.textMuted,
        fontSize: 12,
        lineHeight: 17,
        textAlign: 'center',
        marginTop: 4,
    },
    sheetRoot: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    scrim: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    sheet: {
        backgroundColor: DS.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingTop: 10,
        paddingHorizontal: 20,
        gap: 16,
    },
    handle: {
        alignSelf: 'center',
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#475569',
    },
    sheetTitle: {
        color: DS.text,
        fontSize: 20,
        fontWeight: '700',
    },
    field: {
        gap: 6,
    },
    fieldLabel: {
        color: DS.textMuted,
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.6,
    },
    input: {
        height: 48,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: DS.border,
        paddingHorizontal: 14,
        color: DS.text,
        fontSize: 15,
    },
    inputFocused: {
        borderWidth: 1.5,
        borderColor: DS.amber,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    inputInner: {
        flex: 1,
        height: '100%',
        color: DS.text,
        fontSize: 15,
    },
    sheetHint: {
        color: DS.textMuted,
        fontSize: 12,
        lineHeight: 17,
    },
});
