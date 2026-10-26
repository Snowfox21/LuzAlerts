import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { takePendingLink } from '../src/utils/pendingLink';
import { AlertTriangle, Bell, BellRing, Building2, Home, MapPin, Zap } from 'lucide-react-native';
import { DS, PrimaryButton } from '../src/components/DesignSystem';
import { HomeZoneEditor } from '../src/places/HomeZoneEditor';
import { TrackedPlacesEditor } from '../src/places/TrackedPlacesEditor';
import { getHomeZone } from '../src/utils/homeZone';
import { WhatsAppButton } from '../src/share/WhatsAppButton';

export const ONBOARDING_KEY = '@luzalerts_onboarding_done';

const LEGEND_ITEMS = [
    {
        color: DS.redLight,
        pulse: true,
        term: 'Activo',
        body: 'Sin luz en este momento. Tocá el pin para ver detalles.',
    },
    {
        color: DS.amber,
        pulse: false,
        term: 'Programado',
        body: 'Corte planificado por la ANDE — con horario anunciado.',
    },
    {
        color: DS.greenLight,
        pulse: false,
        term: 'Resuelto',
        body: 'La luz ya volvió. Se mantiene visible por 7 días.',
    },
    {
        color: DS.violetLight,
        pulse: false,
        term: 'Vecinal',
        body: 'Reportado por usuarios cerca tuyo. Se confirma con 3 reportes.',
    },
];

// Квадрат без хвостика — как маркеры на карте.
function LegendPin({ color, pulse }: { color: string; pulse: boolean }) {
    return (
        <View style={styles.pinWrap}>
            {pulse && (
                <>
                    <View style={[styles.pulseOuter, { backgroundColor: color }]} />
                    <View style={[styles.pulseInner, { backgroundColor: color }]} />
                </>
            )}
            <View style={[styles.pinBody, { backgroundColor: color }]}>
                <AlertTriangle size={17} color={DS.ink} strokeWidth={2.4} />
            </View>
        </View>
    );
}

function LegendRow({ color, pulse, term, body }: typeof LEGEND_ITEMS[0]) {
    return (
        <View style={styles.legendRow}>
            <LegendPin color={color} pulse={pulse} />
            <View style={styles.legendText}>
                <View style={styles.legendHeader}>
                    <Text style={styles.legendTerm}>{term}</Text>
                    <Text style={[styles.legendBadge, { color }]}>{term.toUpperCase()}</Text>
                </View>
                <Text style={styles.legendBody}>{body}</Text>
            </View>
        </View>
    );
}

interface Slide {
    key: string;
    Icon: typeof Zap | null;
    iconColor: string;
    iconBg: string;
    title: string;
    body: string;
    cta: string;
    /** Вместо "Saltar": пропустить только этот слайд. */
    secondary?: string;
}

const SLIDES: Slide[] = [
    {
        key: 'welcome',
        Icon: Zap,
        iconColor: DS.amberDim,
        iconBg: 'rgba(245,158,11,0.14)',
        title: 'Cortes de luz\nen tiempo real',
        body: 'Datos oficiales de la ANDE actualizados cada hora, más reportes de usuarios de toda Paraguay.',
        cta: 'Siguiente',
    },
    {
        key: 'map',
        Icon: MapPin,
        iconColor: DS.red,
        iconBg: 'rgba(239,68,68,0.14)',
        title: 'Tu zona,\nsiempre actualizada',
        body: 'El mapa muestra cortes planificados y activos cerca de vos. Si hay un corte, podés reportarlo en un toque.',
        cta: 'Siguiente',
    },
    {
        key: 'legend',
        Icon: null,
        iconColor: '',
        iconBg: '',
        title: 'Conocé los marcadores',
        body: 'Cada color en el mapa indica el estado del corte.',
        cta: 'Siguiente',
    },
    {
        // Сначала "зачем" (пример пуша про дом мамы), а редактор мест —
        // только по "Agregar una zona": без мотивации шаг с полями пропускают.
        key: 'zones',
        Icon: null,
        iconColor: '',
        iconBg: '',
        title: 'Cuidá también\na los tuyos',
        body: 'Seguí hasta 2 lugares más, como la casa de tus padres o tu oficina, aunque estén en otra ciudad.',
        cta: 'Agregar una zona',
        secondary: 'Ahora no',
    },
    {
        key: 'share',
        Icon: null,
        iconColor: '',
        iconBg: '',
        title: 'Avisá a tu familia\npor WhatsApp',
        body: 'Que nadie se quede a oscuras sin aviso. Mandá el corte con un toque: horario, zona y mapa incluidos.',
        cta: 'Siguiente',
    },
    {
        key: 'notifications',
        Icon: BellRing,
        iconColor: '#0A84FF',
        iconBg: 'rgba(10,132,255,0.14)',
        title: 'Avisamos cuando\nhay un corte',
        body: 'Activá las notificaciones y la ubicación para recibir alertas cuando haya un corte cerca de tu zona o de tus lugares.',
        cta: 'Activar y empezar',
    },
];

