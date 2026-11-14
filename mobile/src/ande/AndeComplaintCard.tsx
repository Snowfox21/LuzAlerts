import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import { Check, Copy, Megaphone, Share2 } from 'lucide-react-native';

import { DS, SectionCard } from '../components/DesignSystem';
import { ANDE_PHONE_DISPLAY, ANDE_WHATSAPP_DISPLAY, buildAndeComplaint, ComplaintReport } from './complaint';
import { getNis } from './nis';

export function AndeComplaintCard({ report, defaultWholeBlock }: {
    report: ComplaintReport;
    defaultWholeBlock: boolean;
}) {
    const router = useRouter();
    const [nis, setNisState] = useState<string | null>(null);
    const [wholeBlock, setWholeBlock] = useState(defaultWholeBlock);
    const [copied, setCopied] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useFocusEffect(useCallback(() => {
        getNis().then(setNisState);
    }, []));

    useEffect(() => () => {
        if (timer.current) clearTimeout(timer.current);
    }, []);

    const text = buildAndeComplaint(report, { nis, wholeBlock });

    const copy = async () => {
        await Clipboard.setStringAsync(text);
        setCopied(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 2500);
    };

    return (
        <SectionCard style={styles.card}>
            <View style={styles.titleRow}>
                <Megaphone size={18} color={DS.amber} />
                <Text style={styles.title}>Reclamo para ANDE</Text>
            </View>
            <Text style={styles.hint}>
                Escribile a ANDE por WhatsApp al {ANDE_WHATSAPP_DISPLAY}. Cuando te atienda un operador, pegá este mensaje.
            </Text>

            <View style={styles.toggle}>
                {[true, false].map(value => (
                    <TouchableOpacity
                        key={String(value)}
                        activeOpacity={0.8}
                        style={[styles.toggleItem, wholeBlock === value && styles.toggleItemActive]}
                        onPress={() => setWholeBlock(value)}
                    >
                        <Text style={[styles.toggleText, wholeBlock === value && styles.toggleTextActive]}>
                            {value ? 'Toda la cuadra' : 'Solo mi casa'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <View style={styles.preview}>
                <Text style={styles.previewText} selectable>{text}</Text>
            </View>

            {!nis ? (
                <TouchableOpacity activeOpacity={0.75} onPress={() => router.push('/(tabs)/settings')}>
                    <Text style={styles.link}>Agregá tu NIS en Ajustes: con él te atienden más rápido</Text>
                </TouchableOpacity>
            ) : null}

            <TouchableOpacity activeOpacity={0.85} style={styles.primary} onPress={copy}>
                {copied ? <Check size={18} color={DS.ink} /> : <Copy size={18} color={DS.ink} />}
                <Text style={styles.primaryText}>{copied ? 'Copiado' : 'Copiar mensaje'}</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.8} style={styles.secondary} onPress={() => Share.share({ message: text })}>
                <Share2 size={17} color={DS.text} />
                <Text style={styles.secondaryText}>Compartir</Text>
            </TouchableOpacity>

            <Text style={styles.footnote}>
                También podés llamar al {ANDE_PHONE_DISPLAY}. LuzAlerts no está afiliado a la ANDE.
            </Text>
        </SectionCard>
    );
}

const styles = StyleSheet.create({
    card: {
        gap: 10,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        color: DS.text,
        fontSize: 16,
        fontWeight: '800',
    },
    hint: {
        color: DS.textMid,
        fontSize: 13,
        lineHeight: 19,
    },
    toggle: {
        flexDirection: 'row',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: DS.border,
        overflow: 'hidden',
    },
    toggleItem: {
        flex: 1,
        minHeight: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    toggleItemActive: {
        backgroundColor: DS.surfaceVar,
    },
    toggleText: {
        color: DS.textMuted,
        fontSize: 13,
        fontWeight: '700',
    },
    toggleTextActive: {
        color: DS.text,
    },
    preview: {
        borderRadius: 10,
        padding: 12,
        backgroundColor: DS.bg,
    },
    previewText: {
        color: DS.textMid,
        fontSize: 13,
        lineHeight: 19,
    },
    link: {
        color: DS.amber,
        fontSize: 13,
        fontWeight: '700',
    },
    primary: {
        minHeight: 52,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: DS.amber,
    },
    primaryText: {
        color: DS.ink,
        fontSize: 16,
        fontWeight: '800',
    },
    secondary: {
        minHeight: 46,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: DS.border,
    },
    secondaryText: {
        color: DS.text,
        fontSize: 14,
        fontWeight: '700',
    },
    footnote: {
        color: DS.textMuted,
        fontSize: 12,
        lineHeight: 17,
    },
});
