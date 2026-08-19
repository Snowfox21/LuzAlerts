import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, PixelRatio, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { MapMarker, Marker, MapPressEvent, Region } from 'react-native-maps';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { AlertTriangle, LocateFixed, Settings, Zap } from 'lucide-react-native';
import { Outage, OutageSource, OutageStatus } from '../../src/api/types';
import apiClient from '../../src/api/client';
import { OutageCard } from '../../src/components/OutageCard';
import { DS, IconButton, sharedStyles, statusMeta } from '../../src/components/DesignSystem';
import { darkMapStyle } from '../../src/theme/mapStyle';

// react-native-maps на новой архитектуре не сообщает нативной стороне размер вьюхи маркера
// (MapMarkerManager.updateExtraData вызывается только из шэдоу-ноды старой архитектуры),
// поэтому MapMarker.createDrawable всегда рисует битмап ровно 100x100 ФИЗИЧЕСКИХ пикселей
// и все, что крупнее, обрезается. Значит вся вьюха маркера должна укладываться в эти 100 px.
const MARKER_BOX = PixelRatio.roundToNearestPixel(100 / PixelRatio.get());
const MARKER_SELECTED_SCALE = 1.2;
// квадрат считаем от бокса с запасом, чтобы увеличенный вариант тоже влезал целиком
const MARKER_SQUARE = PixelRatio.roundToNearestPixel((MARKER_BOX - 1) / MARKER_SELECTED_SCALE);
// иконка занимает ту же долю квадрата, что и раньше (14 из 30)
const MARKER_ICON = Math.max(9, Math.round(MARKER_SQUARE * 0.47));

const ASUNCION: Region = {
    latitude: -25.2637,
    longitude: -57.5759,
    latitudeDelta: 0.18,
    longitudeDelta: 0.18,
};

