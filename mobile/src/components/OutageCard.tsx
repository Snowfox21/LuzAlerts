import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, useColorScheme } from 'react-native';
import { Colors, Spacing, Typography } from '../theme/Theme';
import { Outage, OutageStatus, OutageSource } from '../api/types';
import { ChevronRight, Zap, Calendar, UserRound } from 'lucide-react-native';

interface Props {
    outage: Outage;
    onPress?: () => void;
}

export const OutageCard = ({ outage, onPress }: Props) => {
    const colorScheme = useColorScheme() ?? 'dark';

    const getStatusColor = (status: OutageStatus) => {
        switch (status) {
            case OutageStatus.ACTIVE: return '#EF4444'; // Red
            case OutageStatus.PLANNED: return '#F59E0B'; // Amber
            case OutageStatus.RESOLVED: return '#10B981'; // Green
            default: return Colors[colorScheme].icon;
        }
    };

    const Icon = outage.source === OutageSource.CROWDSOURCE ? UserRound : (outage.status === OutageStatus.PLANNED ? Calendar : Zap);

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.7}
            style={[
                styles.card,
                {
                    backgroundColor: Colors[colorScheme].background,
                    borderBottomColor: Colors[colorScheme].border
                }
            ]}
        >
            <View style={styles.iconContainer}>
                <Icon size={20} color={getStatusColor(outage.status)} />
            </View>

            <View style={styles.content}>
                <Text style={[styles.title, { color: Colors[colorScheme].text }]} numberOfLines={1}>
                    {outage.title}
                </Text>
                <Text style={[styles.subtitle, { color: Colors[colorScheme].icon }]} numberOfLines={1}>
                    {outage.barrio || 'Zona no especificada'} • {outage.status === OutageStatus.PLANNED ? 'Planificado' : 'Reporte en vivo'}
                </Text>
            </View>

            {Platform.OS === 'ios' && (
                <ChevronRight size={20} color={Colors[colorScheme].icon} style={styles.chevron} />
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        ...Platform.select({
            ios: {
                borderBottomWidth: StyleSheet.hairlineWidth,
            },
            android: {
                marginHorizontal: Spacing.sm,
                marginVertical: Spacing.xs,
                borderRadius: 8,
                elevation: 2,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.1,
                shadowRadius: 2,
            },
        }),
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
    },
    content: {
        flex: 1,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
    },
    subtitle: {
        fontSize: 14,
        marginTop: 2,
    },
    chevron: {
        marginLeft: Spacing.sm,
    },
});
