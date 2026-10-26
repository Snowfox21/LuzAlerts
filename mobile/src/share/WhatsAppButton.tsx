import React from 'react';
import { StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { MessageCircle } from 'lucide-react-native';

/**
 * Вторичная кнопка "Compartir por WhatsApp": полупрозрачная зеленая, а не
 * сплошная, как в ShareBlock. Здесь шеринг — не главное действие экрана,
 * и сплошной зеленый спорил бы с янтарными CTA.
 */
export function WhatsAppButton({
    label = 'Compartir por WhatsApp',
    onPress,
    compact,
    style,
}: {
    label?: string;
    onPress?: () => void;
    /** Половина ряда рядом с другой кнопкой (bottom sheet карты). */
    compact?: boolean;
    style?: ViewStyle;
}) {
    return (
        <TouchableOpacity
            activeOpacity={0.8}
            onPress={onPress}
            disabled={!onPress}
            accessibilityRole="button"
            accessibilityLabel={label}
            style={[styles.button, compact ? styles.compact : styles.full, style]}
        >
            <MessageCircle size={18} color={WHATSAPP_GREEN} />
            <Text style={styles.label}>{label}</Text>
        </TouchableOpacity>
    );
}

export const WHATSAPP_GREEN = '#25D366';

const styles = StyleSheet.create({
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: 'rgba(37,211,102,0.45)',
        backgroundColor: 'rgba(37,211,102,0.12)',
    },
    full: {
        alignSelf: 'stretch',
        height: 48,
        borderRadius: 12,
    },
    compact: {
        flex: 1,
        height: 44,
        borderRadius: 8,
    },
    label: {
        color: '#4ADE80',
        fontSize: 14,
        fontWeight: '600',
    },
});
