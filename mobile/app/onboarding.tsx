import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { takePendingLink } from '../src/utils/pendingLink';
import { AlertTriangle, BellRing, MapPin, Users, Zap } from 'lucide-react-native';
import { DS, PrimaryButton } from '../src/components/DesignSystem';
import { HomeZoneEditor } from '../src/places/HomeZoneEditor';
import { TrackedPlacesEditor } from '../src/places/TrackedPlacesEditor';
import { getHomeZone } from '../src/utils/homeZone';

export const ONBOARDING_KEY = '@luzalerts_onboarding_done';

const LEGEND_ITEMS = [
    {
        color: DS.redLight,
        pulse: true,
        crowd: false,
        term: 'Activo',
        body: 'Sin luz en este momento. Tocá el pin para ver detalles.',
    },
    {
        color: DS.amber,
        pulse: false,
        crowd: false,
        term: 'Programado',
        body: 'Corte planificado por la ANDE — con horario anunciado.',
    },
    {
        color: DS.greenLight,
        pulse: false,
        crowd: false,
        term: 'Resuelto',
        body: 'La luz ya volvió. Se mantiene visible por 7 días.',
    },
    {
        color: DS.violetLight,
        pulse: false,
        crowd: true,
        term: 'Vecinal',
        body: 'Reportado por usuarios cerca tuyo. Se confirma con 3 reportes.',
    },
];

function LegendPin({ color, pulse, crowd }: { color: string; pulse: boolean; crowd: boolean }) {
    return (
        <View style={[styles.pinWrap, pulse && { opacity: 1 }]}>
            {pulse && (
                <>
                    <View style={[styles.pulseRing1, { borderColor: color }]} />
                    <View style={[styles.pulseRing2, { borderColor: color }]} />
                </>
            )}
            <View style={[styles.pinBody, { backgroundColor: color }]}>
                <AlertTriangle size={14} color={DS.ink} strokeWidth={3} />
            </View>
            <View style={[styles.pinTail, { borderTopColor: color }]} />
            {crowd && (
                <View style={[styles.crowdBadge, { backgroundColor: color }]}>
                    <View style={styles.crowdInner}>
                        <Users size={8} color={color} />
                    </View>
                </View>
            )}
        </View>
    );
}

function LegendRow({ color, pulse, crowd, term, body }: typeof LEGEND_ITEMS[0]) {
    return (
        <View style={styles.legendRow}>
            <LegendPin color={color} pulse={pulse} crowd={crowd} />
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

const SLIDES = [
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
        key: 'places',
        Icon: null,
        iconColor: '',
        iconBg: '',
        title: '¿Dónde querés\nrecibir avisos?',
        body: 'Tu zona y hasta 2 lugares más — por ejemplo, la casa de tus padres. Te avisamos aunque estés de viaje. Podés cambiarlo después en Ajustes.',
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
    const isPlaces = slide.key === 'places';

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
                    <PlacesStep title={slide.title} body={slide.body} />
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
                <PrimaryButton label={slide.cta} onPress={next} />
                {index < SLIDES.length - 1 ? (
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
        width: 36,
        height: 48,
        alignItems: 'center',
        flexShrink: 0,
    },
    pulseRing1: {
        position: 'absolute',
        width: 42,
        height: 42,
        borderRadius: 21,
        borderWidth: 1.5,
        opacity: 0.18,
        top: -3,
    },
    pulseRing2: {
        position: 'absolute',
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 1.5,
        opacity: 0.3,
        top: 2,
    },
    pinBody: {
        width: 30,
        height: 30,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    pinTail: {
        width: 0,
        height: 0,
        borderLeftWidth: 6,
        borderRightWidth: 6,
        borderTopWidth: 8,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
    },
    crowdBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        width: 16,
        height: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    crowdInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: DS.ink,
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
