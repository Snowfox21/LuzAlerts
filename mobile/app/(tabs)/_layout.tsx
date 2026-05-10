import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Bell, List, Map, Settings } from 'lucide-react-native';
import { DS } from '../../src/components/DesignSystem';

export default function TabLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: DS.amber,
                tabBarInactiveTintColor: DS.textMuted,
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: '600',
                },
                tabBarStyle: {
                    backgroundColor: DS.surface,
                    borderTopColor: DS.border,
                    height: Platform.OS === 'ios' ? 82 : 68,
                    paddingTop: 8,
                    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
                },
                tabBarItemStyle: {
                    borderRadius: 16,
                },
            }}>
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Mapa',
                    tabBarIcon: ({ color }) => <Map size={23} color={color} />,
                }}
            />
            <Tabs.Screen
                name="list"
                options={{
                    title: 'Lista',
                    tabBarIcon: ({ color }) => <List size={23} color={color} />,
                }}
            />
            <Tabs.Screen
                name="reports"
                options={{
                    title: 'Reportes',
                    tabBarIcon: ({ color }) => <Bell size={23} color={color} />,
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: 'Ajustes',
                    tabBarIcon: ({ color }) => <Settings size={23} color={color} />,
                }}
            />
        </Tabs>
    );
}
