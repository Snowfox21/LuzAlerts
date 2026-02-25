import { View, Text, StyleSheet, useColorScheme, SectionList, Platform, Switch, TouchableOpacity } from 'react-native';
import { Colors, Spacing } from '../../src/theme/Theme';
import { ChevronRight } from 'lucide-react-native';

const SETTINGS_DATA = [
    {
        title: 'Cuenta',
        data: [
            { id: 'nis', label: 'Número de NIS', value: '1234567-8' },
            { id: 'reports', label: 'Mis reportes', value: null },
        ]
    },
    {
        title: 'Notificaciones',
        data: [
            { id: 'push', label: 'Alertas en tiempo real', type: 'switch', value: true },
            { id: 'barrio', label: 'Notificar por mi barrio', type: 'switch', value: true },
        ]
    },
    {
        title: 'Aplicación',
        data: [
            { id: 'lang', label: 'Idioma', value: 'Español' },
            { id: 'about', label: 'Acerca de LuzParaguay', value: null },
        ]
    }
];

export default function SettingsScreen() {
    const colorScheme = useColorScheme() ?? 'light';

    return (
        <View style={[styles.container, { backgroundColor: colorScheme === 'dark' ? Colors.dark.background : '#F2F2F7' }]}>
            <SectionList
                sections={SETTINGS_DATA}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={[styles.item, { backgroundColor: Colors[colorScheme].background, borderBottomColor: Colors[colorScheme].border }]}
                        activeOpacity={item.type === 'switch' ? 1 : 0.7}
                    >
                        <Text style={[styles.itemLabel, { color: Colors[colorScheme].text }]}>{item.label}</Text>

                        <View style={styles.rightContent}>
                            {item.value && !item.type && (
                                <Text style={{ color: Colors[colorScheme].icon, marginRight: 8 }}>{item.value}</Text>
                            )}
                            {item.type === 'switch' ? (
                                <Switch
                                    value={item.value as boolean}
                                    trackColor={{ false: '#767577', true: Colors[colorScheme].tint }}
                                    ios_backgroundColor="#3e3e3e"
                                />
                            ) : (
                                <ChevronRight size={20} color={Colors[colorScheme].border} />
                            )}
                        </View>
                    </TouchableOpacity>
                )}
                renderSectionHeader={({ section: { title } }) => (
                    <Text style={[styles.header, { color: Colors[colorScheme].icon }]}>{title.toUpperCase()}</Text>
                )}
                contentContainerStyle={{ paddingBottom: Spacing.xl }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        fontSize: 13,
        fontWeight: '400',
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.sm,
    },
    item: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Spacing.md,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    itemLabel: {
        fontSize: 17,
    },
    rightContent: {
        flexDirection: 'row',
        alignItems: 'center',
    }
});
