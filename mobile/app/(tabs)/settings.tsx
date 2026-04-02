import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, useColorScheme, SectionList, Platform,
    TouchableOpacity, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Spacing } from '../../src/theme/Theme';
import { ChevronRight, Plus, X, Info } from 'lucide-react-native';
import apiClient from '../../src/api/client';
import { getOrCreateDeviceId } from '../../src/utils/device';

const NIS_KEY = '@luzpy_nis';

interface Subscription {
    id: number;
    barrio: string | null;
    feeder_number: string | null;
}

export default function SettingsScreen() {
    const colorScheme = useColorScheme() ?? 'dark';

    const [nis, setNis] = useState('');
    const [nisEditing, setNisEditing] = useState(false);
    const [nisInput, setNisInput] = useState('');

    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [loadingSubs, setLoadingSubs] = useState(true);
    const [addingBarrio, setAddingBarrio] = useState(false);
    const [barrioInput, setBarrioInput] = useState('');
    const [submittingBarrio, setSubmittingBarrio] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const bg = Colors[colorScheme].background;
    const textColor = Colors[colorScheme].text;
    const iconColor = Colors[colorScheme].icon;
    const borderColor = Colors[colorScheme].border;
    const tint = Colors[colorScheme].tint;
    const inputBg = colorScheme === 'dark' ? '#1c1c1e' : '#f9f9f9';

    useEffect(() => {
        AsyncStorage.getItem(NIS_KEY).then(v => { if (v) setNis(v); });
        fetchSubscriptions();
    }, []);

    const fetchSubscriptions = useCallback(async () => {
        setLoadingSubs(true);
        try {
            const deviceId = await getOrCreateDeviceId();
            const res = await apiClient.get<Subscription[]>(`/subscriptions/?device_id=${deviceId}`);
            setSubscriptions((res.data || []).filter(s => s.barrio));
        } catch {
            // No subscriptions yet or backend unreachable
        } finally {
            setLoadingSubs(false);
        }
    }, []);

    const saveNis = async () => {
        const trimmed = nisInput.trim();
        await AsyncStorage.setItem(NIS_KEY, trimmed);
        setNis(trimmed);
        setNisEditing(false);
    };

    const addBarrio = async () => {
        const barrio = barrioInput.trim();
        if (!barrio) return;
        setSubmittingBarrio(true);
        try {
            const deviceId = await getOrCreateDeviceId();
            try { await apiClient.post('/users/', { device_id: deviceId }); } catch {}
            await apiClient.post('/subscriptions/', { device_id: deviceId, barrio });
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
            const deviceId = await getOrCreateDeviceId();
            await apiClient.delete(`/subscriptions/${id}?device_id=${deviceId}`);
            setSubscriptions(prev => prev.filter(s => s.id !== id));
        } catch {
            Alert.alert('Error', 'No se pudo eliminar la suscripción.');
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: colorScheme === 'dark' ? '#000' : '#F2F2F7' }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <SectionList
                sections={[]}
                keyExtractor={() => ''}
                renderItem={() => null}
                ListHeaderComponent={
                    <View>
                        {/* NIS Section */}
                        <Text style={[styles.sectionHeader, { color: iconColor }]}>CUENTA</Text>
                        <View style={[styles.card, { backgroundColor: bg, borderColor }]}>
                            <View style={styles.row}>
                                <Text style={[styles.label, { color: textColor }]}>Número de NIS</Text>
                                {nisEditing ? (
                                    <View style={styles.nisEditRow}>
                                        <TextInput
                                            style={[styles.nisInput, { borderColor, color: textColor, backgroundColor: inputBg }]}
                                            value={nisInput}
                                            onChangeText={setNisInput}
                                            placeholder="Ej: 1234567-8"
                                            placeholderTextColor={iconColor}
                                            keyboardType="default"
                                            autoFocus
                                        />
                                        <TouchableOpacity onPress={saveNis} style={[styles.saveBtn, { backgroundColor: tint }]}>
                                            <Text style={styles.saveBtnText}>Guardar</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        style={styles.nisValueRow}
                                        onPress={() => { setNisInput(nis); setNisEditing(true); }}
                                    >
                                        <Text style={{ color: iconColor, marginRight: 4 }}>
                                            {nis || 'No configurado'}
                                        </Text>
                                        <ChevronRight size={16} color={borderColor} />
                                    </TouchableOpacity>
                                )}
                            </View>
                            <View style={[styles.hint, { borderTopColor: borderColor }]}>
                                <Info size={13} color={iconColor} />
                                <Text style={[styles.hintText, { color: iconColor }]}>
                                    El NIS es el número de tu medidor ANDE. Se usará para alertas específicas de tu línea.
                                </Text>
                            </View>
                        </View>

                        {/* Barrio Subscriptions */}
                        <Text style={[styles.sectionHeader, { color: iconColor }]}>MIS BARRIOS</Text>
                        <View style={[styles.card, { backgroundColor: bg, borderColor }]}>
                            {loadingSubs ? (
                                <ActivityIndicator color={tint} style={{ padding: Spacing.md }} />
                            ) : subscriptions.length === 0 && !addingBarrio ? (
                                <Text style={[styles.emptyText, { color: iconColor }]}>
                                    No estás suscripto a ningún barrio todavía.
                                </Text>
                            ) : (
                                subscriptions.map((sub, idx) => (
                                    <View
                                        key={sub.id}
                                        style={[
                                            styles.row,
                                            idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: borderColor }
                                        ]}
                                    >
                                        <Text style={[styles.label, { color: textColor }]}>{sub.barrio}</Text>
                                        {deletingId === sub.id ? (
                                            <ActivityIndicator size="small" color={iconColor} />
                                        ) : (
                                            <TouchableOpacity onPress={() => deleteSubscription(sub.id)}>
                                                <X size={20} color={iconColor} />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                ))
                            )}

                            {addingBarrio && (
                                <View style={[
                                    styles.addRow,
                                    (subscriptions.length > 0 || !loadingSubs) && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: borderColor }
                                ]}>
                                    <TextInput
                                        style={[styles.barrioInput, { borderColor, color: textColor, backgroundColor: inputBg }]}
                                        value={barrioInput}
                                        onChangeText={setBarrioInput}
                                        placeholder="Ej: Villa Morra"
                                        placeholderTextColor={iconColor}
                                        autoFocus
                                        returnKeyType="done"
                                        onSubmitEditing={addBarrio}
                                    />
                                    <TouchableOpacity
                                        style={[styles.saveBtn, { backgroundColor: tint }, submittingBarrio && { opacity: 0.6 }]}
                                        onPress={addBarrio}
                                        disabled={submittingBarrio}
                                    >
                                        {submittingBarrio
                                            ? <ActivityIndicator color="#fff" size="small" />
                                            : <Text style={styles.saveBtnText}>OK</Text>
                                        }
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => { setAddingBarrio(false); setBarrioInput(''); }} style={{ marginLeft: 8 }}>
                                        <X size={20} color={iconColor} />
                                    </TouchableOpacity>
                                </View>
                            )}

                            {!addingBarrio && (
                                <TouchableOpacity
                                    style={[
                                        styles.row,
                                        (subscriptions.length > 0 || !loadingSubs) && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: borderColor }
                                    ]}
                                    onPress={() => setAddingBarrio(true)}
                                >
                                    <Plus size={18} color={tint} />
                                    <Text style={[styles.addLabel, { color: tint }]}>Agregar barrio</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* App Section */}
                        <Text style={[styles.sectionHeader, { color: iconColor }]}>APLICACIÓN</Text>
                        <View style={[styles.card, { backgroundColor: bg, borderColor }]}>
                            <View style={styles.row}>
                                <Text style={[styles.label, { color: textColor }]}>Idioma</Text>
                                <Text style={{ color: iconColor }}>Español</Text>
                            </View>
                            <View style={[styles.row, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: borderColor }]}>
                                <Text style={[styles.label, { color: textColor }]}>Versión</Text>
                                <Text style={{ color: iconColor }}>1.0.0</Text>
                            </View>
                        </View>

                        <View style={{ height: Spacing.xl * 2 }} />
                    </View>
                }
                contentContainerStyle={{ paddingBottom: Spacing.xl }}
            />
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    sectionHeader: {
        fontSize: 13,
        fontWeight: '400',
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.sm,
    },
    card: {
        marginHorizontal: Spacing.md,
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: 13,
        minHeight: 48,
    },
    label: {
        fontSize: 17,
        flex: 1,
    },
    hint: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.sm,
        paddingTop: Spacing.xs,
        borderTopWidth: StyleSheet.hairlineWidth,
        gap: 6,
    },
    hintText: {
        fontSize: 12,
        flex: 1,
        lineHeight: 16,
    },
    nisValueRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    nisEditRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        justifyContent: 'flex-end',
        gap: 8,
    },
    nisInput: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 6,
        fontSize: 15,
        maxWidth: 160,
    },
    addRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        gap: 8,
    },
    barrioInput: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 6,
        fontSize: 15,
    },
    saveBtn: {
        paddingHorizontal: Spacing.md,
        paddingVertical: 7,
        borderRadius: 8,
        minWidth: 64,
        alignItems: 'center',
    },
    saveBtnText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
    emptyText: {
        padding: Spacing.md,
        fontSize: 14,
        textAlign: 'center',
    },
    addLabel: {
        fontSize: 17,
        marginLeft: Spacing.sm,
    },
});
