import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Bell, ChevronRight, Download, Info, Map, MapPin, Plus, Shield, Trash2, X, Zap } from 'lucide-react-native';
import apiClient from '../../src/api/client';
import { getOrCreateDeviceId, resetDeviceId } from '../../src/utils/device';
import { reverseGeocode } from '../../src/utils/reverseGeocode';
import { DS, ScreenHeader, sharedStyles } from '../../src/components/DesignSystem';
import { checkForUpdate } from '../../src/update/checkForUpdate';
import { getInstalledVersionName, UpdateManifest } from '../../src/update/manifest';
import { UpdateSheet } from '../../src/update/UpdateSheet';
import { WebPushRow } from '../../src/push/WebPushRow';
import { disableWebPush } from '../../src/push/webPush';

// Версия сборки, а не строковый литерал: с самообновлением вне стора
// расхождение экрана и реального APK путает при поддержке.
// В PWA нативной версии нет: веб-сборка всегда последняя с сервера.
const appVersion = Platform.OS === 'web' ? 'web' : getInstalledVersionName();

// Шаги радиуса уведомлений; бэкенд принимает 1–20 км (notify_radius_m).
const RADIUS_STEPS_KM = [1, 3, 5, 10, 20];

interface NotifyPrefs {
    notify_outages: boolean;
    notify_resolved: boolean;
    notify_radius_m: number;
}

const DEFAULT_PREFS: NotifyPrefs = { notify_outages: true, notify_resolved: true, notify_radius_m: 5000 };

// Локальная копия настроек и подписи зоны: экран рисуется сразу, без
// ожидания сети, а без связи показывает последнее сохраненное.
const PREFS_KEY = '@luzalerts_notify_prefs';
const ZONE_LABEL_KEY = '@luzalerts_zone_label';

// Что стирает "Eliminar mis datos" на устройстве, помимо id.
// Онбординг и проверку обновлений не трогаем — это не данные человека.
const LOCAL_DATA_KEYS = [PREFS_KEY, ZONE_LABEL_KEY, '@luzalerts_my_reports', '@luzalerts_corroborated_reports'];

async function describeLocation(latitude: number, longitude: number): Promise<string> {
    try {
        const place = await reverseGeocode(latitude, longitude);
        const parts = [place?.district ?? place?.subregion, place?.city ?? place?.region].filter(Boolean);
        if (parts.length) return Array.from(new Set(parts)).join(', ');
    } catch {}
    // Адрес не определился (нет сети, Nominatim недоступен) — хотя бы координаты.
    return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}

interface Subscription {
    id: number;
    barrio: string | null;
    feeder_number: string | null;
}

