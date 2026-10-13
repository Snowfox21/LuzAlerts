/**
 * Веб-замена react-native-maps для PWA на Leaflet.
 *
 * react-native-maps на вебе не собирается (импортирует внутренности
 * react-native), поэтому экраны импортируют карту из src/maps, а Metro на
 * web-таргете подставляет этот файл. Реализовано ровно то подмножество API,
 * которым пользуются экраны: initialRegion/region, onPress,
 * onRegionChangeComplete(region, { isGesture }), onMapReady,
 * ref.animateToRegion, Marker с кастомной вьюхой или pinColor.
 *
 * Тайлы: по умолчанию стандартные тайлы OpenStreetMap, затемненные CSS-фильтром
 * под темную тему приложения. CARTO dark_all без ключа теперь отдает
 * водяной знак "API KEY REQUIRED", поэтому не используется. Для боевой
 * нагрузки лучше провайдер с ключом (MapTiler, Stadia): задать
 * EXPO_PUBLIC_MAP_TILE_URL (и EXPO_PUBLIC_MAP_TILE_ATTRIBUTION) при сборке,
 * тогда фильтр затемнения не применяется — такие стили уже темные.
 */
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import React, {
    createContext,
    forwardRef,
    useContext,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from 'react';
import { createPortal } from 'react-dom';
import { StyleProp, View, ViewStyle } from 'react-native';

export interface LatLng {
    latitude: number;
    longitude: number;
}

export interface Region extends LatLng {
    latitudeDelta: number;
    longitudeDelta: number;
}

export interface MapPressEvent {
    nativeEvent: { coordinate: LatLng; action?: string };
}

export interface MarkerPressEvent extends MapPressEvent {
    stopPropagation: () => void;
}

export interface Details {
    isGesture?: boolean;
}

export interface MapViewHandle {
    animateToRegion: (region: Region, duration?: number) => void;
}

export interface MapMarker {
    redraw: () => void;
    showCallout: () => void;
    hideCallout: () => void;
}

const CUSTOM_TILE_URL = process.env.EXPO_PUBLIC_MAP_TILE_URL;
const TILE_URL = CUSTOM_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION =
    process.env.EXPO_PUBLIC_MAP_TILE_ATTRIBUTION ||
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const DARK_TILES_CLASS = 'luz-dark-tiles';

// Светлые тайлы OSM -> темная карта: инверсия + разворот оттенка обратно,
// чтобы вода осталась синеватой, а парки зеленоватыми.
let darkTilesStyleInjected = false;
const injectDarkTilesStyle = () => {
    if (darkTilesStyleInjected || typeof document === 'undefined') return;
    darkTilesStyleInjected = true;
    const style = document.createElement('style');
    style.textContent =
        `.${DARK_TILES_CLASS} { filter: invert(100%) hue-rotate(180deg) brightness(0.9) contrast(0.9) saturate(0.6); }` +
        '.leaflet-container { background: #0F172A; font-family: inherit; }' +
        '.leaflet-control-attribution { background: rgba(15,23,42,.7) !important; color: #94A3B8; }' +
        '.leaflet-control-attribution a { color: #CBD5E1; }';
    document.head.appendChild(style);
};
const MAP_BG = '#0F172A'; // DS.bg

const MapContext = createContext<L.Map | null>(null);

const regionToBounds = (r: Region): L.LatLngBoundsExpression => [
    [r.latitude - r.latitudeDelta / 2, r.longitude - r.longitudeDelta / 2],
    [r.latitude + r.latitudeDelta / 2, r.longitude + r.longitudeDelta / 2],
];

const boundsToRegion = (map: L.Map): Region => {
    const b = map.getBounds();
    const c = b.getCenter();
    return {
        latitude: c.lat,
        longitude: c.lng,
        latitudeDelta: Math.abs(b.getNorth() - b.getSouth()),
        longitudeDelta: Math.abs(b.getEast() - b.getWest()),
    };
};

interface MapViewProps {
    style?: StyleProp<ViewStyle>;
    initialRegion?: Region;
    region?: Region;
    onPress?: (e: MapPressEvent) => void;
    onRegionChangeComplete?: (region: Region, details: Details) => void;
    onMapReady?: () => void;
    scrollEnabled?: boolean;
    zoomEnabled?: boolean;
    pointerEvents?: 'box-none' | 'none' | 'box-only' | 'auto';
    children?: React.ReactNode;
    // Остальные пропсы react-native-maps (customMapStyle, loadingEnabled,
    // pitchEnabled, rotateEnabled...) на вебе не нужны и игнорируются.
    // Типы экранов сверяются с нативным src/maps/index.ts, не с этим файлом.
}

const MapView = forwardRef<MapViewHandle, MapViewProps>(function MapView(props, ref) {
    const {
        style,
        initialRegion,
        region,
        onPress,
        onRegionChangeComplete,
        onMapReady,
        scrollEnabled = true,
        zoomEnabled = true,
        pointerEvents,
        children,
    } = props;

    const containerRef = useRef<HTMLDivElement | null>(null);
    const [map, setMap] = useState<L.Map | null>(null);
    // Сдвиг карты, начатый кодом (animateToRegion / region), а не пальцем:
    // экран по details.isGesture решает, сохранять ли viewport.
    const programmaticRef = useRef(false);
    const callbacksRef = useRef({ onPress, onRegionChangeComplete, onMapReady });
    callbacksRef.current = { onPress, onRegionChangeComplete, onMapReady };

    const moveTo = (target: Region, duration = 0) => {
        if (!map) return;
        programmaticRef.current = true;
        if (duration > 0) {
            map.flyToBounds(regionToBounds(target), { duration: duration / 1000 });
        } else {
            map.fitBounds(regionToBounds(target), { animate: false });
        }
    };

    useImperativeHandle(ref, () => ({ animateToRegion: moveTo }), [map]);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const start = region ?? initialRegion;
        const instance = L.map(el, {
            zoomControl: false,
            attributionControl: true,
            dragging: scrollEnabled,
            touchZoom: zoomEnabled,
            scrollWheelZoom: zoomEnabled,
            doubleClickZoom: zoomEnabled,
            boxZoom: zoomEnabled,
            keyboard: scrollEnabled || zoomEnabled,
        });
        injectDarkTilesStyle();
        L.tileLayer(TILE_URL, {
            attribution: TILE_ATTRIBUTION,
            maxZoom: 19,
            className: CUSTOM_TILE_URL ? undefined : DARK_TILES_CLASS,
        }).addTo(instance);
        instance.attributionControl.setPrefix(false);
        if (start) {
            instance.fitBounds(regionToBounds(start), { animate: false });
        } else {
            instance.setView([-25.2637, -57.5759], 12);
        }

        instance.on('click', (e: L.LeafletMouseEvent) => {
            callbacksRef.current.onPress?.({
                nativeEvent: { coordinate: { latitude: e.latlng.lat, longitude: e.latlng.lng } },
            });
        });
        instance.on('moveend', () => {
            const isGesture = !programmaticRef.current;
            programmaticRef.current = false;
            callbacksRef.current.onRegionChangeComplete?.(boundsToRegion(instance), { isGesture });
        });

        // Контейнер RN Web может получить размер уже после монтирования.
        const observer = typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(() => instance.invalidateSize())
            : null;
        observer?.observe(el);

        setMap(instance);
        instance.whenReady(() => {
            setTimeout(() => callbacksRef.current.onMapReady?.(), 0);
        });

        return () => {
            observer?.disconnect();
            instance.remove();
            setMap(null);
        };
        // Карта создается один раз: остальное синхронизируют эффекты ниже.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Контролируемый region (мини-карта на экране отключения).
    const regionKey = region
        ? `${region.latitude}:${region.longitude}:${region.latitudeDelta}:${region.longitudeDelta}`
        : '';
    useEffect(() => {
        if (map && region) moveTo(region, 0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map, regionKey]);

    return (
        <View style={[{ backgroundColor: MAP_BG, overflow: 'hidden' }, style]} pointerEvents={pointerEvents}>
            <div
                ref={containerRef}
                style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, background: MAP_BG }}
            />
            <MapContext.Provider value={map}>{map ? children : null}</MapContext.Provider>
        </View>
    );
});

