import React, { useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BellRing, MapPin, Zap } from 'lucide-react-native';
import { DS, PrimaryButton } from '../src/components/DesignSystem';

export const ONBOARDING_KEY = '@luzalerts_onboarding_done';

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
        key: 'notifications',
        Icon: BellRing,
        iconColor: DS.blue,
        iconBg: 'rgba(10,132,255,0.14)',
        title: 'Avisamos cuando\nhay un corte',
        body: 'Activá las notificaciones y la ubicación para recibir alertas cuando haya un corte a menos de 5 km.',
        cta: 'Activar y empezar',
    },
];

export default function OnboardingScreen() {
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
        router.replace('/(tabs)/');
    };

    const next = () => {
        if (index < SLIDES.length - 1) {
            setIndex(index + 1);
        } else {
            finish();
        }
    };

    return (
        <View
            style={styles.container}
            onTouchStart={e => { touchStartX.current = e.nativeEvent.pageX; }}
            onTouchEnd={e => handleSwipe(e.nativeEvent.pageX)}
        >
            <View style={styles.dots}>
                {SLIDES.map((_, i) => (
                    <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
                ))}
            </View>

            <View style={styles.slide}>
                <View style={[styles.iconCircle, { backgroundColor: slide.iconBg }]}>
                    <slide.Icon size={50} color={slide.iconColor} strokeWidth={1.7} />
                </View>
                <Text style={styles.title}>{slide.title}</Text>
                <Text style={styles.body}>{slide.body}</Text>
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: DS.bg,
        paddingTop: Platform.OS === 'ios' ? 60 : 42,
        paddingHorizontal: 28,
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
        paddingBottom: 84,
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
        fontSize: 32,
        lineHeight: 40,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: 16,
    },
    body: {
        color: DS.textMid,
        fontSize: 16,
        lineHeight: 24,
        textAlign: 'center',
        maxWidth: 310,
    },
    footer: {
        paddingBottom: Platform.OS === 'ios' ? 46 : 28,
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
