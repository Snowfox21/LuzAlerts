import { Tabs } from 'expo-router';
import { Platform, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, List, Map, Settings } from 'lucide-react-native';
import { DS, CHROME_MAX_FONT_SCALE } from '../../src/components/DesignSystem';

// Cada pestaña tiene un cuarto del ancho: con la letra al máximo (x2 en
// Android) "Reportes" no entra, así que la etiqueta crece solo hasta un tope.
function TabLabel({ color, children }: { color: string; children: string }) {
    return (
        <Text
            style={[styles.tabLabel, { color }]}
            numberOfLines={1}
            maxFontSizeMultiplier={CHROME_MAX_FONT_SCALE}
        >
            {children}
        </Text>
    );
}

// Ícono, etiqueta y paddingTop; el margen inferior se suma aparte.
const TAB_BAR_CONTENT_HEIGHT = 58;

export default function TabLayout() {
    // Con alto fijo, react-navigation ya no suma el margen inferior: si la barra de
    // navegación del teléfono está visible (Android 11 con botones), quedaba encima
    // de las pestañas y no se podían tocar. Lo sumamos acá.
    const { bottom } = useSafeAreaInsets();
    const tabBarPaddingBottom = Math.max(bottom, Platform.OS === 'ios' ? 24 : 10);
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                // отсоединяем неактивные табы, чтобы SurfaceView карты не просвечивал поверх других экранов
                freezeOnBlur: true,
                tabBarActiveTintColor: DS.amber,
                tabBarInactiveTintColor: DS.textMuted,
                tabBarLabel: ({ color, children }) => <TabLabel color={color}>{children}</TabLabel>,
                tabBarStyle: {
                    backgroundColor: DS.surface,
                    borderTopColor: DS.border,
                    height: TAB_BAR_CONTENT_HEIGHT + tabBarPaddingBottom,
                    paddingTop: 8,
                    paddingBottom: tabBarPaddingBottom,
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

const styles = StyleSheet.create({
    tabLabel: {
        fontSize: 11,
        fontWeight: '600',
        textAlign: 'center',
    },
});
