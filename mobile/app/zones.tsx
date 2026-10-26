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
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, MapPin, Plus } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { DS, PrimaryButton } from '../src/components/DesignSystem';
import {
    listTrackedPlaces,
    MAX_TRACKED_PLACES,
    removeTrackedPlace,
    searchAddress,
} from '../src/places/places';
import {
    addTrackedPlaceWithRadius,
    DEFAULT_PLACE_RADIUS_M,
    PLACE_RADIUS_STEPS_M,
    TrackedPlaceWithSettings,
    updateTrackedPlace,
} from '../src/places/placeSettings';
import { getHomeZone, HomeZone } from '../src/utils/homeZone';

// Те же ключ и дефолт, что в Ajustes: радиус "Mi zona" (notify_radius_m).
// У мест свой radius_m; на старом бэкенде его нет — тогда показываем этот.
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
    const [places, setPlaces] = useState<TrackedPlaceWithSettings[]>([]);
    const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_M / 1000);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [editing, setEditing] = useState<TrackedPlaceWithSettings | null>(null);
    const [busyId, setBusyId] = useState<number | null>(null);

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

    const replacePlace = (updated: TrackedPlaceWithSettings) =>
        setPlaces(prev => prev.map(p => (p.id === updated.id ? { ...p, ...updated } : p)));

    // Оптимистично: переключатель реагирует сразу, при ошибке откатываем.
    const toggle = async (place: TrackedPlaceWithSettings, enabled: boolean) => {
        replacePlace({ ...place, enabled });
        try {
            replacePlace(await updateTrackedPlace(place.id, { enabled }));
        } catch {
            replacePlace(place);
            Alert.alert('Sin conexión', 'No pudimos guardar el cambio. Probá de nuevo.');
        }
    };

    const changeRadius = async (place: TrackedPlaceWithSettings, radius_m: number) => {
        setBusyId(place.id);
        try {
            const updated = await updateTrackedPlace(place.id, { radius_m });
            replacePlace(updated);
            setEditing(null);
        } catch {
            Alert.alert('Sin conexión', 'No pudimos guardar el radio. Probá de nuevo.');
        } finally {
            setBusyId(null);
        }
    };

    const remove = (place: TrackedPlaceWithSettings) => {
        Alert.alert('Dejar de seguir', `¿Dejar de recibir avisos de "${place.label}"?`, [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Quitar',
                style: 'destructive',
                onPress: async () => {
                    setBusyId(place.id);
                    try {
                        await removeTrackedPlace(place.id);
                        setPlaces(prev => prev.filter(p => p.id !== place.id));
                        setEditing(null);
                    } catch {
                        Alert.alert('Error', 'No se pudo quitar el lugar.');
                    } finally {
                        setBusyId(null);
                    }
                },
            },
        ]);
    };

    const canAdd = places.length < MAX_TRACKED_PLACES;
    const radiusLabel = (m?: number) => `radio ${(m ?? radiusKm * 1000) / 1000} km`;

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
                    radius={radiusLabel()}
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
                            radius={radiusLabel(place.radius_m)}
                            off={place.enabled === false}
                            onPress={() => setEditing(place)}
                            right={busyId === place.id ? (
                                <ActivityIndicator size="small" color={DS.textMuted} />
                            ) : place.enabled !== undefined ? (
                                <Switch
                                    value={place.enabled}
                                    onValueChange={v => toggle(place, v)}
                                    trackColor={{ true: DS.amber, false: DS.surfaceVar }}
                                    thumbColor={place.enabled ? DS.ink : DS.textMuted}
                                    accessibilityLabel={`Avisos de ${place.label}`}
                                />
                            ) : null}
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
                onClose={() => setAdding(false)}
                onAdded={place => { setPlaces(prev => [...prev, place]); setAdding(false); }}
            />

            <PlaceSheet
                place={editing}
                busy={editing != null && busyId === editing.id}
                onClose={() => setEditing(null)}
                onRadius={radius_m => editing && changeRadius(editing, radius_m)}
                onRemove={() => editing && remove(editing)}
            />
        </View>
    );
}