export default function OnboardingScreen() {
    const { top, bottom } = useSafeAreaInsets();
    const router = useRouter();
    const [index, setIndex] = useState(0);
    // "Agregar una zona" на слайде zones разворачивает редактор мест на
    // том же слайде (точка прогресса та же), а не отдельным шагом.
    const [editingPlaces, setEditingPlaces] = useState(false);
    const touchStartX = useRef(0);
    const slide = SLIDES[index];

    const handleSwipe = (endX: number) => {
        const diff = touchStartX.current - endX;
        if (diff > 50 && index < SLIDES.length - 1) setIndex(index + 1);
        if (diff < -50 && index > 0) setIndex(index - 1);
    };

    const finish = async () => {
        await Promise.allSettled([
            Notifications.requestPermissionsAsync(),
            Location.requestForegroundPermissionsAsync(),
        ]);
        await AsyncStorage.setItem(ONBOARDING_KEY, '1');

        // Если приложение открыли ссылкой на метку, а онбординг был не
        // пройден — сосед пришел из WhatsApp за конкретной меткой, и
        // высаживать его на общую карту значит терять ровно тот переход,
        // ради которого шеринг и делался.
        const pending = takePendingLink();
        router.replace(pending ?? '/(tabs)');
    };

    const next = () => {
        if (index < SLIDES.length - 1) {
            setIndex(index + 1);
        } else {
            finish();
        }
    };

    const isLegend = slide.key === 'legend';
    const isPlaces = slide.key === 'zones' && editingPlaces;

    const primary = () => {
        if (slide.key === 'zones' && !editingPlaces) setEditingPlaces(true);
        else next();
    };
    const cta = isPlaces ? 'Siguiente' : slide.cta;
    // "Ahora no" пропускает только этот слайд, "Saltar" — весь онбординг.
    const secondary = isPlaces ? null : slide.secondary;

    return (
        <View style={[styles.container, { paddingTop: top + 16, paddingBottom: bottom + 16 }]}>
            <View style={styles.dots}>
                {SLIDES.map((_, i) => (
                    <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
                ))}
            </View>

            <View
                style={styles.slide}
                onTouchStart={e => { touchStartX.current = e.nativeEvent.pageX; }}
                // На шаге с полями свайп мешал бы выделять текст в поиске.
                onTouchEnd={e => { if (!isPlaces) handleSwipe(e.nativeEvent.pageX); }}
            >
                {isPlaces ? (
                    <PlacesStep
                        title={'¿Dónde querés\nrecibir avisos?'}
                        body="Tu zona y hasta 2 lugares más. Te avisamos aunque estés de viaje. Podés cambiarlo después en Ajustes."
                    />
                ) : slide.key === 'zones' ? (
                    <ZonesIntro title={slide.title} body={slide.body} />
                ) : slide.key === 'share' ? (
                    <ShareIntro title={slide.title} body={slide.body} />
                ) : isLegend ? (
                    <>
                        <Text style={styles.title}>{slide.title}</Text>
                        <Text style={[styles.body, { marginBottom: 24 }]}>{slide.body}</Text>
                        <ScrollView style={styles.legendList} showsVerticalScrollIndicator={false}>
                            {LEGEND_ITEMS.map(item => (
                                <LegendRow key={item.term} {...item} />
                            ))}
                        </ScrollView>
                    </>
                ) : (
                    <>
                        <View style={[styles.iconCircle, { backgroundColor: slide.iconBg }]}>
                            {slide.Icon && <slide.Icon size={50} color={slide.iconColor} strokeWidth={1.7} />}
                        </View>
                        <Text style={styles.title}>{slide.title}</Text>
                        <Text style={styles.body}>{slide.body}</Text>
                    </>
                )}
            </View>

            <View style={styles.footer}>
                <PrimaryButton label={cta} onPress={primary} />
                {secondary ? (
                    <TouchableOpacity onPress={next} style={styles.skip}>
                        <Text style={styles.skipText}>{secondary}</Text>
                    </TouchableOpacity>
                ) : index < SLIDES.length - 1 ? (
                    <TouchableOpacity onPress={finish} style={styles.skip}>
                        <Text style={styles.skipText}>Saltar</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.skipPlaceholder} />
                )}
            </View>
        </View>
    );
}

