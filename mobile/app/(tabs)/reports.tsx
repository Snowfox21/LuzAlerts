import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import {
    ActivityIndicator,
    Alert,
    AppState,
    Keyboard,
    Modal,
    Platform,
    RefreshControl,
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
import { confirmAndResolveReport } from '../../src/api/reports';
import { getOrCreateDeviceId } from '../../src/utils/device';
import { addMyReportId, getMyReportIds } from '../../src/utils/myReports';
import { ageMinutes, relativeTime } from '../../src/utils/date';
import { formatVecinoId } from '../../src/utils/vecinoId';
import { DS, IconButton, PrimaryButton, ScreenHeader, SectionCard, sharedStyles } from '../../src/components/DesignSystem';
import { ShareBlock } from '../../src/share/ShareBlock';

interface Report {
    id: number;
    latitude: number;
    longitude: number;
    department: string | null;
    city: string | null;
    barrio: string | null;
    street: string | null;
    house: string | null;
    comment: string | null;
    confirmed: boolean;
    created_at: string;
    resolved: boolean;
    resolved_at: string | null;
    resolved_reason?: 'author' | 'auto' | null;
    // Автора определяет сервер по device_id из query; старый бэкенд поле не отдает
    is_mine?: boolean;
    confirmation_count?: number;
    // Публичная ссылка для шеринга; у меток старого бэкенда её нет
    share_code?: string | null;
    share_url?: string | null;
}

// Репорт автозакрывается на сервере через 96 часов, предупреждаем на середине срока.
// Раньше тут стояло 48 без множителя, то есть бейдж загорался через 48 минут.
const EXPIRING_AFTER_MINUTES = 48 * 60;

// Столько независимых репортов в радиусе 500 м подтверждают отключение.
// Совпадает с REPORT_THRESHOLD на бэкенде.
const CONFIRMATION_THRESHOLD = 3;

const PARAGUAY_BOUNDS = {
    minLat: -27.7,
    maxLat: -19.0,
    minLon: -62.9,
    maxLon: -54.1,
};

export default function ReportsScreen() {
    const router = useRouter();
    const [reports, setReports] = useState<Report[]>([]);
    const [loadingReports, setLoadingReports] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [autofilling, setAutofilling] = useState(false);
    const [success, setSuccess] = useState(false);
    // Метка, только что созданная на этом экране: из нее берем ссылку для шеринга
    const [createdReport, setCreatedReport] = useState<Report | null>(null);
    // Клавиатуру отрабатываем сами. KeyboardAvoidingView внутри Modal на
    // Android с edge-to-edge меряет свой фрейм относительно окна активити, а у
    // Modal собственное полноэкранное окно — сдвиг выходит неверным.
    // Перекрытие считаем как (высота контейнера модалки - screenY клавиатуры),
    // а не как высоту клавиатуры: высота окна и высота экрана расходятся на
    // статусбар с навбаром, и на этом промахивается на ~90dp. Через onLayout
    // формула самонастраивается: если система сама ужимает окно (обычный
    // adjustResize), контейнер станет ниже и перекрытие честно выйдет нулевым.
    const [keyboardScreenY, setKeyboardScreenY] = useState<number | null>(null);
    const [sheetRootHeight, setSheetRootHeight] = useState(0);
    const keyboardOverlap = keyboardScreenY === null
        ? 0
        : Math.max(0, Math.round(sheetRootHeight - keyboardScreenY));
    // Аппаратный «Назад» приходит в тот же тик, что и события клавиатуры,
    // поэтому решение принимаем по ref, а не по стейту с отложенным рендером.
    const keyboardOpenRef = useRef(false);
    const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
    const [address, setAddress] = useState({ department: '', city: '', barrio: '', street: '', house: '' });
    const [comment, setComment] = useState('');
    const [myReportIds, setMyReportIds] = useState<Set<number>>(new Set());
    const [resolvingId, setResolvingId] = useState<number | null>(null);

    const refreshMyReportIds = async () => {
        setMyReportIds(new Set(await getMyReportIds()));
    };

    const fetchReports = async () => {
        try {
            const deviceId = await getOrCreateDeviceId().catch(() => null);
            const res = await apiClient.get<Report[]>('/reports/', {
                params: deviceId ? { device_id: deviceId } : undefined,
            });
            setReports(res.data || []);
            await refreshMyReportIds();
        } catch (error) {
            console.error('Error fetching reports:', error);
            setReports([]);
        } finally {
            setLoadingReports(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchReports();
    }, []);

    useEffect(() => {
        const interval = setInterval(fetchReports, 5 * 60 * 1000);
        const subscription = AppState.addEventListener('change', state => {
            if (state === 'active') fetchReports();
        });
        return () => {
            clearInterval(interval);
            subscription.remove();
        };
    }, []);

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

            const location = await Promise.race([
                Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
                new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 7000)),
            ]).catch(() => Location.getLastKnownPositionAsync());
            if (!location) {
                Alert.alert('Ubicación no disponible', 'Asegurate de que el GPS esté encendido.');
                return;
            }

            const { latitude, longitude } = location.coords;

            const geocoded = await Location.reverseGeocodeAsync({ latitude, longitude });
            if (!isWithinParaguay(latitude, longitude) || !isParaguayGeocode(geocoded[0])) {
                setCoords(null);
                setAddress({ department: '', city: '', barrio: '', street: '', house: '' });
                Alert.alert('Fuera de cobertura', buildOutsideCoverageMessage(geocoded[0]?.city ?? geocoded[0]?.subregion));
                return;
            }

            setCoords({ lat: latitude, lon: longitude });
            if (geocoded.length > 0) {
                const loc = geocoded[0];
                setAddress({
                    department: loc.region || loc.subregion || '',
                    city: loc.city || loc.subregion || loc.district || '',
                    barrio: cleanGeoField(loc.district) || cleanGeoField(loc.street) || '',
                    street: cleanGeoField(loc.street) || '',
                    house: loc.streetNumber || '',
                });
            }
        } catch {
            Alert.alert('Error', 'No se pudo obtener la dirección exacta, pero podés cargarla manualmente.');
        } finally {
            setAutofilling(false);
        }
    };

    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const onShow = Keyboard.addListener(showEvent, event => {
            keyboardOpenRef.current = true;
            if (event.endCoordinates) setKeyboardScreenY(event.endCoordinates.screenY);
        });
        const onHide = Keyboard.addListener(hideEvent, () => {
            keyboardOpenRef.current = false;
            setKeyboardScreenY(null);
        });

        return () => {
            onShow.remove();
            onHide.remove();
        };
    }, []);

    const closeModal = useCallback(() => {
        Keyboard.dismiss();
        setModalVisible(false);
    }, []);

    // Аппаратный «Назад». Раньше он закрывал шит безусловно, и человек терял
    // всё, что успел заполнить, — притом что ожидал всего лишь убрать
    // клавиатуру.
    const handleRequestClose = useCallback(() => {
        if (keyboardOpenRef.current) {
            Keyboard.dismiss();
            return;
        }

        const hasDraft = Boolean(
            address.department || address.city || address.barrio || address.street || address.house || comment || coords,
        );
        if (!hasDraft) {
            closeModal();
            return;
        }

        // Подтверждение, а не черновик: координаты и автозаполненный адрес
        // протухают (человек уехал, свет дали), и восстановленный через сутки
        // черновик отправил бы метку не туда.
        Alert.alert(
            '¿Descartar el reporte?',
            'Vas a perder los datos que cargaste. Si querés, seguí completando y confirmá el reporte.',
            [
                { text: 'Seguir editando', style: 'cancel' },
                { text: 'Descartar', style: 'destructive', onPress: closeModal },
            ],
        );
    }, [address, comment, coords, closeModal]);

    const handleSubmit = async () => {
        if (!address.city && !address.street && !coords) {
            Alert.alert('Datos incompletos', 'Usá tu ubicación o ingresá ciudad y calle manualmente.');
            return;
        }

        if (coords && !isWithinParaguay(coords.lat, coords.lon)) {
            Alert.alert('Fuera de cobertura', buildOutsideCoverageMessage(address.city));
            return;
        }

        setSubmitting(true);
        try {
            const deviceId = await getOrCreateDeviceId();
            try {
                await apiClient.post('/users/', { device_id: deviceId });
            } catch {}

            const created = await apiClient.post<Report>('/reports/', {
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

            // Сервер не отдает device_id, поэтому автора помним локально
            if (typeof created.data?.id === 'number') {
                await addMyReportId(created.data.id);
            }

            setCreatedReport(created.data ?? null);
            setSuccess(true);
            setModalVisible(false);
            fetchReports();
        } catch (error) {
            const errorCopy = getReportSubmitError(error, address.city);
            Alert.alert(errorCopy.title, errorCopy.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (success) {
        const shareUrl = createdReport?.share_url ?? null;
        const dismissSuccess = () => {
            setSuccess(false);
            setCreatedReport(null);
            if (coords) {
                router.navigate({ pathname: '/(tabs)/', params: { focusLat: String(coords.lat), focusLon: String(coords.lon) } });
            } else {
                router.navigate('/(tabs)/');
            }
        };

        return (
            <ScrollView
                style={sharedStyles.screen}
                contentContainerStyle={[styles.successScroll, styles.success]}
            >
                <View style={styles.successIcon}>
                    <CheckCircle2 size={56} color={DS.greenLight} />
                </View>
                <Text style={styles.successTitle}>Reporte enviado</Text>
                <Text style={styles.successBody}>
                    {shareUrl
                        ? 'Hace falta que 3 vecinos lo reporten para confirmar el corte. Avisales ahora — es lo que más ayuda.'
                        : 'Si más vecinos reportan, te avisamos cuando se confirme.'}
                </Text>

                {/* Момент сразу после репорта — единственный, когда соседи
                    нужны прямо сейчас. Поэтому шеринг здесь основное
                    действие, а "Listo" уходит на второй план. */}
                {shareUrl ? (
                    <ShareBlock
                        target={{
                            reportId: createdReport?.id,
                            url: shareUrl,
                            place: createdReport?.barrio ?? createdReport?.city ?? address.barrio ?? address.city,
                            confirmations: createdReport?.confirmation_count ?? 0,
                        }}
                    />
                ) : null}

                {shareUrl ? (
                    <TouchableOpacity onPress={dismissSuccess} activeOpacity={0.7} style={styles.successSkip}>
                        <Text style={styles.successSkipText}>Ahora no</Text>
                    </TouchableOpacity>
                ) : (
                    <PrimaryButton label="Listo" style={styles.successButton} onPress={dismissSuccess} />
                )}
            </ScrollView>
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

            <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchReports(); }} tintColor={DS.amber} />}
            >
                {loadingReports ? (
                    <ActivityIndicator color={DS.amber} style={styles.loader} />
                ) : reports.length === 0 ? (
                    <Text style={styles.emptyText}>Todavía no hay reportes vecinales.</Text>
                ) : (
                    reports.map(report => (
                        <ReportCard
                            key={report.id}
                            report={report}
                            // Локальный реестр используем только со старым бэкендом без is_mine
                            mine={report.is_mine ?? myReportIds.has(report.id)}
                            resolving={resolvingId === report.id}
                            onPress={() => router.push(`/report/${report.id}`)}
                            onResolve={() => confirmAndResolveReport({
                                reportId: report.id,
                                onStart: () => setResolvingId(report.id),
                                onResolved: () => fetchReports(),
                                onFinish: () => setResolvingId(null),
                            })}
                        />
                    ))
                )}
            </ScrollView>

            <View style={styles.fabRow}>
                <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={handleOpenModal}>
                <AlertTriangle size={20} color={DS.ink} strokeWidth={2.5} />
                <Text style={styles.fabText}>Reportar corte</Text>
                </TouchableOpacity>
            </View>

            <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={handleRequestClose}>
                <View style={styles.modalRoot} onLayout={event => setSheetRootHeight(event.nativeEvent.layout.height)}>
                    <TouchableOpacity style={styles.scrim} activeOpacity={1} onPress={closeModal} />
                    <View style={[
                        styles.sheet,
                        keyboardOverlap > 0 && { maxHeight: '100%' as const, paddingBottom: keyboardOverlap + 12 },
                    ]}>
                        <View style={styles.handle} />
                        <View style={styles.sheetHeader}>
                            <Text style={styles.sheetTitle}>¿No hay luz en tu zona?</Text>
                            <IconButton onPress={closeModal}>
                                <X size={22} color={DS.textMuted} />
                            </IconButton>
                        </View>
                        <Text style={styles.sheetBody}>
                            Usamos tu ubicación actual o una dirección manual dentro de Paraguay para registrar el reporte.
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
                </View>
            </Modal>
        </View>
    );
}

function ReportCard({
    report,
    mine,
    resolving,
    onPress,
    onResolve,
}: {
    report: Report;
    mine: boolean;
    resolving: boolean;
    onPress: () => void;
    onResolve: () => void;
}) {
    const color = avatarColors[report.id % avatarColors.length];
    const relative = relativeTime(report.created_at, { justNow: 'Hace instantes' });
    const address = formatAddress(report);
    const complete = report.confirmed;
    const closed = report.resolved;
    // Раньше здесь стояла заглушка `complete ? 3 : 1`, из-за которой
    // неподтверждённая метка всегда показывала "1 / 3": человек видел, что
    // сосед уже подтвердил его отключение, хотя не подтверждал никто.
    const confirmations = report.confirmation_count ?? 0;
    // Полоска тоже была захардкожена на треть и не зависела от данных.
    const pct = closed || complete
        ? 100
        : Math.min(Math.round((confirmations / CONFIRMATION_THRESHOLD) * 100), 100);
    const expiring = !closed && !complete && ageMinutes(report.created_at) >= EXPIRING_AFTER_MINUTES;
    const chipColor = closed || complete ? DS.greenLight : expiring ? DS.textMuted : DS.amber;
    const chipBg = closed || complete ? 'rgba(74,222,128,0.15)' : expiring ? 'rgba(100,116,139,0.15)' : 'rgba(251,191,36,0.15)';

    return (
        <TouchableOpacity activeOpacity={0.82} onPress={onPress}>
            <SectionCard style={styles.reportCard}>
                <View style={styles.reportTop}>
                    <View style={[styles.avatar, { backgroundColor: color }]}>
                        <Text style={styles.avatarText}>V</Text>
                    </View>
                    <View style={styles.reportIdentity}>
                        <Text style={styles.reportName}>Vecino #{formatVecinoId(report.id)}</Text>
                        <Text style={styles.reportTime}>{relative}</Text>
                    </View>
                    {mine ? <Text style={styles.mineTag}>Tu reporte</Text> : null}
                    {expiring ? <Text style={styles.expiring}>Expira pronto</Text> : null}
                </View>
                <Text style={styles.reportAddress}>{address}</Text>
                <View style={[styles.confirmChip, { backgroundColor: chipBg }]}>
                    <Text style={[styles.confirmText, { color: chipColor }]}>
                        {closed
                            ? report.resolved_reason === 'auto' ? 'Expirado' : 'Cerrado'
                            : complete ? 'Confirmado' : `${confirmations} / ${CONFIRMATION_THRESHOLD} confirmaciones`}
                    </Text>
                </View>
                <View style={styles.progress}>
                    <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: closed || complete ? DS.greenLight : DS.amber }]} />
                </View>
                {mine && !report.resolved ? (
                    <TouchableOpacity
                        style={[styles.resolveCardButton, resolving && styles.resolveCardButtonDisabled]}
                        activeOpacity={0.85}
                        disabled={resolving}
                        onPress={onResolve}
                    >
                        {resolving
                            ? <ActivityIndicator size="small" color={DS.greenLight} />
                            : <Text style={styles.resolveCardButtonText}>Ya volvió la luz</Text>}
                    </TouchableOpacity>
                ) : null}
            </SectionCard>
        </TouchableOpacity>
    );
}

