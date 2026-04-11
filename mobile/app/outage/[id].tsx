import React, { useEffect, useRef, useState } from 'react';
import {
    View, Text, StyleSheet, useColorScheme, ActivityIndicator,
    ScrollView, TouchableOpacity, Linking, Platform,
    TextInput, KeyboardAvoidingView, FlatList,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Colors, Spacing, Typography } from '../../src/theme/Theme';
import { Outage, OutageStatus } from '../../src/api/types';
import apiClient from '../../src/api/client';
import { MapPin, Calendar, Info, Clock, CheckCircle2, AlertTriangle, MessageSquare, Send } from 'lucide-react-native';
import { FEATURES, ANDE_WHATSAPP_NUMBER } from '../../src/constants/features';
import { getOrCreateDeviceId } from '../../src/utils/device';

interface Comment {
    id: number;
    text: string;
    created_at: string;
}

function formatRelative(dateStr: string): string {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return 'ahora';
    if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
    return `hace ${Math.floor(diff / 86400)} d`;
}

export default function OutageDetailScreen() {
    const { id } = useLocalSearchParams();
    const colorScheme = useColorScheme() ?? 'dark';
    const [outage, setOutage] = useState<Outage | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [comments, setComments] = useState<Comment[]>([]);
    const [commentText, setCommentText] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const C = Colors[colorScheme];

    useEffect(() => {
        apiClient.get<Outage>(`/outages/${id}`)
            .then(r => setOutage(r.data))
            .catch(() => setError('No se pudo cargar la información del corte.'))
            .finally(() => setLoading(false));

        apiClient.get<Comment[]>(`/outages/${id}/comments`)
            .then(r => setComments(r.data))
            .catch(() => {});
    }, [id]);

    const submitComment = async () => {
        const text = commentText.trim();
        if (!text || submitting) return;
        setSubmitting(true);
        try {
            const deviceId = await getOrCreateDeviceId();
            const res = await apiClient.post<Comment>(`/outages/${id}/comments`, {
                device_id: deviceId,
                text,
            });
            setComments(prev => [...prev, res.data]);
            setCommentText('');
        } catch {
            // rate limited or network error — silently ignore
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.center, { backgroundColor: C.background }]}>
                <Stack.Screen options={{ title: 'Detalles del Corte' }} />
                <ActivityIndicator size="large" color={C.tint} />
            </View>
        );
    }

    if (error || !outage) {
        return (
            <View style={[styles.center, { backgroundColor: C.background }]}>
                <Stack.Screen options={{ title: 'Detalles del Corte' }} />
                <Text style={{ color: C.text }}>{error || 'Corte no encontrado'}</Text>
            </View>
        );
    }

    const formatDate = (d?: string) => d ? new Date(d).toLocaleString('es-PY') : 'No especificado';

    const getStatusText = (s: OutageStatus) => ({
        [OutageStatus.ACTIVE]: 'Activo',
        [OutageStatus.PLANNED]: 'Planificado',
        [OutageStatus.RESOLVED]: 'Resuelto',
    }[s] ?? 'Desconocido');

    const StatusIcon = {
        [OutageStatus.ACTIVE]: <AlertTriangle color="#EF4444" size={24} />,
        [OutageStatus.PLANNED]: <Calendar color="#F59E0B" size={24} />,
        [OutageStatus.RESOLVED]: <CheckCircle2 color="#10B981" size={24} />,
    }[outage.status] ?? <Info color={C.icon} size={24} />;

    return (
        <KeyboardAvoidingView
            style={{ flex: 1, backgroundColor: C.background }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
        >
            <Stack.Screen options={{ title: 'Detalles del Corte' }} />
            <ScrollView style={{ flex: 1 }}>
                {/* Header */}
                <View style={[styles.section, { borderBottomColor: C.border }]}>
                    <View style={styles.statusRow}>
                        {StatusIcon}
                        <Text style={[styles.statusText, { color: C.text }]}>
                            {getStatusText(outage.status)}
                        </Text>
                    </View>
                    <Text style={[Typography.title, { color: C.text, marginTop: Spacing.sm }]}>
                        {outage.title}
                    </Text>
                </View>

                {/* Meta */}
                <View style={[styles.section, { borderBottomColor: C.border }]}>
                    <View style={styles.row}>
                        <MapPin color={C.icon} size={20} />
                        <Text style={[styles.detailText, { color: C.text }]}>
                            {outage.barrio || 'Zona no especificada'}
                        </Text>
                    </View>
                    {outage.scheduled_start && (
                        <View style={styles.row}>
                            <Clock color={C.icon} size={20} />
                            <Text style={[styles.detailText, { color: C.text }]}>
                                Inicio: {formatDate(outage.scheduled_start)}
                            </Text>
                        </View>
                    )}
                    {outage.scheduled_end && (
                        <View style={styles.row}>
                            <Clock color={C.icon} size={20} />
                            <Text style={[styles.detailText, { color: C.text }]}>
                                Fin estimado: {formatDate(outage.scheduled_end)}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Description */}
                {outage.description && (
                    <View style={[styles.section, { borderBottomColor: C.border }]}>
                        <Text style={[styles.sectionTitle, { color: C.text }]}>Descripción</Text>
                        <Text style={[Typography.body, { color: C.text, lineHeight: 22 }]}>
                            {outage.description}
                        </Text>
                    </View>
                )}

                {/* WhatsApp */}
                {FEATURES.WHATSAPP_ANDE_BOT && (
                    <View style={[styles.section, { borderBottomColor: C.border }]}>
                        <TouchableOpacity
                            style={styles.whatsappButton}
                            activeOpacity={0.8}
                            onPress={() => Linking.openURL(`https://wa.me/${ANDE_WHATSAPP_NUMBER.replace('+', '')}`)}
                        >
                            <Text style={styles.whatsappButtonText}>Reportar a ANDE por WhatsApp</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Comments */}
                <View style={[styles.section, { borderBottomColor: C.border }]}>
                    <View style={styles.row}>
                        <MessageSquare color={C.icon} size={18} />
                        <Text style={[styles.sectionTitle, { color: C.text, marginLeft: Spacing.sm }]}>
                            Comentarios {comments.length > 0 ? `(${comments.length})` : ''}
                        </Text>
                    </View>

                    {comments.length === 0 ? (
                        <Text style={[styles.emptyText, { color: C.icon }]}>
                            Sé el primero en comentar.
                        </Text>
                    ) : (
                        comments.map(c => (
                            <View key={c.id} style={[styles.commentItem, { borderTopColor: C.border }]}>
                                <Text style={[styles.commentText, { color: C.text }]}>{c.text}</Text>
                                <Text style={[styles.commentTime, { color: C.icon }]}>{formatRelative(c.created_at)}</Text>
                            </View>
                        ))
                    )}
                </View>

                <View style={{ height: Spacing.xl }} />
            </ScrollView>

            {/* Comment input */}
            <View style={[styles.inputRow, { backgroundColor: C.background, borderTopColor: C.border }]}>
                <TextInput
                    style={[styles.input, { color: C.text, backgroundColor: colorScheme === 'dark' ? '#1c1c1e' : '#f2f2f7', borderColor: C.border }]}
                    placeholder="Ej: Volvió la luz a las 19:45"
                    placeholderTextColor={C.icon}
                    value={commentText}
                    onChangeText={setCommentText}
                    maxLength={500}
                    returnKeyType="send"
                    onSubmitEditing={submitComment}
                />
                <TouchableOpacity
                    onPress={submitComment}
                    disabled={!commentText.trim() || submitting}
                    style={[styles.sendBtn, { backgroundColor: C.tint, opacity: (!commentText.trim() || submitting) ? 0.4 : 1 }]}
                >
                    {submitting
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Send size={18} color="#fff" />
                    }
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    section: {
        padding: Spacing.lg,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    sectionTitle: {
        fontSize: 17,
        fontWeight: '600',
        marginBottom: Spacing.sm,
    },
    statusRow: { flexDirection: 'row', alignItems: 'center' },
    statusText: { fontSize: 16, fontWeight: 'bold', marginLeft: Spacing.sm },
    row: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
    detailText: { fontSize: 16, marginLeft: Spacing.md, flex: 1 },
    emptyText: { fontSize: 14, marginTop: Spacing.xs },
    commentItem: {
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingTop: Spacing.sm,
        marginTop: Spacing.sm,
    },
    commentText: { fontSize: 15, lineHeight: 21 },
    commentTime: { fontSize: 12, marginTop: 4 },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderTopWidth: StyleSheet.hairlineWidth,
        gap: Spacing.sm,
    },
    input: {
        flex: 1,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 20,
        paddingHorizontal: Spacing.md,
        paddingVertical: Platform.OS === 'ios' ? 10 : 8,
        fontSize: 15,
    },
    sendBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    whatsappButton: {
        backgroundColor: '#25D366',
        borderRadius: Platform.OS === 'ios' ? 12 : 8,
        paddingVertical: 14,
        alignItems: 'center',
    },
    whatsappButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