export default MapView;

interface MarkerProps {
    coordinate: LatLng;
    onPress?: (e: MarkerPressEvent) => void;
    pinColor?: string;
    children?: React.ReactNode;
    // anchor, centerOffset, tracksViewChanges — нативные нюансы, на вебе
    // кастомная вьюха и так центрируется на точке, пропсы игнорируются.
}

export const Marker = forwardRef<MapMarker, MarkerProps>(function Marker(
    { coordinate, onPress, pinColor, children },
    ref,
) {
    const map = useContext(MapContext);
    const [host, setHost] = useState<HTMLElement | null>(null);
    const markerRef = useRef<L.Marker | null>(null);
    const onPressRef = useRef(onPress);
    onPressRef.current = onPress;

    useImperativeHandle(ref, () => ({ redraw: () => {}, showCallout: () => {}, hideCallout: () => {} }), []);

    useEffect(() => {
        if (!map) return;
        // Иконка нулевого размера на точке; содержимое центрируется внутри
        // сдвигом -50%/-50%, так что размер вьюхи маркера может быть любым.
        const icon = L.divIcon({ className: 'luz-marker', iconSize: [0, 0], html: '' });
        const marker = L.marker([coordinate.latitude, coordinate.longitude], {
            icon,
            keyboard: false,
            interactive: true,
            bubblingMouseEvents: false,
        }).addTo(map);
        marker.on('click', (e: L.LeafletMouseEvent) => {
            L.DomEvent.stopPropagation(e);
            onPressRef.current?.({
                stopPropagation: () => {},
                nativeEvent: {
                    coordinate: { latitude: e.latlng.lat, longitude: e.latlng.lng },
                    action: 'marker-press',
                },
            });
        });
        markerRef.current = marker;
        setHost(marker.getElement() ?? null);
        return () => {
            marker.remove();
            markerRef.current = null;
            setHost(null);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map]);

    useEffect(() => {
        markerRef.current?.setLatLng([coordinate.latitude, coordinate.longitude]);
    }, [coordinate.latitude, coordinate.longitude]);

    if (!host) return null;

    const content = children ?? (
        <div
            style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                background: pinColor ?? '#F59E0B',
                border: '3px solid #fff',
                boxShadow: '0 1px 4px rgba(0,0,0,.5)',
            }}
        />
    );

    return createPortal(
        <div
            style={{
                position: 'absolute',
                left: 0,
                top: 0,
                transform: 'translate(-50%, -50%)',
                cursor: 'pointer',
            }}
        >
            {content}
        </div>,
        host,
    );
});
