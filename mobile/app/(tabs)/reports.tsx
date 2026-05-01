import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { AlertTriangle, CheckCircle2, Info, LocateFixed, MapPin, RefreshCw, X } from 'lucide-react-native';
import apiClient from '../../src/api/client';
import { getOrCreateDeviceId } from '../../src/utils/device';
import { DS, IconButton, PrimaryButton, ScreenHeader, SectionCard, sharedStyles } from '../../src/components/DesignSystem';

const SAMPLE_REPORTS = [
    { name: 'Vecino #A1B2', color: DS.violet, time: 'Hace 5 min', address: 'Av. Mariscal López y Brasilia', confirmed: 0, total: 3 },
    { name: 'Vecino #C3D4', color: DS.blue, time: 'Hace 18 min', address: 'Calle Pitiantuta c/ San Martín', confirmed: 3, total: 3 },
    { name: 'Vecino #E5F6', color: DS.green, time: 'Hace 31 min', address: 'Av. España esq. Mcal. Estigarribia', confirmed: 3, total: 3 },
    { name: 'Vecino #G7H8', color: DS.red, time: 'Hace 48 min', address: 'Gral. Santos c/ México', confirmed: 1, total: 3, expiring: true },
];

export default function ReportsScreen() {
    const router = useRouter();
    const [modalVisible, setModalVisible] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [autofilling, setAutofilling] = useState(false);
    const [success, setSuccess] = useState(false);
    const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
    const [address, setAddress] = useState({ department: '', city: '', barrio: '', street: '', house: '' });
    const [comment, setComment] = useState('');

    const resetForm = () => {
        setAddress({ department: '', city: '', barrio: '', street: '', house: '' });
        setComment('');
        setCoords(null);
    };

    const handleOpenModal = () => {
        setSuccess(false);
        resetForm();
        setModalVisible(true);
    };

    const handleAutofill = async () => {
        setAutofilling(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permiso denegado', 'Necesitamos tu ubicación para registrar el reporte.');
                return;
            }

            const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
                .catch(() => Location.getLastKnownPositionAsync());
            if (!location) {
                Alert.alert('Ubicación no disponible', 'Asegurate de que el GPS esté encendido.');
                return;
            }

            const { latitude, longitude } = location.coords;
            setCoords({ lat: latitude, lon: longitude });

            const geocoded = await Location.reverseGeocodeAsync({ latitude, longitude });
            if (geocoded.length > 0) {
                const loc = geocoded[0];
                setAddress({
                    department: loc.region || loc.subregion || '',
                    city: loc.city || loc.subregion || loc.district || '',
                    barrio: loc.district || loc.street || loc.name || '',
                    street: loc.street || loc.name || '',
                    house: loc.streetNumber || '',
                });
            }
        } catch {
            Alert.alert('Error', 'No se pudo obtener la dirección exacta, pero podés cargarla manualmente.');
        } finally {
            setAutofilling(false);
        }
    };

    const handleSubmit = async () => {
        if (!address.city && !address.street && !coords) {
            Alert.alert('Datos incompletos', 'Usá tu ubicación o ingresá ciudad y calle manualmente.');
            return;
        }

        setSubmitting(true);
        try {
            const deviceId = await getOrCreateDeviceId();
            try {
                await apiClient.post('/users/', { device_id: deviceId });
            } catch {}

            await apiClient.post('/reports/', {
                device_id: deviceId,
                latitude: coords?.lat || null,
                longitude: coords?.lon || null,
                department: address.department.trim() || null,
                city: address.city.trim() || null,
                barrio: address.barrio.trim() || null,
                street: address.street.trim() || null,
                house: address.house.trim() || null,
                comment: comment.trim() || 'Corte reportado desde la app móvil',
            });

            setSuccess(true);
            setModalVisible(false);
        } catch {
            Alert.alert('Error', 'Hubo un problema al enviar el reporte. Verificá tu conexión.');
        } finally {
            setSubmitting(false);
        }
    };

    if (success) {
        return (
            <View style={[sharedStyles.center, styles.success]}>
                <View style={styles.successIcon}>
                    <CheckCircle2 size={56} color={DS.greenLight} />
                </View>
                <Text style={styles.successTitle}>Reporte enviado</Text>
                <Text style={styles.successBody}>Si más vecinos reportan, te avisamos cuando se confirme.</Text>
                <PrimaryButton
                    label="Listo"
                    style={styles.successButton}
                    onPress={() => {
                        setSuccess(false);
                        if (coords) {
                            router.navigate({ pathname: '/(tabs)/', params: { focusLat: String(coords.lat), focusLon: String(coords.lon) } });
                        } else {
                            router.navigate('/(tabs)/');
                        }
                    }}
                />
            </View>
        );
    }

    return (
        <View style={sharedStyles.screen}>
            <ScreenHeader title="Reportes vecinales" />
            <View style={styles.banner}>
                <Info size={15} color={DS.violetLight} />
                <Text style={styles.bannerText}>
                    Cuando 3 vecinos reportan el mismo corte en menos de 500m, se confirma para todos.
                </Text>
            </View>

            <ScrollView style={styles.scroll} contentContainerStyle={styles.list}>
                {SAMPLE_REPORTS.map(report => (
                    <ReportCard key={report.name} {...report} />
                ))}
            </ScrollView>

            <View style={styles.fabRow}>
                <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={handleOpenModal}>
                <AlertTriangle size={20} color={DS.ink} strokeWidth={2.5} />
                <Text style={styles.fabText}>Reportar corte</Text>
                </TouchableOpacity>
            </View>

            <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalRoot}>
                    <TouchableOpacity style={styles.scrim} activeOpacity={1} onPress={() => setModalVisible(false)} />
                    <View style={styles.sheet}>
                        <View style={styles.handle} />
                        <View style={styles.sheetHeader}>
                            <Text style={styles.sheetTitle}>¿No hay luz en tu zona?</Text>
                            <IconButton onPress={() => setModalVisible(false)}>
                                <X size={22} color={DS.textMuted} />
                            </IconButton>
                        </View>
                        <Text style={styles.sheetBody}>
                            Usamos tu ubicación actual o una dirección manual para registrar el reporte.
                        </Text>

                        <TouchableOpacity style={styles.locationCard} activeOpacity={0.8} onPress={handleAutofill} disabled={autofilling}>
                            <MapPin size={20} color={DS.amber} />
                            <View style={styles.locationText}>
                                <Text style={styles.locationTitle}>Tu ubicación</Text>
                                <Text style={styles.locationSub}>
                                    {coords ? `${address.street || address.barrio || 'Ubicación detectada'}, ${address.city || 'Paraguay'}` : 'Completar por ubicación'}
                                </Text>
                                {coords ? <Text style={styles.locationAccuracy}>Coordenadas listas</Text> : null}
                            </View>
                            {autofilling ? <ActivityIndicator size="small" color={DS.amber} /> : <RefreshCw size={18} color={DS.textMuted} />}
                        </TouchableOpacity>

                        <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">
                            <FormInput label="Ciudad" value={address.city} placeholder="Ej: Asunción" onChangeText={city => setAddress(prev => ({ ...prev, city }))} />
                            <FormInput label="Barrio" value={address.barrio} placeholder="Ej: Villa Morra" onChangeText={barrio => setAddress(prev => ({ ...prev, barrio }))} />
                            <FormInput label="Calle principal" value={address.street} placeholder="Ej: Mcal. López" onChangeText={street => setAddress(prev => ({ ...prev, street }))} />
                            <FormInput label="Comentario" value={comment} placeholder="Ej: transformador con ruido" onChangeText={setComment} multiline />
                        </ScrollView>

                        <PrimaryButton onPress={handleSubmit} disabled={submitting} style={styles.submit}>
                            {submitting ? <ActivityIndicator color={DS.ink} /> : <Text style={styles.submitText}>Confirmar reporte</Text>}
                        </PrimaryButton>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

