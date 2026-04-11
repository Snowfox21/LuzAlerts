import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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
    }),
});

export default function RootLayout() {
    const colorScheme = useColorScheme() ?? 'dark';
    const router = useRouter();
    const [ready, setReady] = useState(false);

    useDeviceSetup();

    useEffect(() => {
        AsyncStorage.getItem(ONBOARDING_KEY).then(done => {
            if (!done) router.replace('/onboarding');
            setReady(true);
        });
    }, []);

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
                }}>
                <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            </Stack>
        </GestureHandlerRootView>
    );
}