function IntroHeading({ title, body }: { title: string; body: string }) {
    return (
        <View style={styles.introHeading}>
            <Text style={styles.introTitle}>{title}</Text>
            <Text style={styles.introBody}>{body}</Text>
        </View>
    );
}

function ZoneRow({ Icon, color, name, place, you }: {
    Icon: typeof Zap;
    color: string;
    name: string;
    place: string;
    you?: boolean;
}) {
    return (
        <View style={styles.zoneIntroRow}>
            <View style={[styles.zoneIntroIcon, { backgroundColor: `${color}22` }]}>
                <Icon size={18} color={color} />
            </View>
            <View style={styles.zoneIntroText}>
                <View style={styles.zoneIntroNameRow}>
                    <Text style={styles.zoneIntroName}>{name}</Text>
                    {you && <Text style={styles.youBadge}>VOS</Text>}
                </View>
                <Text style={styles.zoneIntroPlace}>{place}</Text>
            </View>
            <Bell size={18} color={DS.amber} />
        </View>
    );
}

/** Слайд "Cuidá también a los tuyos": пример пуша про чужой дом и список мест. */
function ZonesIntro({ title, body }: { title: string; body: string }) {
    return (
        <ScrollView style={styles.introWrap} showsVerticalScrollIndicator={false}>
            <IntroHeading title={title} body={body} />

            <View style={styles.samplePush}>
                <View style={styles.samplePushIcon}>
                    <Zap size={16} color={DS.ink} />
                </View>
                <View style={styles.samplePushText}>
                    <View style={styles.samplePushTop}>
                        <Text style={styles.samplePushTitle} numberOfLines={1}>Casa de mamá · Encarnación</Text>
                        <Text style={styles.samplePushTime}>ahora</Text>
                    </View>
                    <Text style={styles.samplePushBody}>Corte programado mañana de 08:00 a 12:00.</Text>
                </View>
            </View>

            <View style={styles.zoneIntroList}>
                <ZoneRow Icon={MapPin} color={DS.amber} name="Mi zona" place="Villa Morra, Asunción" you />
                <View style={styles.zoneIntroDivider} />
                <ZoneRow Icon={Home} color={DS.blue} name="Casa de mamá" place="Encarnación, Itapúa" />
                <View style={styles.zoneIntroDivider} />
                <ZoneRow Icon={Building2} color={DS.violetLight} name="Oficina" place="San Lorenzo, Central" />
            </View>
        </ScrollView>
    );
}

/** Слайд "Avisá a tu familia por WhatsApp": пример переписки с бабушкой. */
function ShareIntro({ title, body }: { title: string; body: string }) {
    return (
        <ScrollView style={styles.introWrap} showsVerticalScrollIndicator={false}>
            <IntroHeading title={title} body={body} />

            <View style={styles.chat}>
                <View style={styles.chatHeader}>
                    <View style={styles.chatAvatar}>
                        <Text style={styles.chatAvatarText}>A</Text>
                    </View>
                    <View>
                        <Text style={styles.chatName}>Abuela ❤️</Text>
                        <Text style={styles.chatStatus}>en línea</Text>
                    </View>
                </View>

                <View style={styles.bubbleOut}>
                    <Text style={styles.bubbleText}>
                        Abu, mañana cortan la luz en tu barrio de 9 a 13 hs. Cargá el celu y sacá la carne del freezer 🙏
                    </Text>
                    <View style={styles.bubbleCard}>
                        <Text style={styles.bubbleCardTitle}>Corte programado · ANDE</Text>
                        <Text style={styles.bubbleCardBody}>Barrio Obrero, Asunción · 09:00 – 13:00</Text>
                        <Text style={styles.bubbleCardLink}>luzalerts.lat/o/1284</Text>
                    </View>
                    <Text style={styles.bubbleMeta}>18:42 ✓✓</Text>
                </View>

                <View style={styles.bubbleIn}>
                    <Text style={styles.bubbleText}>Gracias mi amor, ya pongo a cargar la radio 😘</Text>
                    <Text style={styles.bubbleMeta}>18:44</Text>
                </View>
            </View>

            {/* Иллюстрация, а не действие: делиться пока нечем. Кнопка
                показывает, где искать ее на карте и в детали корта. */}
            <View pointerEvents="none" style={styles.shareSample}>
                <WhatsAppButton />
            </View>
        </ScrollView>
    );
}