function ReportCard({
    name,
    color,
    time,
    address,
    confirmed,
    total,
    expiring,
}: {
    name: string;
    color: string;
    time: string;
    address: string;
    confirmed: number;
    total: number;
    expiring?: boolean;
}) {
    const pct = Math.min(100, (confirmed / total) * 100);
    const complete = confirmed >= total;
    const chipColor = complete ? DS.greenLight : expiring ? DS.textMuted : DS.amber;
    const chipBg = complete ? 'rgba(74,222,128,0.15)' : expiring ? 'rgba(100,116,139,0.15)' : 'rgba(251,191,36,0.15)';

    return (
        <SectionCard style={styles.reportCard}>
            <View style={styles.reportTop}>
                <View style={[styles.avatar, { backgroundColor: color }]}>
                    <Text style={styles.avatarText}>{name[0]}</Text>
                </View>
                <View style={styles.reportIdentity}>
                    <Text style={styles.reportName}>{name}</Text>
                    <Text style={styles.reportTime}>{time}</Text>
                </View>
                {expiring ? <Text style={styles.expiring}>Expira en 12 min</Text> : null}
            </View>
            <Text style={styles.reportAddress}>{address}</Text>
            <View style={[styles.confirmChip, { backgroundColor: chipBg }]}>
                <Text style={[styles.confirmText, { color: chipColor }]}>
                    {complete ? 'Confirmado' : `${confirmed} / ${total} confirmaciones`}
                </Text>
            </View>
            <View style={styles.progress}>
                <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: complete ? DS.greenLight : DS.amber }]} />
            </View>
        </SectionCard>
    );
}

