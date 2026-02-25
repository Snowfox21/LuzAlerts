import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { Colors } from '../src/theme/Theme';

export default function RootLayout() {
    const colorScheme = useColorScheme() ?? 'light';

    return (
        <Stack
            screenOptions={{
                headerStyle: {
                    backgroundColor: Colors[colorScheme].background,
                },
                headerTintColor: Colors[colorScheme].text,
                headerTitleStyle: {
                    fontWeight: 'bold',
                },
                headerShadowVisible: false, // Cleaner look on both platforms
            }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
    );
}
