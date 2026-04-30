import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../src/theme/Theme';
import { useDeviceSetup } from '../src/hooks/useDeviceSetup';
import { ONBOARDING_KEY } from './onboarding';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export default function RootLayout() {
    const colorScheme = useColorScheme() ?? 'dark';
    const router = useRouter();
    const [ready, setReady] = useState(false);
    const responseListener = useRef<Notifications.EventSubscription | null>(null);

    useDeviceSetup(ready);

    useEffect(() => {
        AsyncStorage.getItem(ONBOARDING_KEY).then(done => {
            if (!done) router.replace('/onboarding');
            setReady(true);
        });
    }, []);

    // Navigate to map when user taps a push notification
    useEffect(() => {
        responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
            const data = response.notification.request.content.data;
            if (data?.lat && data?.lon) {
                router.push(`/(tabs)/?focusLat=${data.lat}&focusLon=${data.lon}`);
            } else {
                router.push('/(tabs)/');
            }
        });

        return () => {
            responseListener.current?.remove();
        };
    }, []);

    if (!ready) {
        return null;
    }

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <Stack
                screenOptions={{
                    headerStyle: {
                        backgroundColor: Colors[colorScheme].background,
                    },
                    headerTintColor: Colors[colorScheme].text,
                    headerTitleStyle: {
                        fontWeight: 'bold',
                    },
                    headerShadowVisible: false,
                    headerBackTitle: '',
                }}>
                <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            </Stack>
        </GestureHandlerRootView>
    );
}