function FormInput({
    label,
    value,
    placeholder,
    onChangeText,
    multiline,
}: {
    label: string;
    value: string;
    placeholder: string;
    onChangeText: (value: string) => void;
    multiline?: boolean;
}) {
    return (
        <View style={styles.formGroup}>
            <Text style={styles.label}>{label}</Text>
            <TextInput
                value={value}
                placeholder={placeholder}
                placeholderTextColor={DS.textMuted}
                onChangeText={onChangeText}
                multiline={multiline}
                textAlignVertical={multiline ? 'top' : 'center'}
                style={[styles.input, multiline && styles.textarea]}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    banner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        marginHorizontal: 16,
        marginBottom: 12,
        padding: 12,
        borderRadius: 8,
        borderLeftWidth: 4,
        borderLeftColor: DS.violet,
        backgroundColor: 'rgba(168,85,247,0.08)',
    },
    bannerText: {
        color: DS.textMid,
        fontSize: 13,
        lineHeight: 19,
        flex: 1,
    },
    scroll: {
        flex: 1,
    },
    list: {
        paddingHorizontal: 16,
        paddingTop: 4,
        paddingBottom: 16,
        gap: 10,
    },
    fabRow: {
        alignItems: 'flex-end',
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 16,
    },
    reportCard: {
        padding: 14,
    },
    reportTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 8,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '800',
    },
    reportIdentity: {
        flex: 1,
    },
    reportName: {
        color: DS.textMid,
        fontSize: 13,
        fontWeight: '800',
    },
    reportTime: {
        color: DS.textMuted,
        fontSize: 12,
        marginTop: 2,
    },
    expiring: {
        color: DS.textMuted,
        backgroundColor: 'rgba(100,116,139,0.2)',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 3,
        fontSize: 11,
    },
    reportAddress: {
        color: DS.text,
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 10,
    },
    confirmChip: {
        alignSelf: 'flex-start',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
        marginBottom: 8,
    },
    confirmText: {
        fontSize: 12,
        fontWeight: '800',
    },
    progress: {
        height: 4,
        borderRadius: 2,
        overflow: 'hidden',
        backgroundColor: DS.surfaceVar,
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
    },
    fab: {
        height: 56,
        borderRadius: 28,
        paddingHorizontal: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: DS.amber,
        elevation: 7,
    },
    fabText: {
        color: DS.ink,
        fontSize: 15,
        fontWeight: '800',
    },
    modalRoot: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    scrim: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.55)',
    },
    sheet: {
        maxHeight: '88%',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        backgroundColor: DS.bg,
        paddingHorizontal: 24,
        paddingBottom: 24,
    },
    handle: {
        alignSelf: 'center',
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#475569',
        marginTop: 12,
        marginBottom: 14,
    },
    sheetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    sheetTitle: {
        flex: 1,
        color: DS.text,
        fontSize: 22,
        lineHeight: 29,
        fontWeight: '800',
    },
    sheetBody: {
        color: DS.textMid,
        fontSize: 14,
        lineHeight: 21,
        marginBottom: 18,
    },
    locationCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        borderRadius: 12,
        backgroundColor: DS.surface,
        marginBottom: 14,
    },
    locationText: {
        flex: 1,
    },
    locationTitle: {
        color: DS.text,
        fontSize: 14,
        fontWeight: '800',
    },
    locationSub: {
        color: DS.textMid,
        fontSize: 13,
        marginTop: 2,
    },
    locationAccuracy: {
        color: DS.textMuted,
        fontSize: 12,
        marginTop: 2,
    },
    form: {
        maxHeight: 286,
    },
    formGroup: {
        marginBottom: 12,
    },
    label: {
        color: DS.text,
        fontSize: 13,
        fontWeight: '800',
        marginBottom: 6,
    },
    input: {
        minHeight: 48,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: DS.border,
        color: DS.text,
        backgroundColor: DS.surface,
        paddingHorizontal: 13,
        fontSize: 14,
    },
    textarea: {
        minHeight: 76,
        paddingTop: 12,
    },
    submit: {
        marginTop: 8,
    },
    submitText: {
        color: DS.ink,
        fontSize: 16,
        fontWeight: '800',
    },
    success: {
        paddingHorizontal: 28,
    },
    successIcon: {
        width: 96,
        height: 96,
        borderRadius: 48,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(34,197,94,0.15)',
        marginBottom: 24,
    },
    successTitle: {
        color: DS.text,
        fontSize: 24,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 10,
    },
    successBody: {
        color: DS.textMid,
        fontSize: 15,
        lineHeight: 22,
        textAlign: 'center',
        marginBottom: 28,
    },
    successButton: {
        alignSelf: 'stretch',
    },
});
