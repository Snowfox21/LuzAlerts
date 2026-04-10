import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import { Colors } from '../src/theme/Theme';
import { useDeviceSetup } from '../src/hooks/useDeviceSetup';

// Show notifications as alerts when the app is in the foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

export default function RootLayout() {
    const colorScheme = useColorScheme() ?? 'dark';

    useDeviceSetup();

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
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            </Stack>
        </GestureHandlerRootView>
    );
}
