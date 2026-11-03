/**
 * Веб-замена react-native-maps для PWA на MapLibre GL.
 *
 * react-native-maps на вебе не собирается (импортирует внутренности
 * react-native), поэтому экраны импортируют карту из src/maps, а Metro на
 * web-таргете подставляет этот файл. Реализовано ровно то подмножество API,
 * которым пользуются экраны: initialRegion/region, onPress,
 * onRegionChangeComplete(region, { isGesture }), onMapReady,
 * ref.animateToRegion, Marker с кастомной вьюхой или pinColor.
 *
 * Mapa vectorial (MapLibre GL + OpenFreeMap): se dibuja según la densidad
 * de la pantalla, así que en el iPhone (DPR 3) textos y líneas salen
 * nítidos. Los tiles raster de OSM (Leaflet) eran de 256 px sin @2x y en
 * retina se veían borrosos, y oscurecerlos con un filtro CSS les quitaba
 * contraste. OpenFreeMap es gratis, sin clave y sin límite de pedidos. Su
 * estilo "dark" se recolorea a la paleta de la app (como darkMapStyle del
 * mapa nativo), ver recolorStyle. Otro estilo (MapTiler, servidor propio):
 * definir EXPO_PUBLIC_MAP_STYLE_URL al compilar, y se usa tal cual.
 */
import 'maplibre-gl/dist/maplibre-gl.css';
import { Map as MLMap, Marker as MLMarker, type StyleSpecification } from 'maplibre-gl';
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

const CUSTOM_STYLE_URL = process.env.EXPO_PUBLIC_MAP_STYLE_URL;
const STYLE_URL = CUSTOM_STYLE_URL || 'https://tiles.openfreemap.org/styles/dark';
const MAP_BG = '#0F172A'; // DS.bg

// Colores de las capas del estilo "dark" de OpenFreeMap (esquema
// OpenMapTiles) en la paleta de la app: fondo azul oscuro, calles un poco
// más claras, textos apagados. Una capa que no está en la lista queda igual.
const LAYER_COLORS: Record<string, Record<string, string | number>> = {
    background: { 'background-color': MAP_BG },
    water: { 'fill-color': '#0C2340' },
    waterway: { 'line-color': '#0C2340' },
    landuse_residential: { 'fill-color': '#111B2E' },
    landcover_wood: { 'fill-color': '#0E1D26' },
    landuse_park: { 'fill-color': '#0E1D26' },
    building: { 'fill-color': '#131D31', 'fill-outline-color': '#1A2740' },
    'aeroway-area': { 'fill-color': '#111A2C' },
    'aeroway-taxiway': { 'line-color': '#1B2940' },
    'aeroway-runway': { 'line-color': '#1B2940' },
    'aeroway-runway-casing': { 'line-color': '#24344F' },
    road_area_pier: { 'fill-color': MAP_BG },
    road_pier: { 'line-color': MAP_BG },
    highway_path: { 'line-color': '#1B2940' },
    highway_minor: { 'line-color': '#1C2A42' },
    highway_major_casing: { 'line-color': '#2B3D5C' },
    highway_major_inner: { 'line-color': '#22324D' },
    highway_major_subtle: { 'line-color': '#22324D' },
    highway_motorway_casing: { 'line-color': '#3A4F78' },
    highway_motorway_inner: { 'line-color': '#2C3F63' },
    highway_motorway_subtle: { 'line-color': '#22324D' },
    railway_transit: { 'line-color': '#1E2A3F' },
    railway_minor: { 'line-color': '#1E2A3F' },
    railway: { 'line-color': '#1E2A3F' },
    railway_transit_dashline: { 'line-color': MAP_BG },
    railway_minor_dashline: { 'line-color': MAP_BG },
    railway_dashline: { 'line-color': MAP_BG },
    boundary_state: { 'line-color': '#334155' },
    'boundary_country_z0-4': { 'line-color': '#475569' },
    'boundary_country_z5-': { 'line-color': '#475569' },
    water_name: { 'text-color': '#3B5378', 'text-halo-color': MAP_BG },
    highway_name_other: { 'text-color': '#7C8BA1', 'text-halo-color': MAP_BG },
    highway_name_motorway: { 'text-color': '#8A99AF' },
};
const PLACE_TEXT = { 'text-color': '#94A3B8', 'text-halo-color': 'rgba(15,23,42,0.85)' };

const recolorStyle = (style: StyleSpecification): StyleSpecification => ({
    ...style,
    layers: style.layers.map(layer => {
        const colors = LAYER_COLORS[layer.id] ?? (layer.id.startsWith('place_') ? PLACE_TEXT : null);
        if (!colors) return layer;
        return { ...layer, paint: { ...(layer as { paint?: object }).paint, ...colors } } as typeof layer;
    }),
});

let mapCssInjected = false;
const injectMapCss = () => {
    if (mapCssInjected || typeof document === 'undefined') return;
    mapCssInjected = true;
    const style = document.createElement('style');
    style.textContent =
        '.maplibregl-map { background: #0F172A; font-family: inherit; }' +
        '.maplibregl-ctrl-attrib { background: rgba(15,23,42,.7) !important; color: #94A3B8; font: 11px/16px system-ui, sans-serif; }' +
        '.maplibregl-ctrl-attrib a { color: #CBD5E1; }' +
        '.maplibregl-ctrl-attrib-button { filter: invert(1); }';
    document.head.appendChild(style);
};

