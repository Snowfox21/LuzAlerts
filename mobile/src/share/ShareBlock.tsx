import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Facebook, MessageCircle, Share2 } from 'lucide-react-native';

import { DS } from '../components/DesignSystem';
import { SHARE_SUBTITLE, SHARE_TITLE } from './messages';
import {
    ShareTarget,
    shareToFacebook,
    shareToSystemSheet,
    shareWithFallback,
} from './shareReport';

/**
 * Блок "позови соседей".
 *
 * Стоит на экране успеха после репорта и на детали метки. Момент сразу
 * после репорта — единственный, когда человеку соседи нужны прямо сейчас,
 * поэтому здесь это основное действие, а не сноска внизу экрана.
 */
export function ShareBlock({ target, compact }: { target: ShareTarget; compact?: boolean }) {
    // Без публичной ссылки шерить нечего: метка создана старым бэкендом.
    if (!target.url) return null;

    return (
        <View style={[styles.wrap, compact && styles.wrapCompact]}>
            {!compact ? (
                <>
                    <Text style={styles.title}>{SHARE_TITLE}</Text>
                    <Text style={styles.subtitle}>{SHARE_SUBTITLE}</Text>
                </>
            ) : null}

            <TouchableOpacity
                activeOpacity={0.85}
                style={styles.whatsapp}
                onPress={() => shareWithFallback(target)}
            >
                <MessageCircle size={20} color="#052e16" />
                <Text style={styles.whatsappText}>Avisar por WhatsApp</Text>
            </TouchableOpacity>

            <View style={styles.row}>
                <TouchableOpacity
                    activeOpacity={0.8}
                    style={styles.secondary}
                    onPress={() => shareToSystemSheet(target)}
                >
                    <Share2 size={17} color={DS.text} />
                    <Text style={styles.secondaryText}>Otros contactos</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    activeOpacity={0.8}
                    style={styles.secondary}
                    onPress={() => shareToFacebook(target)}
                >
                    <Facebook size={17} color={DS.text} />
                    <Text style={styles.secondaryText}>Facebook</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

// WhatsApp-зелёный намеренно: кнопку узнают по цвету раньше, чем читают.
const WHATSAPP_GREEN = '#25D366';

const styles = StyleSheet.create({
    wrap: {
        alignSelf: 'stretch',
        gap: 10,
    },
    wrapCompact: {
        gap: 8,
    },
    title: {
        color: DS.text,
        fontSize: 18,
        fontWeight: '800',
        textAlign: 'center',
    },
    subtitle: {
        color: DS.textMuted,
        fontSize: 13,
        lineHeight: 19,
        textAlign: 'center',
        marginBottom: 6,
    },
    whatsapp: {
        minHeight: 56,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: WHATSAPP_GREEN,
    },
    whatsappText: {
        color: '#052e16',
        fontSize: 16,
        fontWeight: '800',
    },
    row: {
        flexDirection: 'row',
        gap: 10,
    },
    secondary: {
        flex: 1,
        minHeight: 48,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: DS.border,
        backgroundColor: DS.surface,
    },
    secondaryText: {
        color: DS.text,
        fontSize: 14,
        fontWeight: '700',
    },
});