/**
 * Шаг "¿Dónde querés recibir avisos?": своя зона + до двух мест.
 * Необязательный — "Siguiente" работает и без выбора: тогда зона берется
 * из GPS при запуске, как раньше.
 */
function PlacesStep({ title, body }: { title: string; body: string }) {
    const [zoneLabel, setZoneLabel] = useState<string | null>(null);
    const [editingZone, setEditingZone] = useState(true);

    useEffect(() => {
        getHomeZone().then(zone => {
            if (zone?.manual && zone.label) {
                setZoneLabel(zone.label);
                setEditingZone(false);
            }
        });
    }, []);

    return (
        <KeyboardAvoidingView style={styles.placesWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={styles.placesScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <Text style={styles.title}>{title}</Text>
                <Text style={[styles.body, { marginBottom: 20, alignSelf: 'center' }]}>{body}</Text>

                <Text style={styles.placesLabel}>MI ZONA</Text>
                <View style={styles.placesCard}>
                    {editingZone ? (
                        <View style={{ padding: 12 }}>
                            <HomeZoneEditor onSaved={place => { setZoneLabel(place.label); setEditingZone(false); }} />
                        </View>
                    ) : (
                        <TouchableOpacity style={styles.zoneRow} onPress={() => setEditingZone(true)}>
                            <MapPin size={18} color={DS.amber} />
                            <Text style={styles.zoneText} numberOfLines={1}>{zoneLabel}</Text>
                            <Text style={styles.zoneChange}>Cambiar</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <Text style={styles.placesLabel}>OTROS LUGARES (OPCIONAL)</Text>
                <View style={styles.placesCard}>
                    <TrackedPlacesEditor />
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    introWrap: {
        flex: 1,
        width: '100%',
    },
    introHeading: {
        marginTop: 32,
        marginBottom: 24,
        alignItems: 'center',
    },
    introTitle: {
        color: DS.text,
        fontSize: 28,
        lineHeight: 34,
        fontWeight: '700',
        textAlign: 'center',
        letterSpacing: -0.6,
        marginBottom: 10,
    },
    introBody: {
        color: DS.textMid,
        fontSize: 15,
        lineHeight: 22,
        textAlign: 'center',
        maxWidth: 310,
    },
    samplePush: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        backgroundColor: DS.surfaceVar,
        borderRadius: 14,
        paddingVertical: 10,
        paddingHorizontal: 12,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
    },
    samplePushIcon: {
        width: 28,
        height: 28,
        borderRadius: 7,
        backgroundColor: DS.amber,
        alignItems: 'center',
        justifyContent: 'center',
    },
    samplePushText: {
        flex: 1,
        minWidth: 0,
    },
    samplePushTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 8,
    },
    samplePushTitle: {
        flexShrink: 1,
        color: DS.text,
        fontSize: 13,
        fontWeight: '700',
    },
    samplePushTime: {
        color: DS.textMuted,
        fontSize: 11,
    },
    samplePushBody: {
        color: DS.textMid,
        fontSize: 13,
        lineHeight: 18,
    },
    zoneIntroList: {
        backgroundColor: DS.surface,
        borderWidth: 1,
        borderColor: DS.border,
        borderRadius: 14,
    },
    zoneIntroRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    zoneIntroIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    zoneIntroText: {
        flex: 1,
        minWidth: 0,
    },
    zoneIntroNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    zoneIntroName: {
        color: DS.text,
        fontSize: 15,
        fontWeight: '600',
    },
    youBadge: {
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
    zoneIntroPlace: {
        color: DS.textMuted,
        fontSize: 13,
    },
    zoneIntroDivider: {
        height: 1,
        backgroundColor: DS.border,
        marginHorizontal: 14,
    },
    // Цвета WhatsApp (темная тема): узнаваемость важнее палитры бренда.
    chat: {
        backgroundColor: '#0B141A',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: DS.border,
        paddingVertical: 16,
        paddingHorizontal: 14,
        gap: 14,
    },
    chatHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    chatAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#7C4A6B',
        alignItems: 'center',
        justifyContent: 'center',
    },
    chatAvatarText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '700',
    },
    chatName: {
        color: DS.text,
        fontSize: 14,
        fontWeight: '600',
    },
    chatStatus: {
        color: '#8696A0',
        fontSize: 11,
    },
    bubbleOut: {
        alignSelf: 'flex-end',
        maxWidth: 280,
        backgroundColor: '#005C4B',
        borderRadius: 10,
        borderTopRightRadius: 2,
        paddingVertical: 8,
        paddingHorizontal: 10,
        gap: 6,
    },
    bubbleIn: {
        alignSelf: 'flex-start',
        maxWidth: 230,
        backgroundColor: '#202C33',
        borderRadius: 10,
        borderTopLeftRadius: 2,
        paddingVertical: 8,
        paddingHorizontal: 10,
        gap: 3,
    },
    bubbleText: {
        color: '#E9EDEF',
        fontSize: 13,
        lineHeight: 18,
    },
    bubbleCard: {
        backgroundColor: 'rgba(0,0,0,0.22)',
        borderRadius: 6,
        borderLeftWidth: 3,
        borderLeftColor: DS.amber,
        paddingVertical: 6,
        paddingHorizontal: 8,
        gap: 1,
    },
    bubbleCardTitle: {
        color: DS.amber,
        fontSize: 12,
        fontWeight: '700',
    },
    bubbleCardBody: {
        color: '#D1D7DB',
        fontSize: 12,
    },
    bubbleCardLink: {
        color: '#53BDEB',
        fontSize: 12,
    },
    bubbleMeta: {
        alignSelf: 'flex-end',
        color: 'rgba(233,237,239,0.6)',
        fontSize: 10,
    },
    shareSample: {
        marginTop: 16,
    },
    placesWrap: {
        flex: 1,
        width: '100%',
    },
    placesScroll: {
        paddingTop: 8,
        paddingBottom: 16,
    },
    placesLabel: {
        color: DS.textMuted,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.8,
        marginBottom: 8,
        marginTop: 4,
    },
    placesCard: {
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: DS.surface,
        borderWidth: 1,
        borderColor: DS.border,
        marginBottom: 16,
    },
    zoneRow: {
        minHeight: 52,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 16,
    },
    zoneText: {
        flex: 1,
        color: DS.text,
        fontSize: 15,
    },
    zoneChange: {
        color: DS.amber,
        fontSize: 13,
        fontWeight: '700',
    },
    container: {
        flex: 1,
        backgroundColor: DS.bg,
        paddingHorizontal: 24,
    },
    dots: {
        flexDirection: 'row',
        alignSelf: 'center',
        gap: 8,
        paddingTop: 4,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: DS.surfaceVar,
    },
    dotActive: {
        width: 20,
        backgroundColor: DS.amber,
    },
    slide: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 24,
    },
    iconCircle: {
        width: 96,
        height: 96,
        borderRadius: 48,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 36,
    },
    title: {
        color: DS.text,
        fontSize: 28,
        lineHeight: 36,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 10,
        letterSpacing: -0.6,
    },
    body: {
        color: DS.textMid,
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center',
        maxWidth: 310,
    },
    legendList: {
        width: '100%',
    },
    legendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        backgroundColor: DS.surface,
        borderWidth: 1,
        borderColor: DS.border,
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
    },
    pinWrap: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    pulseOuter: {
        position: 'absolute',
        width: 42,
        height: 42,
        borderRadius: 21,
        opacity: 0.1,
    },
    pulseInner: {
        position: 'absolute',
        width: 32,
        height: 32,
        borderRadius: 16,
        opacity: 0.18,
    },
    pinBody: {
        width: 28,
        height: 28,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.35)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    legendText: {
        flex: 1,
        minWidth: 0,
    },
    legendHeader: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 8,
        marginBottom: 2,
    },
    legendTerm: {
        color: DS.text,
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: -0.2,
    },
    legendBadge: {
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.4,
    },
    legendBody: {
        color: DS.textMid,
        fontSize: 13,
        lineHeight: 18,
    },
    footer: {
        gap: 12,
    },
    skip: {
        minHeight: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    skipText: {
        color: DS.textMuted,
        fontSize: 14,
    },
    skipPlaceholder: {
        height: 28,
    },
});