export default function MapScreen() {
    const { top } = useSafeAreaInsets();
    const [outages, setOutages] = useState<Outage[]>([]);
    // спиннер только на самую первую загрузку, фоновые обновления карту не размонтируют
    const [initialLoading, setInitialLoading] = useState(true);
    const [selectedOutage, setSelectedOutage] = useState<Outage | null>(null);
    const [savedRegion, setSavedRegion] = useState<Region>(ASUNCION);
    const [sheetHeight, setSheetHeight] = useState(0);
    // на Android битмап кастомного маркера снимается сразу, до раскладки вложенной View,
    // поэтому первое время после монтирования и после обновления списка трекаем изменения
    const [tracksChanges, setTracksChanges] = useState(true);
    // счетчик монтирований карты: MapView размонтируется при расфокусе таба, и новым
    // маркерам снова нужно окно трекинга, иначе они остаются пустыми
    const [mapEpoch, setMapEpoch] = useState(0);
    const router = useRouter();
    const mapRef = useRef<MapView>(null);
    const isFocused = useIsFocused();
    const tabBarHeight = useBottomTabBarHeight();
    // глобальные параметры: навигация идет на группу (tabs), сегмент может отличаться
    const { focusLat, focusLon } = useGlobalSearchParams<{ focusLat?: string; focusLon?: string }>();
    const pendingFocusRef = useRef<{ latitude: number; longitude: number } | null>(null);
    const mapReadyRef = useRef(false);
    const savedRegionRef = useRef<Region>(ASUNCION);
    const restoringRegionRef = useRef(true);
    const restoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const markerRefs = useRef(new Map<number, MapMarker>());

    const stopRestoreGuard = useCallback(() => {
        if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current);
        restoreTimerRef.current = null;
        restoringRegionRef.current = false;
    }, []);

    const finishRestoreAfter = useCallback((delay: number) => {
        if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current);
        restoreTimerRef.current = setTimeout(stopRestoreGuard, delay);
    }, [stopRestoreGuard]);

    const saveRegion = useCallback((region: Region) => {
        savedRegionRef.current = region;
        setSavedRegion(region);
    }, []);

    const fetchOutages = async () => {
        try {
            let fetchedOutages: Outage[] = [];
            let mappedReports: Outage[] = [];

            try {
                const outagesRes = await apiClient.get<Outage[]>('/outages/');
                fetchedOutages = (outagesRes.data || []).filter(o => o.latitude && o.longitude);
            } catch (err) {
                console.warn('Error fetching official outages:', err);
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
                console.warn('Error fetching user reports:', err);
            }

            setOutages([...fetchedOutages, ...mappedReports]);
        } catch (error) {
            console.error('General error fetching data for map:', error);
        } finally {
            setInitialLoading(false);
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
                    saveRegion({
                        latitude: pos.coords.latitude,
                        longitude: pos.coords.longitude,
                        latitudeDelta: 0.1,
                        longitudeDelta: 0.1,
                    });
                })
                .catch(() => {});
        });
    }, [saveRegion]);

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

    const selectedId = selectedOutage?.id ?? null;

    useEffect(() => {
        // После двух кадров SVG уже нарисован. Явно переснимаем битмап и закрываем
        // общее окно трекинга, чтобы постоянный трекинг не съедал тапы.
        if (!isFocused) return;
        setTracksChanges(true);

        let secondFrame = 0;
        let captureTimer: ReturnType<typeof setTimeout> | null = null;
        const firstFrame = requestAnimationFrame(() => {
            secondFrame = requestAnimationFrame(() => {
                markerRefs.current.forEach(marker => marker.redraw());
                captureTimer = setTimeout(() => {
                    markerRefs.current.forEach(marker => marker.redraw());
                    setTracksChanges(false);
                }, 250);
            });
        });

        return () => {
            cancelAnimationFrame(firstFrame);
            if (secondFrame) cancelAnimationFrame(secondFrame);
            if (captureTimer) clearTimeout(captureTimer);
        };
    }, [outages, isFocused, mapEpoch, selectedId]);

    // центрируем только когда карта реально смонтирована и готова, иначе анимация уходит в никуда
    const applyFocus = useCallback(() => {
        const target = pendingFocusRef.current;
        if (!target || !mapReadyRef.current) return;
        pendingFocusRef.current = null;
        const region = { ...target, latitudeDelta: 0.01, longitudeDelta: 0.01 };
        saveRegion(region);
        mapRef.current?.animateToRegion(region, 600);
        if (restoringRegionRef.current) finishRestoreAfter(700);
    }, [finishRestoreAfter, saveRegion]);

    useEffect(() => {
        if (!isFocused || !focusLat || !focusLon) return;
        const latitude = parseFloat(focusLat);
        const longitude = parseFloat(focusLon);
        if (Number.isNaN(latitude) || Number.isNaN(longitude)) return;
        pendingFocusRef.current = { latitude, longitude };
        // Убираем обработанные параметры, чтобы те же координаты можно было открыть повторно
        router.setParams({ focusLat: undefined, focusLon: undefined });
        applyFocus();
    }, [focusLat, focusLon, isFocused, router, applyFocus]);

    useEffect(() => {
        // при расфокусе MapView размонтируется, значит готовность надо сбросить
        if (!isFocused) {
            mapReadyRef.current = false;
            restoringRegionRef.current = true;
            if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current);
            restoreTimerRef.current = null;
        }
    }, [isFocused]);

    useEffect(() => () => {
        if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current);
    }, []);


    const centerOnUser = async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const region = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            latitudeDelta: 0.06,
            longitudeDelta: 0.06,
        };
        saveRegion(region);
        mapRef.current?.animateToRegion(region, 650);
    };

    if (initialLoading) {
        return (
            <View style={sharedStyles.center}>
                <ActivityIndicator size="large" color={DS.amber} />
            </View>
        );
    }

    if (!isFocused) {
        // экран не в фокусе: не рендерим MapView и оверлеи, чтобы нативный SurfaceView
        // и его контролы не просвечивали поверх других табов на Android
        return <View style={styles.container} />;
    }

    return (
        <View style={styles.container}>
            <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={savedRegion}
                customMapStyle={darkMapStyle}
                loadingEnabled
                loadingBackgroundColor={DS.bg}
                loadingIndicatorColor={DS.amber}
                onRegionChangeComplete={(region, details) => {
                    // Mount-события не должны затирать сохраненный viewport.
                    if (restoringRegionRef.current && !details.isGesture) return;
                    if (details.isGesture) stopRestoreGuard();
                    saveRegion(region);
                }}
                onMapReady={() => {
                    mapReadyRef.current = true;
                    setMapEpoch(epoch => epoch + 1);
                    if (pendingFocusRef.current) {
                        applyFocus();
                    } else {
                        mapRef.current?.animateToRegion(savedRegionRef.current, 0);
                        finishRestoreAfter(500);
                    }
                }}
                onPress={(e: MapPressEvent) => {
                    // на Android тап по маркеру тоже долетает как press карты отдельным нативным
                    // событием — stopPropagation в Marker его не гасит, поэтому фильтруем тут
                    if (e.nativeEvent.action === 'marker-press') return;
                    setSelectedOutage(null);
                }}
                zoomEnabled
                scrollEnabled
                pitchEnabled
                rotateEnabled
            >
                {outages.map(outage => {
                    const meta = statusMeta(outage.status, outage.source);
                    const selected = selectedOutage?.id === outage.id;
                    return (
                        <Marker
                            key={outage.id}
                            ref={marker => {
                                if (marker) markerRefs.current.set(outage.id, marker);
                                else markerRefs.current.delete(outage.id);
                            }}
                            coordinate={{ latitude: outage.latitude!, longitude: outage.longitude! }}
                            // якорь задаем явно: у кастомной View размер меняется, а дефолтный
                            // якорь на Android при этом уезжает с точки
                            anchor={{ x: 0.5, y: 0.5 }}
                            centerOffset={{ x: 0, y: 0 }}
                            // окно трекинга общее для всех маркеров: держать его по selected
                            // нельзя, иначе битмап после снятия выбора не пересъемется
                            tracksViewChanges={tracksChanges}
                            onPress={e => {
                                e.stopPropagation();
                                setSelectedOutage(outage);
                            }}
                        >
                            <View style={styles.markerWrap}>
                                <View
                                    style={[
                                        styles.marker,
                                        { backgroundColor: meta.color },
                                        // масштабируем сам квадрат, а не обертку: размер обертки
                                        // (и снимаемого битмапа) не меняется никогда
                                        selected && { transform: [{ scale: MARKER_SELECTED_SCALE }] },
                                    ]}
                                >
                                    <AlertTriangle size={MARKER_ICON} color={DS.ink} strokeWidth={3} />
                                </View>
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

            <View style={[styles.legend, { bottom: tabBarHeight + 20 }]}>
                {[
                    { color: DS.redLight, label: 'Activo' },
                    { color: DS.amber, label: 'Programado' },
                    { color: DS.greenLight, label: 'Resuelto' },
                    { color: DS.violetLight, label: 'Vecinal' },
                ].map(({ color, label }) => (
                    <View key={label} style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: color }]} />
                        <Text style={styles.legendText}>{label}</Text>
                    </View>
                ))}
            </View>

            <View
                style={[
                    styles.fabs,
                    { bottom: tabBarHeight + 24 },
                    selectedOutage && { bottom: sheetHeight + 16 },
                ]}
            >
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
                <View
                    style={[styles.sheet, { paddingBottom: tabBarHeight + 16 }]}
                    onLayout={e => setSheetHeight(e.nativeEvent.layout.height)}
                >
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
    markerWrap: {
        // ровно 100 физических пикселей — столько и рисует нативная сторона, поэтому
        // ничего не обрезается, а якорь 0.5/0.5 попадает точно в центр квадрата
        width: MARKER_BOX,
        height: MARKER_BOX,
        alignItems: 'center',
        justifyContent: 'center',
    },
    marker: {
        width: MARKER_SQUARE,
        height: MARKER_SQUARE,
        borderRadius: Math.round(MARKER_SQUARE * 0.27),
        alignItems: 'center',
        justifyContent: 'center',
        // elevation убрана: тень рисуется за границами вьюхи и обрезалась бы битмапом,
        // контраст на темной карте дает темная рамка
        borderWidth: 1.5,
        borderColor: DS.ink,
    },
    legend: {
        position: 'absolute',
        left: 12,
        // bottom считается от высоты таб-бара (см. inline-стиль в рендере)
        backgroundColor: 'rgba(13,22,38,0.85)',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        gap: 5,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    legendDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    legendText: {
        color: DS.textMid,
        fontSize: 11,
        fontWeight: '600',
    },
    fabs: {
        position: 'absolute',
        right: 16,
        // bottom считается от высоты таб-бара либо от высоты шторки (см. inline-стиль в рендере)
        alignItems: 'flex-end',
        gap: 10,
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
        // paddingBottom считается от высоты таб-бара (см. inline-стиль в рендере)
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