export default function SettingsScreen() {
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [loadingSubs, setLoadingSubs] = useState(true);
    const [addingBarrio, setAddingBarrio] = useState(false);
    const [barrioInput, setBarrioInput] = useState('');
    const [submittingBarrio, setSubmittingBarrio] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [prefs, setPrefs] = useState<NotifyPrefs>(DEFAULT_PREFS);
    const [zoneLabel, setZoneLabel] = useState<string | null>(null);
    const [locating, setLocating] = useState(false);
    const [deletingData, setDeletingData] = useState(false);
    const [deviceId, setDeviceId] = useState('');
    const [checkingUpdate, setCheckingUpdate] = useState(false);
    const [update, setUpdate] = useState<UpdateManifest | null>(null);

    const loadPrefs = useCallback(async () => {
        try {
            const cached = await AsyncStorage.getItem(PREFS_KEY);
            if (cached) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(cached) });
            setZoneLabel(await AsyncStorage.getItem(ZONE_LABEL_KEY));
        } catch {}
        try {
            const id = await getOrCreateDeviceId();
            const res = await apiClient.get<NotifyPrefs>(`/users/${id}`);
            const next = {
                notify_outages: res.data.notify_outages ?? true,
                notify_resolved: res.data.notify_resolved ?? true,
                notify_radius_m: res.data.notify_radius_m ?? 5000,
            };
            setPrefs(next);
            AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next)).catch(() => {});
        } catch {
            // 404: устройство еще не зарегистрировано — остаются дефолты.
        }
    }, []);

    useEffect(() => {
        fetchSubscriptions();
        loadPrefs();
        getOrCreateDeviceId().then(id => setDeviceId(id.slice(0, 8).toUpperCase())).catch(() => {});
    }, []);

    // Оптимистично: переключатель реагирует сразу, при ошибке откатываем.
    const updatePrefs = async (patch: Partial<NotifyPrefs>) => {
        const previous = prefs;
        const next = { ...prefs, ...patch };
        setPrefs(next);
        try {
            const id = await getOrCreateDeviceId();
            await apiClient.post('/users/', { device_id: id, ...patch });
            AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next)).catch(() => {});
        } catch {
            setPrefs(previous);
            Alert.alert('Sin conexión', 'No pudimos guardar el ajuste. Probá de nuevo.');
        }
    };

    // "Cambiar": зона уведомлений — текущее местоположение устройства.
    const updateZone = async () => {
        if (locating) return;
        setLocating(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permiso denegado', 'Necesitamos tu ubicación para avisarte de cortes cerca tuyo.');
                return;
            }
            const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            const { latitude, longitude } = pos.coords;
            const id = await getOrCreateDeviceId();
            await apiClient.post('/users/', { device_id: id, latitude, longitude });
            const label = await describeLocation(latitude, longitude);
            setZoneLabel(label);
            AsyncStorage.setItem(ZONE_LABEL_KEY, label).catch(() => {});
        } catch {
            Alert.alert('Ubicación no disponible', 'Asegurate de que el GPS esté encendido y tengas conexión.');
        } finally {
            setLocating(false);
        }
    };

    const eraseMyData = async () => {
        setDeletingData(true);
        try {
            // Сначала web push: иначе при следующем запуске PWA сама дошлет
            // браузерную подписку и устройство снова появится на сервере.
            if (Platform.OS === 'web') await disableWebPush().catch(() => {});
            const id = await getOrCreateDeviceId();
            await apiClient.delete(`/users/${id}/data`);
            await AsyncStorage.multiRemove(LOCAL_DATA_KEYS).catch(() => {});
            await resetDeviceId();
            setSubscriptions([]);
            setPrefs(DEFAULT_PREFS);
            setZoneLabel(null);
            const newId = await getOrCreateDeviceId();
            setDeviceId(newId.slice(0, 8).toUpperCase());
            Alert.alert('Datos eliminados', 'Borramos tus reportes, barrios, comentarios y ajustes del servidor.');
        } catch {
            Alert.alert('Error', 'No se pudieron eliminar tus datos. Probá de nuevo.');
        } finally {
            setDeletingData(false);
        }
    };

    const confirmEraseMyData = () => {
        if (deletingData) return;
        Alert.alert(
            '¿Eliminar mis datos?',
            'Se borrarán tus reportes, barrios, comentarios y ajustes. No se puede deshacer.',
            [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Eliminar', style: 'destructive', onPress: eraseMyData },
            ],
        );
    };

    const radiusKm = prefs.notify_radius_m / 1000;
    const radiusIndex = Math.max(0, RADIUS_STEPS_KM.indexOf(radiusKm));
    const radiusPercent = `${(radiusIndex / (RADIUS_STEPS_KM.length - 1)) * 100}%` as const;

    const fetchSubscriptions = useCallback(async () => {
        setLoadingSubs(true);
        try {
            const id = await getOrCreateDeviceId();
            const res = await apiClient.get<Subscription[]>(`/subscriptions/?device_id=${id}`);
            setSubscriptions((res.data || []).filter(s => s.barrio));
        } catch {
            // No subscriptions yet or backend unreachable.
        } finally {
            setLoadingSubs(false);
        }
    }, []);

    const addBarrio = async () => {
        const barrio = barrioInput.trim();
        if (!barrio) return;
        setSubmittingBarrio(true);
        try {
            const id = await getOrCreateDeviceId();
            try {
                await apiClient.post('/users/', { device_id: id });
            } catch {}
            await apiClient.post('/subscriptions/', { device_id: id, barrio });
            setBarrioInput('');
            setAddingBarrio(false);
            await fetchSubscriptions();
        } catch (err: any) {
            const detail = err?.response?.data?.detail;
            Alert.alert('Error', detail || 'No se pudo agregar la suscripción.');
        } finally {
            setSubmittingBarrio(false);
        }
    };

    const deleteSubscription = async (id: number) => {
        setDeletingId(id);
        try {
            const currentDeviceId = await getOrCreateDeviceId();
            await apiClient.delete(`/subscriptions/${id}?device_id=${currentDeviceId}`);
            setSubscriptions(prev => prev.filter(s => s.id !== id));
        } catch {
            Alert.alert('Error', 'No se pudo eliminar la suscripción.');
        } finally {
            setDeletingId(null);
        }
    };

    // Ручная проверка: игнорирует и суточный интервал, и ранее нажатое
    // "Después" — человек пришел за обновлением осознанно.
    const handleCheckUpdate = async () => {
        if (checkingUpdate) return;
        setCheckingUpdate(true);
        try {
            const result = await checkForUpdate({ force: true });
            if (result) {
                setUpdate(result.manifest);
            } else {
                Alert.alert('Todo al día', 'Ya tenés la última versión de LuzAlerts.');
            }
        } catch {
            Alert.alert('Sin conexión', 'No pudimos verificar si hay una nueva versión.');
        } finally {
            setCheckingUpdate(false);
        }
    };

    return (
        <KeyboardAvoidingView style={sharedStyles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScreenHeader title="Ajustes" />
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <SettingSection title="Notificaciones">
                    {/* PWA (iOS): включение Web Push только по тапу — iOS не
                        дает спросить разрешение без жеста пользователя. */}
                    {Platform.OS === 'web' && <WebPushRow />}
                    <SettingRow
                        icon={<Bell size={20} color={DS.amber} />}
                        label="Alertas de cortes"
                        sub={`Recibí avisos cuando hay cortes a menos de ${radiusKm} km.`}
                        right={<Switch value={prefs.notify_outages} onValueChange={v => updatePrefs({ notify_outages: v })} trackColor={{ true: DS.amber, false: DS.surfaceVar }} thumbColor={prefs.notify_outages ? DS.ink : DS.textMuted} />}
                    />
                    <SettingRow
                        icon={<Zap size={20} color={DS.greenLight} />}
                        label="Aviso cuando vuelve la luz"
                        sub="Te notificamos también cuando un corte cercano se resuelve."
                        right={<Switch value={prefs.notify_resolved} onValueChange={v => updatePrefs({ notify_resolved: v })} trackColor={{ true: DS.amber, false: DS.surfaceVar }} thumbColor={prefs.notify_resolved ? DS.ink : DS.textMuted} />}
                    />
                    <View style={styles.radiusRow}>
                        <Text style={styles.radiusLabel}>Radio de alertas: {radiusKm} km</Text>
                        <View style={styles.slider}>
                            <View style={[styles.sliderFill, { width: radiusPercent }]} />
                            <View style={[styles.sliderKnob, { left: radiusPercent }]} />
                        </View>
                        <View style={styles.sliderLabels}>
                            {RADIUS_STEPS_KM.map(km => (
                                <TouchableOpacity
                                    key={km}
                                    style={styles.sliderStep}
                                    onPress={() => km !== radiusKm && updatePrefs({ notify_radius_m: km * 1000 })}
                                    hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Radio ${km} km`}
                                >
                                    <Text style={[styles.sliderLabel, km === radiusKm && styles.sliderLabelActive]}>{km}km</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </SettingSection>

                <SettingSection title="Ubicación">
                    <SettingRow
                        icon={<MapPin size={20} color={DS.amber} />}
                        label="Mi zona actual"
                        sub={zoneLabel ?? 'Tocá para usar tu ubicación actual'}
                        right={locating ? <ActivityIndicator size="small" color={DS.amber} /> : <Text style={styles.link}>Cambiar</Text>}
                        onPress={updateZone}
                    />
                    <SettingRow
                        icon={<Map size={20} color={DS.textMuted} />}
                        label="Zonas adicionales"
                        sub="Barrios de los que también querés recibir avisos."
                        right={<Badge value={subscriptions.length} />}
                        onPress={() => setAddingBarrio(true)}
                    />
                </SettingSection>

                <SettingSection title="Mis barrios">
                    {loadingSubs ? (
                        <ActivityIndicator color={DS.amber} style={styles.loader} />
                    ) : subscriptions.length === 0 && !addingBarrio ? (
                        <Text style={styles.emptyText}>No estás suscripto a ningún barrio todavía.</Text>
                    ) : (
                        subscriptions.map(sub => (
                            <View key={sub.id} style={styles.barrioRow}>
                                <Text style={styles.barrioText}>{sub.barrio}</Text>
                                {deletingId === sub.id ? (
                                    <ActivityIndicator size="small" color={DS.textMuted} />
                                ) : (
                                    <TouchableOpacity onPress={() => deleteSubscription(sub.id)}>
                                        <X size={20} color={DS.textMuted} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        ))
                    )}

                    {addingBarrio ? (
                        <View style={styles.addRow}>
                            <TextInput
                                style={styles.barrioInput}
                                value={barrioInput}
                                onChangeText={setBarrioInput}
                                placeholder="Ej: Villa Morra"
                                placeholderTextColor={DS.textMuted}
                                autoFocus
                                returnKeyType="done"
                                onSubmitEditing={addBarrio}
                            />
                            <TouchableOpacity style={[styles.saveButton, submittingBarrio && { opacity: 0.6 }]} onPress={addBarrio} disabled={submittingBarrio}>
                                {submittingBarrio ? <ActivityIndicator color={DS.ink} size="small" /> : <Text style={styles.saveText}>OK</Text>}
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => { setAddingBarrio(false); setBarrioInput(''); }}>
                                <X size={20} color={DS.textMuted} />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity style={styles.addBarrioButton} onPress={() => setAddingBarrio(true)}>
                            <Plus size={18} color={DS.amber} />
                            <Text style={styles.addBarrioText}>Agregar barrio</Text>
                        </TouchableOpacity>
                    )}
                </SettingSection>

                {/* Самообновление = сайдлоад APK, в PWA смысла не имеет:
                    веб-версия обновляется сама при следующем открытии. */}
                {Platform.OS !== 'web' && (
                    <SettingSection title="Aplicación">
                        <SettingRow
                            icon={<Download size={20} color={DS.textMuted} />}
                            label="Buscar actualizaciones"
                            sub={`Versión ${appVersion}`}
                            right={checkingUpdate
                                ? <ActivityIndicator size="small" color={DS.amber} />
                                : <ChevronRight size={16} color={DS.textMuted} />}
                            onPress={handleCheckUpdate}
                        />
                    </SettingSection>
                )}

                <SettingSection title="Datos y privacidad">
                    <SettingRow icon={<Info size={20} color={DS.textMuted} />} label="Mi ID anónimo" sub={deviceId ? `#${deviceId}` : 'Cargando...'} />
                    <SettingRow
                        icon={<Trash2 size={20} color={DS.redLight} />}
                        label="Eliminar mis datos"
                        danger
                        right={deletingData ? <ActivityIndicator size="small" color={DS.redLight} /> : <ChevronRight size={16} color={DS.textMuted} />}
                        onPress={confirmEraseMyData}
                    />
                    <SettingRow icon={<Shield size={20} color={DS.textMuted} />} label="Política de privacidad" right={<ChevronRight size={16} color={DS.textMuted} />} onPress={() => Linking.openURL('https://luzalerts.lat/privacy')} />
                    <SettingRow icon={<Info size={20} color={DS.textMuted} />} label="Términos de uso" right={<ChevronRight size={16} color={DS.textMuted} />} onPress={() => Linking.openURL('https://luzalerts.lat/terms')} />
                </SettingSection>

                <View style={styles.footer}>
                    <View style={styles.footerBrand}>
                        <Zap size={14} color={DS.textMuted} />
                        <Text style={styles.footerTitle}>LuzAlerts v{appVersion}</Text>
                    </View>
                    <Text style={styles.footerText}>Proyecto independiente. No afiliado a la ANDE.</Text>
                </View>
            </ScrollView>
            {Platform.OS !== 'web' && <UpdateSheet manifest={update} onDismiss={() => setUpdate(null)} />}
        </KeyboardAvoidingView>
    );
}

function SettingSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <View style={styles.sectionCard}>{children}</View>
        </View>
    );
}

function SettingRow({
    icon,
    label,
    sub,
    right,
    danger,
    onPress,
}: {
    icon?: React.ReactNode;
    label: string;
    sub?: string;
    right?: React.ReactNode;
    danger?: boolean;
    onPress?: () => void;
}) {
    const Wrapper = onPress ? TouchableOpacity : View;
    return (
        <Wrapper style={styles.row} onPress={onPress as any} activeOpacity={0.75}>
            {icon}
            <View style={styles.rowText}>
                <Text style={[styles.rowLabel, danger && { color: DS.redLight }]}>{label}</Text>
                {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
            </View>
            {right}
        </Wrapper>
    );
}

function Badge({ value }: { value: number }) {
    return (
        <View style={styles.badgeWrap}>
            <View style={styles.badge}>
                <Text style={styles.badgeText}>{value}</Text>
            </View>
            <ChevronRight size={16} color={DS.textMuted} />
        </View>
    );
}

const styles = StyleSheet.create({
    content: {
        paddingBottom: 24,
    },
    section: {
        marginBottom: 4,
    },
    sectionTitle: {
        color: DS.textMuted,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 8,
    },
    sectionCard: {
        marginHorizontal: 16,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: DS.surface,
    },
    row: {
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: DS.border,
    },
    rowText: {
        flex: 1,
    },
    rowLabel: {
        color: DS.text,
        fontSize: 15,
    },
    rowSub: {
        color: DS.textMuted,
        fontSize: 12,
        lineHeight: 17,
        marginTop: 2,
    },
    radiusRow: {
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    radiusLabel: {
        color: DS.text,
        fontSize: 15,
        marginBottom: 12,
    },
    slider: {
        height: 4,
        borderRadius: 2,
        backgroundColor: DS.surfaceVar,
        marginBottom: 8,
    },
    sliderFill: {
        height: '100%',
        borderRadius: 2,
        backgroundColor: DS.amber,
    },
    sliderKnob: {
        position: 'absolute',
        top: -5,
        width: 14,
        height: 14,
        marginLeft: -7,
        borderRadius: 7,
        backgroundColor: DS.amber,
    },
    sliderLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    sliderStep: {
        paddingVertical: 6,
    },
    sliderLabel: {
        color: DS.textMuted,
        fontSize: 10,
    },
    sliderLabelActive: {
        color: DS.amber,
        fontWeight: '800',
    },
    link: {
        color: DS.amber,
        fontSize: 13,
        fontWeight: '700',
    },
    badgeWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    badge: {
        borderRadius: 10,
        paddingHorizontal: 7,
        paddingVertical: 2,
        backgroundColor: DS.amber,
    },
    badgeText: {
        color: DS.ink,
        fontSize: 11,
        fontWeight: '800',
    },
    loader: {
        padding: 16,
    },
    emptyText: {
        color: DS.textMuted,
        fontSize: 14,
        padding: 16,
        textAlign: 'center',
    },
    barrioRow: {
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: DS.border,
    },
    barrioText: {
        flex: 1,
        color: DS.text,
        fontSize: 15,
    },
    addRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
    },
    barrioInput: {
        flex: 1,
        minHeight: 42,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: DS.border,
        color: DS.text,
        backgroundColor: DS.bg,
        paddingHorizontal: 10,
        fontSize: 14,
    },
    saveButton: {
        minWidth: 58,
        height: 38,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: DS.amber,
    },
    saveText: {
        color: DS.ink,
        fontSize: 13,
        fontWeight: '800',
    },
    addBarrioButton: {
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
    },
    addBarrioText: {
        color: DS.amber,
        fontSize: 15,
        fontWeight: '700',
    },
    footer: {
        alignItems: 'center',
        paddingVertical: 20,
        paddingHorizontal: 16,
    },
    footerBrand: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    footerTitle: {
        color: '#64748B',
        fontSize: 13,
        fontWeight: '800',
    },
    footerText: {
        color: '#64748B',
        fontSize: 11,
        lineHeight: 16,
        textAlign: 'center',
    },
});