function formatAddress(report: Report): string {
    return [
        report.street,
        report.house,
        report.barrio,
        report.city,
    ].filter(Boolean).join(', ') || 'Ubicacion no especificada';
}

const avatarColors = [DS.violet, DS.blue, DS.green, DS.red];

function isWithinParaguay(lat: number, lon: number): boolean {
    return lat >= PARAGUAY_BOUNDS.minLat
        && lat <= PARAGUAY_BOUNDS.maxLat
        && lon >= PARAGUAY_BOUNDS.minLon
        && lon <= PARAGUAY_BOUNDS.maxLon;
}

const PLUS_CODE_RE = /^[23456789CFGHJMPQRVWX]{4,}\+[23456789CFGHJMPQRVWX]{2,}$/i;
function cleanGeoField(value: string | null | undefined): string {
    if (!value) return '';
    return PLUS_CODE_RE.test(value.trim()) ? '' : value;
}

function isParaguayGeocode(geocode?: Location.LocationGeocodedAddress | null): boolean {
    if (!geocode) return true;

    const country = geocode.country?.trim().toLowerCase();
    const isoCode = geocode.isoCountryCode?.trim().toUpperCase();

    return isoCode === 'PY' || country === 'paraguay';
}

function buildOutsideCoverageMessage(city?: string | null): string {
    const cityName = city?.trim();

    if (cityName) {
        return `LuzAlerts por ahora solo registra cortes dentro de Paraguay. ${cityName} queda fuera de cobertura, así que no podemos tomar ese reporte todavía.`;
    }

    return 'LuzAlerts por ahora solo registra cortes dentro de Paraguay. La ubicación que enviaste queda fuera de cobertura, así que no podemos tomar ese reporte todavía.';
}

