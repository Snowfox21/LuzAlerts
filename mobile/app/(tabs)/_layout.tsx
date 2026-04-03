import { Tabs } from 'expo-router';
import { Platform, useColorScheme } from 'react-native';
import { Colors } from '../../src/theme/Theme';
import { Map, List, Bell, Settings } from 'lucide-react-native';

export default function TabLayout() {
    const colorScheme = useColorScheme() ?? 'dark';

    return (
        <Tabs
            screenOptions={{
                tabBarActiveTintColor: Colors[colorScheme].tint,
                tabBarStyle: {
                    backgroundColor: Colors[colorScheme].background,
                    borderTopColor: Colors[colorScheme].border,
                    height: Platform.OS === 'ios' ? 88 : 64,
                    paddingBottom: Platform.OS === 'ios' ? 28 : 8,
                },
                headerShown: true,
                headerTitleStyle: {
                    fontWeight: Platform.OS === 'ios' ? '700' : '500', // HIG vs MD
                }
            }}>
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Mapa',
                    tabBarIcon: ({ color }) => <Map size={24} color={color} />,
                }}
            />
            <Tabs.Screen
                name="list"
                options={{
                    title: 'Lista',
                    tabBarIcon: ({ color }) => <List size={24} color={color} />,
                }}
            />
            <Tabs.Screen
                name="reports"
                options={{
                    title: 'Reportar',
                    tabBarIcon: ({ color }) => <Bell size={24} color={color} />,
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: 'Ajustes',
                    tabBarIcon: ({ color }) => <Settings size={24} color={color} />,
                }}
            />
        </Tabs>
    );
}