function ZoneCard({ Icon, color, name, place, radius, gps, off, onPress, right }: {
    Icon: typeof Home;
    color: string;
    name: string;
    /** Подпись под именем; у мест имя и есть адрес, поэтому не дублируем. */
    place?: string;
    radius: string;
    gps?: boolean;
    /** Место выключено: пуши по нему не приходят. */
    off?: boolean;
    onPress?: () => void;
    right?: React.ReactNode;
}) {
    // Нажимается только иконка с текстом: переключатель справа — отдельная
    // цель, иначе на вебе его клик всплывает и открывает панель места.
    const Wrapper = onPress ? TouchableOpacity : View;
    return (
        <View style={[styles.card, off && styles.cardOff]}>
            <Wrapper style={styles.cardMain} onPress={onPress as any} activeOpacity={0.75}>
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
            </Wrapper>
            {right}
        </View>
    );
}

function RadiusChips({ value, onChange, disabled }: { value: number; onChange: (m: number) => void; disabled?: boolean }) {
    return (
        <View style={styles.chips}>
            {PLACE_RADIUS_STEPS_M.map(m => {
                const active = m === value;
                return (
                    <TouchableOpacity
                        key={m}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => onChange(m)}
                        disabled={disabled}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                    >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{m / 1000} km</Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

/** Нижняя панель места: поменять радиус или перестать следить. */
function PlaceSheet({ place, busy, onClose, onRadius, onRemove }: {
    place: TrackedPlaceWithSettings | null;
    busy: boolean;
    onClose: () => void;
    onRadius: (radius_m: number) => void;
    onRemove: () => void;
}) {
    const { bottom } = useSafeAreaInsets();
    return (
        <Modal visible={place != null} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
            <View style={styles.sheetRoot}>
                <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Cerrar" />
                <View style={[styles.sheet, { paddingBottom: bottom + 24 }]}>
                    <View style={styles.handle} />
                    <Text style={styles.sheetTitle} numberOfLines={1}>{place?.label}</Text>
                    {/* Старый бэкенд radius_m не отдает и PATCH не знает — тогда только удалить. */}
                    {place?.radius_m != null && (
                        <View style={styles.field}>
                            <Text style={styles.fieldLabel}>RADIO DE AVISO</Text>
                            <RadiusChips value={place.radius_m} onChange={onRadius} disabled={busy} />
                        </View>
                    )}
                    <TouchableOpacity style={styles.removeButton} onPress={onRemove} disabled={busy}>
                        {busy ? <ActivityIndicator color={DS.redLight} /> : <Text style={styles.removeText}>Dejar de seguir este lugar</Text>}
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

/** Нижняя панель "Nuevo lugar": имя + адрес → поиск координат → сохранить. */
function NewPlaceSheet({ visible, used, onClose, onAdded }: {
    visible: boolean;
    used: number;
    onClose: () => void;
    onAdded: (place: TrackedPlaceWithSettings) => void;
}) {
    const { bottom } = useSafeAreaInsets();
    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [focused, setFocused] = useState<'name' | 'address' | null>(null);
    const [radius, setRadius] = useState(DEFAULT_PLACE_RADIUS_M);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!visible) { setName(''); setAddress(''); setFocused(null); setRadius(DEFAULT_PLACE_RADIUS_M); }
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
            onAdded(await addTrackedPlaceWithRadius({ ...found, label: name.trim() || found.label }, radius));
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

                    <View style={styles.field}>
                        <Text style={styles.fieldLabel}>RADIO DE AVISO</Text>
                        <RadiusChips value={radius} onChange={setRadius} />
                    </View>

                    <Text style={styles.sheetHint}>{used + 1} de {MAX_TRACKED_PLACES} lugares</Text>

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
    cardMain: {
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    cardOff: {
        opacity: 0.6,
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
    chips: {
        flexDirection: 'row',
        gap: 8,
    },
    chip: {
        flex: 1,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#475569',
        alignItems: 'center',
        justifyContent: 'center',
    },
    chipActive: {
        backgroundColor: DS.amber,
        borderColor: DS.amber,
    },
    chipText: {
        color: DS.textMid,
        fontSize: 14,
    },
    chipTextActive: {
        color: DS.ink,
        fontWeight: '700',
    },
    removeButton: {
        height: 48,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(239,68,68,0.45)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    removeText: {
        color: DS.redLight,
        fontSize: 15,
        fontWeight: '600',
    },
    sheetHint: {
        color: DS.textMuted,
        fontSize: 12,
        lineHeight: 17,
    },
});
