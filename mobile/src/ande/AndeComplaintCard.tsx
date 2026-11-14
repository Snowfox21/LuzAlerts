import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';
import { Check, Copy, House, Megaphone, MessageCircle, Phone, Share2 } from 'lucide-react-native';

import { DS } from '../components/DesignSystem';
import {
    ANDE_PHONE_DISPLAY,
    ANDE_PHONE_URL,
    ANDE_WHATSAPP_DISPLAY,
    ANDE_WHATSAPP_URL,
    buildClaimMessage,
    ClaimReport,
    ClaimScope,
} from './claimMessage';
import { getNis, setNis } from './nis';
import { NisField } from './NisField';

const COPIED_MS = 2500;

function TwoHouses({ color }: { color: string }) {
    return (
        <View style={styles.twoHouses}>
            <House size={14} color={color} strokeWidth={2.2} />
            <House size={14} color={color} strokeWidth={2.2} style={styles.secondHouse} />
        </View>
    );
}

export function AndeComplaintCard({ report, defaultScope }: {
    report: ClaimReport;
    defaultScope: ClaimScope;
}) {
    const [nis, setNisState] = useState<string | null>(null);
    const [draft, setDraft] = useState('');
    const [scope, setScope] = useState<ClaimScope>(defaultScope);
    const [copied, setCopied] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useFocusEffect(useCallback(() => {
        getNis().then(setNisState);
    }, []));

    useEffect(() => () => {
        if (timer.current) clearTimeout(timer.current);
    }, []);

    const message = buildClaimMessage(report, { scope, nis });

    const copy = async () => {
        await Clipboard.setStringAsync(message);
        setCopied(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), COPIED_MS);
    };

    const openWhatsApp = async () => {
        await copy().catch(() => {});
        Linking.openURL(ANDE_WHATSAPP_URL).catch(() => {});
    };

    const saveNis = async () => {
        await setNis(draft).catch(() => {});
        setNisState(await getNis());
        setDraft('');
    };

    const askNis = scope === 'house' && !nis;

    return (
        <View style={styles.card}>
            <View style={styles.titleRow}>
                <View style={styles.titleIcon}>
                    <Megaphone size={18} color={DS.amber} />
                </View>
                <Text style={styles.title}>Reclamo para ANDE</Text>
            </View>

            <Text style={styles.lead}>
                Escribile a ANDE por WhatsApp al <Text style={styles.strong}>{ANDE_WHATSAPP_DISPLAY}</Text> o llamá al{' '}
                <Text style={styles.strong}>{ANDE_PHONE_DISPLAY}</Text>. Por WhatsApp, cuando te atienda un operador, pegá este mensaje.
            </Text>

            <View style={styles.segment} accessibilityRole="radiogroup">
                {(['block', 'house'] as const).map(option => {
                    const active = scope === option;
                    const color = active ? DS.ink : DS.textMid;
                    return (
                        <TouchableOpacity
                            key={option}
                            activeOpacity={0.85}
                            style={[styles.segmentItem, active && styles.segmentItemActive]}
                            onPress={() => setScope(option)}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: active }}
                        >
                            {option === 'block'
                                ? <TwoHouses color={color} />
                                : <House size={16} color={color} strokeWidth={2.2} />}
                            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                                {option === 'block' ? 'Toda la cuadra' : 'Solo mi casa'}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {askNis ? (
                <View style={styles.nisAsk}>
                    <Text style={styles.nisAskText}>
                        <Text style={styles.strong}>ANDE pide el NIS para los reclamos.</Text> Agregalo y queda guardado en Ajustes.
                    </Text>
                    <NisField value={draft} onChange={setDraft} onSave={saveNis} />
                </View>
            ) : null}

            <View style={styles.preview}>
                <Text style={styles.previewText} selectable>{message}</Text>
            </View>

            <View style={styles.actions}>
                <TouchableOpacity activeOpacity={0.85} style={styles.primary} onPress={openWhatsApp} accessibilityRole="button">
                    <MessageCircle size={20} color={DS.ink} />
                    <Text style={styles.primaryText}>Escribir por WhatsApp</Text>
                </TouchableOpacity>
                <Text style={styles.note}>Al abrir el chat copiamos el mensaje para que lo pegues.</Text>
            </View>

            <TouchableOpacity
                activeOpacity={0.8}
                style={styles.secondary}
                onPress={() => Linking.openURL(ANDE_PHONE_URL).catch(() => {})}
                accessibilityRole="button"
            >
                <Phone size={18} color={DS.text} />
                <Text style={styles.secondaryText}>Llamar al {ANDE_PHONE_DISPLAY}</Text>
            </TouchableOpacity>

            <View style={styles.smallRow}>
                <TouchableOpacity
                    activeOpacity={0.8}
                    style={[styles.small, copied && styles.smallCopied]}
                    onPress={() => copy().catch(() => {})}
                    accessibilityRole="button"
                >
                    {copied ? <Check size={16} color={DS.greenLight} /> : <Copy size={16} color={DS.textMid} />}
                    <Text style={[styles.smallText, copied && styles.smallTextCopied]}>
                        {copied ? 'Copiado' : 'Copiar mensaje'}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    activeOpacity={0.8}
                    style={styles.small}
                    onPress={() => Share.share({ message }).catch(() => {})}
                    accessibilityRole="button"
                >
                    <Share2 size={16} color={DS.textMid} />
                    <Text style={styles.smallText}>Compartir</Text>
                </TouchableOpacity>
            </View>

            <Text style={styles.note}>LuzAlerts no está afiliado a la ANDE.</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        marginTop: 14,
        backgroundColor: DS.surface,
        borderWidth: 1,
        borderColor: DS.border,
        borderRadius: 12,
        padding: 16,
        gap: 12,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    titleIcon: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(251,191,36,0.14)',
    },
    title: {
        color: DS.text,
        fontSize: 17,
        fontWeight: '800',
    },
    lead: {
        color: DS.textMid,
        fontSize: 14,
        lineHeight: 20,
    },
    strong: {
        color: DS.text,
        fontWeight: '800',
    },
    segment: {
        flexDirection: 'row',
        padding: 4,
        gap: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: DS.border,
        backgroundColor: DS.bg,
    },
    segmentItem: {
        flex: 1,
        minHeight: 40,
        borderRadius: 9,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    segmentItemActive: {
        backgroundColor: DS.amber,
    },
    segmentText: {
        color: DS.textMid,
        fontSize: 14,
        fontWeight: '600',
    },
    segmentTextActive: {
        color: DS.ink,
        fontWeight: '800',
    },
    twoHouses: {
        flexDirection: 'row',
    },
    secondHouse: {
        marginLeft: -5,
    },
    nisAsk: {
        gap: 10,
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(251,191,36,0.35)',
        backgroundColor: 'rgba(251,191,36,0.08)',
    },
    nisAskText: {
        color: DS.textMid,
        fontSize: 13,
        lineHeight: 18,
    },
    preview: {
        backgroundColor: DS.bg,
        borderWidth: 1,
        borderColor: DS.border,
        borderRadius: 10,
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    previewText: {
        color: DS.text,
        fontSize: 13,
        lineHeight: 19,
        // @ts-expect-error solo web: corta el enlace del mapa
        wordBreak: 'break-word',
    },
    actions: {
        gap: 6,
    },
    primary: {
        minHeight: 56,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: DS.amber,
    },
    primaryText: {
        color: DS.ink,
        fontSize: 16,
        fontWeight: '800',
    },
    secondary: {
        minHeight: 52,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        borderWidth: 1,
        borderColor: DS.border,
        backgroundColor: DS.surface,
    },
    secondaryText: {
        color: DS.text,
        fontSize: 15,
        fontWeight: '700',
    },
    smallRow: {
        flexDirection: 'row',
        gap: 10,
    },
    small: {
        flex: 1,
        minHeight: 44,
        borderRadius: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: DS.border,
    },
    smallCopied: {
        borderColor: 'rgba(74,222,128,0.5)',
        backgroundColor: 'rgba(34,197,94,0.14)',
    },
    smallText: {
        color: DS.textMid,
        fontSize: 14,
        fontWeight: '700',
    },
    smallTextCopied: {
        color: DS.greenLight,
    },
    note: {
        color: DS.textMuted,
        fontSize: 12,
        lineHeight: 17,
        textAlign: 'center',
    },
});
