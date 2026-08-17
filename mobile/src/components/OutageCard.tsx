import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Clock3, MessageCircle, UsersRound } from 'lucide-react-native';
import { Outage, OutageSource, OutageStatus } from '../api/types';
import { DS, StatusChip } from './DesignSystem';
import { parseApiDate, relativeTime } from '../utils/date';

interface Props {
    outage: Outage;
    onPress?: () => void;
    compact?: boolean;
}

function formatTime(value?: string) {
    if (!value) return 'Sin horario';
    const date = parseApiDate(value);
    if (!date) return value;
    const day = date.toLocaleString('es-PY', { day: '2-digit' });
    const month = date.toLocaleString('es-PY', { month: 'long' });
    const time = date.toLocaleString('es-PY', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${day} ${month}, ${time}`;
}

export const OutageCard = ({ outage, onPress, compact = false }: Props) => {
    const isCrowd = outage.source === OutageSource.CROWDSOURCE;
    const timeLabel = outage.status === OutageStatus.PLANNED
        ? formatTime(outage.scheduled_start)
        : relativeTime(outage.created_at);

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.75}
            style={[styles.card, compact && styles.compactCard]}
        >
            <View style={styles.topRow}>
                <StatusChip status={outage.status} source={outage.source} />
                <Text style={styles.time}>{timeLabel}</Text>
            </View>

            <Text style={styles.title} numberOfLines={2}>
                {outage.title || 'Corte reportado'}
            </Text>
            <Text style={styles.subtitle} numberOfLines={1}>
                {outage.barrio || 'Zona no especificada'}
            </Text>

            <View style={styles.metaRow}>
                {outage.scheduled_start || outage.scheduled_end ? (
                    <View style={styles.inlineMeta}>
                        <Clock3 size={13} color={DS.textMuted} />
                        <Text style={styles.metaText}>
                            {formatTime(outage.scheduled_start)}{outage.scheduled_end ? ` - ${formatTime(outage.scheduled_end)}` : ''}
                        </Text>
                    </View>
                ) : (
                    <View />
                )}
                {isCrowd ? (
                    <View style={styles.reportBadge}>
                        <UsersRound size={12} color={DS.violetLight} />
                        <Text style={styles.reportBadgeText}>Vecinal</Text>
                    </View>
                ) : (
                    <View style={styles.inlineMeta}>
                        <MessageCircle size={13} color={DS.textMuted} />
                        <Text style={styles.metaText}>Comentarios</Text>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: DS.surface,
        borderRadius: 12,
        padding: 16,
        gap: 6,
    },
    compactCard: {
        padding: 14,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
    },
    time: {
        color: DS.textMuted,
        fontSize: 12,
    },
    title: {
        color: DS.text,
        fontSize: 15,
        lineHeight: 21,
        fontWeight: '800',
    },
    subtitle: {
        color: DS.textMid,
        fontSize: 13,
    },
    metaRow: {
        minHeight: 22,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        marginTop: 2,
    },
    inlineMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        flexShrink: 1,
    },
    metaText: {
        color: DS.textMuted,
        fontSize: 12,
    },
    reportBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        borderRadius: 8,
        backgroundColor: 'rgba(168,85,247,0.15)',
        paddingHorizontal: 7,
        paddingVertical: 3,
    },
    reportBadgeText: {
        color: DS.violetLight,
        fontSize: 11,
        fontWeight: '700',
    },
});
