import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertTriangle, CalendarClock, CheckCircle2, UsersRound } from 'lucide-react-native';
import { OutageSource, OutageStatus } from '../api/types';

export const DS = {
    bg: '#0F172A',
    surface: '#1E293B',
    surfaceVar: '#334155',
    amber: '#FBBF24',
    amberDim: '#F59E0B',
    text: '#F8FAFC',
    textMid: '#CBD5E1',
    textMuted: '#94A3B8',
    border: '#334155',
    red: '#EF4444',
    redLight: '#F87171',
    green: '#22C55E',
    greenLight: '#4ADE80',
    violet: '#A855F7',
    violetLight: '#C084FC',
    blue: '#0A84FF',
    ink: '#0F172A',
};

export function statusMeta(status: OutageStatus, source?: OutageSource) {
    if (source === OutageSource.CROWDSOURCE) {
        return {
            key: 'report',
            label: 'REPORTADO',
            color: DS.violetLight,
            bg: 'rgba(168,85,247,0.15)',
            Icon: UsersRound,
        };
    }

    switch (status) {
        case OutageStatus.PLANNED:
            return {
                key: 'planned',
                label: 'PROGRAMADO',
                color: DS.amber,
                bg: 'rgba(251,191,36,0.15)',
                Icon: CalendarClock,
            };
        case OutageStatus.RESOLVED:
            return {
                key: 'resolved',
                label: 'RESUELTO',
                color: DS.greenLight,
                bg: 'rgba(34,197,94,0.15)',
                Icon: CheckCircle2,
            };
        case OutageStatus.ACTIVE:
        default:
            return {
                key: 'active',
                label: 'ACTIVO',
                color: DS.redLight,
                bg: 'rgba(239,68,68,0.15)',
                Icon: AlertTriangle,
            };
    }
}

export function StatusChip({ status, source }: { status: OutageStatus; source?: OutageSource }) {
    const meta = statusMeta(status, source);
    return (
        <View style={[styles.chip, { backgroundColor: meta.bg }]}>
            <Text style={[styles.chipText, { color: meta.color }]}>{meta.label}</Text>
        </View>
    );
}

export function ScreenHeader({
    title,
    subtitle,
    right,
}: {
    title: string;
    subtitle?: string;
    right?: React.ReactNode;
}) {
    const { top } = useSafeAreaInsets();
    return (
        <View style={[styles.header, { paddingTop: top + 10 }]}>
            <View style={styles.headerText}>
                <Text style={styles.headerTitle}>{title}</Text>
                {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
            </View>
            {right}
        </View>
    );
}

export function IconButton({
    children,
    onPress,
    style,
}: {
    children: React.ReactNode;
    onPress?: () => void;
    style?: ViewStyle;
}) {
    return (
        <TouchableOpacity activeOpacity={0.75} onPress={onPress} style={[styles.iconButton, style]}>
            {children}
        </TouchableOpacity>
    );
}

export function PrimaryButton({
    label,
    onPress,
    disabled,
    children,
    style,
}: {
    label?: string;
    onPress?: () => void;
    disabled?: boolean;
    children?: React.ReactNode;
    style?: ViewStyle;
}) {
    return (
        <TouchableOpacity
            activeOpacity={0.85}
            onPress={onPress}
            disabled={disabled}
            style={[styles.primaryButton, disabled && styles.disabled, style]}
        >
            {children ?? <Text style={styles.primaryButtonText}>{label}</Text>}
        </TouchableOpacity>
    );
}

export function SectionCard({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
    return <View style={[styles.sectionCard, style]}>{children}</View>;
}

export const sharedStyles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: DS.bg,
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: DS.bg,
    },
});

const styles = StyleSheet.create({
    chip: {
        alignSelf: 'flex-start',
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    chipText: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.8,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 14,
        backgroundColor: DS.bg,
    },
    headerText: {
        flex: 1,
    },
    headerTitle: {
        color: DS.text,
        fontSize: 28,
        fontWeight: '800',
        lineHeight: 34,
    },
    headerSubtitle: {
        color: DS.textMuted,
        fontSize: 13,
        lineHeight: 18,
        marginTop: 3,
    },
    iconButton: {
        width: 48,
        height: 48,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 24,
    },
    primaryButton: {
        minHeight: 56,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: DS.amber,
        paddingHorizontal: 18,
    },
    primaryButtonText: {
        color: DS.ink,
        fontSize: 16,
        fontWeight: '800',
    },
    disabled: {
        opacity: 0.55,
    },
    sectionCard: {
        backgroundColor: DS.surface,
        borderRadius: 12,
        padding: 16,
    },
});