function getReportSubmitError(error: unknown, city?: string | null): { title: string; message: string } {
    if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const detail = getErrorDetail(error.response?.data);

        if (status === 400 && detail?.includes('No se pudo determinar la ubicación')) {
            return {
                title: 'Dirección fuera de cobertura',
                message: `${buildOutsideCoverageMessage(city)} Revisá ciudad y calle, o usá tu ubicación actual.`,
            };
        }

        if (status === 429) {
            return {
                title: 'Demasiados intentos',
                message: 'Ya recibimos varios intentos desde este dispositivo. Probá de nuevo en un rato.',
            };
        }

        if (!error.response) {
            return {
                title: 'Sin conexión',
                message: 'No pudimos comunicarnos con el servidor. Revisá tu conexión e intentá de nuevo.',
            };
        }

        if (detail) {
            return {
                title: 'No pudimos enviar el reporte',
                message: detail,
            };
        }
    }

    return {
        title: 'Error',
        message: 'Hubo un problema al enviar el reporte. Intentá de nuevo en unos segundos.',
    };
}

function getErrorDetail(data: unknown): string | null {
    if (typeof data === 'string') return data;
    if (!data || typeof data !== 'object') return null;

    const detail = (data as { detail?: unknown }).detail;
    if (typeof detail === 'string') return detail;

    return null;
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
    loader: {
        paddingTop: 24,
    },
    emptyText: {
        color: DS.textMuted,
        textAlign: 'center',
        paddingTop: 24,
        fontSize: 14,
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
    mineTag: {
        color: DS.greenLight,
        backgroundColor: 'rgba(74,222,128,0.15)',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 3,
        fontSize: 11,
        fontWeight: '800',
    },
    resolveCardButton: {
        marginTop: 12,
        minHeight: 38,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: DS.green,
        backgroundColor: 'rgba(34,197,94,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 12,
    },
    resolveCardButtonDisabled: {
        opacity: 0.6,
    },
    resolveCardButtonText: {
        color: DS.greenLight,
        fontSize: 13,
        fontWeight: '800',
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
        // Без flexShrink шит держит высоту содержимого, и при поднятой
        // клавиатуре кнопка уезжает под неё.
        flexShrink: 1,
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
        // Жёсткая высота не давала форме ужаться под клавиатуру. Теперь
        // ScrollView сжимается сам, а содержимое остаётся прокручиваемым.
        flexGrow: 0,
        flexShrink: 1,
    },
    formGroup: {
        // flexShrink шита распространялся на группы полей: последняя
        // ("Comentario") схлопывалась в полоску 9px, контент становился ровно
        // по высоте вьюпорта, и ScrollView нечего было прокручивать.
        flexShrink: 0,
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
    successScroll: {
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    successSkip: {
        paddingVertical: 16,
        paddingHorizontal: 24,
    },
    successSkipText: {
        color: DS.textMuted,
        fontSize: 15,
        fontWeight: '700',
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
        marginBottom: 24,
    },
    successButton: {
        alignSelf: 'stretch',
    },
});