const MapContext = createContext<MLMap | null>(null);

type Bounds = [[number, number], [number, number]];

// MapLibre usa [lng, lat], no [lat, lng] como Leaflet.
const regionToBounds = (r: Region): Bounds => [
    [r.longitude - r.longitudeDelta / 2, r.latitude - r.latitudeDelta / 2],
    [r.longitude + r.longitudeDelta / 2, r.latitude + r.latitudeDelta / 2],
];

const boundsToRegion = (map: MLMap): Region => {
    const b = map.getBounds();
    const c = map.getCenter();
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
    const [map, setMap] = useState<MLMap | null>(null);
    // Сдвиг карты, начатый кодом (animateToRegion / region), а не пальцем:
    // экран по details.isGesture решает, сохранять ли viewport.
    const programmaticRef = useRef(false);
    const callbacksRef = useRef({ onPress, onRegionChangeComplete, onMapReady });
    callbacksRef.current = { onPress, onRegionChangeComplete, onMapReady };

    const moveTo = (target: Region, duration = 0) => {
        if (!map) return;
        programmaticRef.current = true;
        if (duration > 0) {
            map.fitBounds(regionToBounds(target), { duration, essential: true });
        } else {
            map.fitBounds(regionToBounds(target), { animate: false });
        }
    };

    useImperativeHandle(ref, () => ({ animateToRegion: moveTo }), [map]);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        injectMapCss();
        const start = region ?? initialRegion;
        let instance: MLMap;
        try {
            instance = new MLMap({
                container: el,
                ...(start
                    ? { bounds: regionToBounds(start) }
                    : { center: [-57.5759, -25.2637] as [number, number], zoom: 12 }),
                maxZoom: 19,
                attributionControl: { compact: true },
                // Mapa plano, como en la app nativa: sin rotar ni inclinar.
                dragRotate: false,
                pitchWithRotate: false,
                touchPitch: false,
                dragPan: scrollEnabled,
                keyboard: scrollEnabled || zoomEnabled,
                scrollZoom: zoomEnabled,
                touchZoomRotate: zoomEnabled,
                doubleClickZoom: zoomEnabled,
                boxZoom: zoomEnabled,
            });
        } catch {
            // Sin WebGL no hay mapa; la pantalla sigue andando, con el fondo solo.
            return;
        }
        instance.touchZoomRotate.disableRotation();
        instance.setStyle(STYLE_URL, {
            transformStyle: CUSTOM_STYLE_URL ? undefined : (_prev, next) => recolorStyle(next),
        });

        instance.on('click', e => {
            callbacksRef.current.onPress?.({
                nativeEvent: { coordinate: { latitude: e.lngLat.lat, longitude: e.lngLat.lng } },
            });
        });
        instance.on('moveend', e => {
            // Un gesto con el dedo trae originalEvent (también la inercia
            // después de deslizar); los movimientos desde el código, no.
            const isGesture = !!e.originalEvent || !programmaticRef.current;
            programmaticRef.current = false;
            callbacksRef.current.onRegionChangeComplete?.(boundsToRegion(instance), { isGesture });
        });

        // Контейнер RN Web может получить размер уже после монтирования.
        const observer = typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(() => instance.resize())
            : null;
        observer?.observe(el);

        setMap(instance);
        // 'load' espera el estilo y los primeros tiles; los marcadores pueden ir antes.
        instance.once('load', () => {
            // La atribución compacta arranca abierta y tapa la parte de abajo;
            // la dejamos como el botón (i), el texto aparece al tocarlo.
            instance.getContainer()
                .querySelector('.maplibregl-ctrl-attrib')
                ?.classList.remove('maplibregl-compact-show');
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
    const markerRef = useRef<MLMarker | null>(null);
    const onPressRef = useRef(onPress);
    onPressRef.current = onPress;
    const coordRef = useRef(coordinate);
    coordRef.current = coordinate;

    useImperativeHandle(ref, () => ({ redraw: () => {}, showCallout: () => {}, hideCallout: () => {} }), []);

    useEffect(() => {
        if (!map) return;
        // El elemento se centra en el punto (anchor center), así que la vista
        // del marcador puede tener cualquier tamaño.
        const element = document.createElement('div');
        element.style.cursor = 'pointer';
        const onClick = (e: MouseEvent) => {
            // Si no, el mismo toque llega al mapa como onPress en un lugar vacío.
            e.stopPropagation();
            onPressRef.current?.({
                stopPropagation: () => {},
                nativeEvent: {
                    coordinate: { latitude: coordRef.current.latitude, longitude: coordRef.current.longitude },
                    action: 'marker-press',
                },
            });
        };
        element.addEventListener('click', onClick);
        const marker = new MLMarker({ element, anchor: 'center' })
            .setLngLat([coordinate.longitude, coordinate.latitude])
            .addTo(map);
        markerRef.current = marker;
        setHost(element);
        return () => {
            element.removeEventListener('click', onClick);
            marker.remove();
            markerRef.current = null;
            setHost(null);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map]);

    useEffect(() => {
        markerRef.current?.setLngLat([coordinate.longitude, coordinate.latitude]);
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

    return createPortal(content, host);
});
