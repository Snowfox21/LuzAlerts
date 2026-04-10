import React, { useRef, useState } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    Dimensions, Platform, useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Zap, MapPin, BellRing } from 'lucide-react-native';
import { Colors, Spacing } from '../src/theme/Theme';

const { width } = Dimensions.get('window');

export const ONBOARDING_KEY = '@luzpy_onboarding_done';

const SLIDES = [
    {
        key: 'welcome',
        Icon: Zap,
        iconColor: '#F59E0B',
        iconBg: 'rgba(245,158,11,0.12)',
        title: 'Cortes de luz\nen tiempo real',
        body: 'Datos oficiales de la ANDE actualizados cada hora, más reportes de usuarios de toda Paraguay.',
        cta: 'Siguiente',
    },
    {
        key: 'map',
        Icon: MapPin,
        iconColor: '#EF4444',
        iconBg: 'rgba(239,68,68,0.12)',
        title: 'Tu zona,\nsiempre actualizada',
        body: 'El mapa muestra cortes planificados y activos cerca de vos. Si hay un corte y no aparece, podés reportarlo en un toque.',
        cta: 'Siguiente',
    },
    {
        key: 'notifications',
        Icon: BellRing,
        iconColor: '#0A84FF',
        iconBg: 'rgba(10,132,255,0.12)',
        title: 'Avisamos cuando\nhay un corte',
        body: 'Activá las notificaciones y la ubicación para recibir alertas cuando haya un corte a menos de 5 km de donde estás.',
        cta: 'Activar y empezar',
    },
];

export default function OnboardingScreen() {
    const colorScheme = useColorScheme() ?? 'dark';
    const router = useRouter();
    const listRef = useRef<FlatList>(null);
    const [currentIndex, setCurrentIndex] = useState(0);

    const bg = Colors[colorScheme].background;
    const text = Colors[colorScheme].text;
    const icon = Colors[colorScheme].icon;
    const tint = Colors[colorScheme].tint;

    const finish = async () => {
        await Promise.allSettled([
            Notifications.requestPermissionsAsync(),
            Location.requestForegroundPermissionsAsync(),
        ]);
        await AsyncStorage.setItem(ONBOARDING_KEY, '1');
        router.replace('/(tabs)');
    };

    const next = () => {
        if (currentIndex < SLIDES.length - 1) {
            listRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
        } else {
            finish();
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: bg }]}>
            <FlatList
                ref={listRef}
                data={SLIDES}
                keyExtractor={s => s.key}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                scrollEnabled={false}
                onMomentumScrollEnd={e => {
                    setCurrentIndex(Math.round(e.nativeEvent.contentOffset.x / width));
                }}
                renderItem={({ item }) => (
                    <View style={[styles.slide, { width }]}>
                        <View style={[styles.iconCircle, { backgroundColor: item.iconBg }]}>
                            <item.Icon size={52} color={item.iconColor} strokeWidth={1.5} />
                        </View>
                        <Text style={[styles.title, { color: text }]}>{item.title}</Text>
                        <Text style={[styles.body, { color: icon }]}>{item.body}</Text>
                    </View>
                )}
            />

            {/* Dots */}
            <View style={styles.dots}>
                {SLIDES.map((_, i) => (
                    <View
                        key={i}
                        style={[
                            styles.dot,
                            { backgroundColor: i === currentIndex ? tint : Colors[colorScheme].border },
                            i === currentIndex && styles.dotActive,
                        ]}
                    />
                ))}
            </View>

            {/* CTA */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.button, { backgroundColor: tint }]}
                    onPress={next}
                    activeOpacity={0.85}
                >
                    <Text style={styles.buttonText}>{SLIDES[currentIndex].cta}</Text>
                </TouchableOpacity>

                {currentIndex < SLIDES.length - 1 && (
                    <TouchableOpacity onPress={finish} style={styles.skip}>
                        <Text style={[styles.skipText, { color: icon }]}>Omitir</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
    },
    slide: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.xl,
        paddingBottom: 160,
    },
    iconCircle: {
        width: 112,
        height: 112,
        borderRadius: 56,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.xl,
    },
    title: {
        fontSize: 30,
        fontWeight: '700',
        textAlign: 'center',
        lineHeight: 38,
        marginBottom: Spacing.md,
    },
    body: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        maxWidth: 300,
    },
    dots: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        marginBottom: Spacing.lg,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    dotActive: {
        width: 24,
    },
    footer: {
        paddingHorizontal: Spacing.xl,
        paddingBottom: Platform.OS === 'ios' ? 48 : Spacing.xl,
        gap: Spacing.sm,
    },
    button: {
        height: 52,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonText: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '600',
    },
    skip: {
        alignItems: 'center',
        paddingVertical: Spacing.sm,
    },
    skipText: {
        fontSize: 15,
    },
});
