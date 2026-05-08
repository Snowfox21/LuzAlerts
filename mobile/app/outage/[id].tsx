import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import axios from 'axios';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Building2, Clock3, MapPin, Send, Share2, UsersRound } from 'lucide-react-native';
import { Outage, OutageSource } from '../../src/api/types';
import apiClient from '../../src/api/client';
import { ANDE_WHATSAPP_NUMBER, FEATURES } from '../../src/constants/features';
import { getOrCreateDeviceId } from '../../src/utils/device';
import { DS, SectionCard, StatusChip, sharedStyles, statusMeta } from '../../src/components/DesignSystem';
import { formatDateTime24 } from '../../src/utils/date';

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

function formatDate(value?: string) {
    if (!value) return 'No especificado';
    return new Date(value).toLocaleString('es-PY', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
}

async function geocodeZona(outage: Outage): Promise<{ latitude: number; longitude: number } | null> {
    const seen = new Set<string>();
    const queries: string[] = [];

    const add = (q: string) => {
        q = q.trim().replace(/[.,;:]+$/, '');
        if (q.length >= 3 && q.length <= 80 && !seen.has(q.toLowerCase())) {
            seen.add(q.toLowerCase());
            queries.push(q);
        }
    };

    if (outage.description) {
        // Extract each ZONA line
        const zonaLines = [...outage.description.matchAll(/ZONA\s*\d+\s*[:\-]\s*(.+?)(?:\r?\n|HORARIO|ACTIVIDAD|UNIDAD|RECOMENDACI|$)/gis)];
        for (const m of zonaLines) {
            const addr = m[1].trim().replace(/\.$/, '');

            // 1. "Ciudad de Yaguarón" → "Yaguarón"
            const ciudadM = addr.match(/Ciudad\s+de\s+([^-–,.]+)/i);
            if (ciudadM) add(ciudadM[1].trim());

            // 2. "Barrio San Francisco" + optional city after dash
            const barrioM = addr.match(/Barrio\s+([^-–,.]+)(?:[-–,]\s*([^-–,.]+))?/i);
            if (barrioM) {
                if (barrioM[2]) add(`${barrioM[1].trim()}, ${barrioM[2].trim()}`);
                add(barrioM[1].trim());
            }

            // 3. Tail after last dash/period → often city
            const tail = addr.split(/\s*[-–—]\s*/).pop()?.trim() ?? '';
            if (tail && tail !== addr) add(tail);

            // 4. Full address as last resort
            if (addr.length <= 80) add(addr);
        }
    }

    if (outage.barrio && !/^ZONA/i.test(outage.barrio) && outage.barrio !== 'Zona no especificada') {
        add(outage.barrio);
    }

    for (const q of queries) {
        try {
            const res = await axios.get('https://nominatim.openstreetmap.org/search', {
                params: { q: `${q}, Paraguay`, format: 'json', limit: 1 },
                headers: { 'User-Agent': 'LuzAlerts/1.0' },
                timeout: 5000,
            });
            if (res.data?.length > 0) {
                return { latitude: parseFloat(res.data[0].lat), longitude: parseFloat(res.data[0].lon) };
            }
        } catch {}
    }
    return null;
}

function FormattedDescription({ text }: { text: string }) {
    const lines = text.split('\n').filter(l => l.trim());
    return (
        <View style={styles.descriptionBlock}>
            {lines.map((line, i) => {
                const match = line.match(/^([A-ZÁÉÍÓÚÜÑ][A-ZÁÉÍÓÚÜÑ0-9 ]*\s*:)\s*(.*)/s);
                if (match) {
                    return (
                        <Text key={i} style={styles.descriptionLine}>
                            <Text style={styles.descriptionLabel}>{match[1]}</Text>
                            {match[2] ? ` ${match[2]}` : ''}
                        </Text>
                    );
                }
                return <Text key={i} style={styles.descriptionLine}>{line}</Text>;
            })}
        </View>
    );
}


export default function OutageDetailScreen() {
    const { id } = useLocalSearchParams();
    const [outage, setOutage] = useState<Outage | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [commentText, setCommentText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [geocodedLocation, setGeocodedLocation] = useState<{ latitude: number; longitude: number } | null>(null);

    useEffect(() => {
        apiClient.get<Outage>(`/outages/${id}`)
            .then(r => {
                setOutage(r.data);
                if (r.data.latitude == null || r.data.longitude == null) {
                    geocodeZona(r.data).then(loc => { if (loc) setGeocodedLocation(loc); });
                }
            })
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
            const res = await apiClient.post<Comment>(`/outages/${id}/comments`, { device_id: deviceId, text });
            setComments(prev => [...prev, res.data]);
            setCommentText('');
        } catch {
            // Rate limits and transient network errors should not block reading the detail.
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <View style={sharedStyles.center}>
                <Stack.Screen options={{ title: 'Detalle del corte' }} />
                <ActivityIndicator size="large" color={DS.amber} />
            </View>
        );
    }

    if (error || !outage) {
        return (
            <View style={sharedStyles.center}>
                <Stack.Screen options={{ title: 'Detalle del corte' }} />
                <Text style={styles.errorText}>{error || 'Corte no encontrado'}</Text>
            </View>
        );
    }

    const meta = statusMeta(outage.status, outage.source);
    const effectiveLocation = outage.latitude != null && outage.longitude != null
        ? { latitude: outage.latitude, longitude: outage.longitude }
        : geocodedLocation;

    return (
        <KeyboardAvoidingView
            style={sharedStyles.screen}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
        >
            <Stack.Screen
                options={{
                    title: 'Detalle del corte',
                    headerBackTitle: 'Mapa',
                    headerStyle: { backgroundColor: DS.bg },
                    headerTintColor: DS.text,
                    headerShadowVisible: false,
                    headerRight: () => <Share2 size={20} color={DS.textMuted} />,
                }}
            />
            <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
                <View style={styles.hero}>
                    <StatusChip status={outage.status} source={outage.source} />
                    <Text style={styles.title}>{outage.title}</Text>
                    <Text style={styles.subtitle}>{outage.barrio || 'Zona no especificada'}</Text>
                    <View style={[styles.sourceBadge, { backgroundColor: outage.source === OutageSource.CROWDSOURCE ? 'rgba(168,85,247,0.12)' : 'rgba(100,116,139,0.15)' }]}>
                        {outage.source === OutageSource.CROWDSOURCE
                            ? <UsersRound size={13} color={DS.violetLight} />
                            : <Building2 size={13} color={DS.textMuted} />}
                        <Text style={[styles.sourceText, { color: outage.source === OutageSource.CROWDSOURCE ? DS.violetLight : DS.textMuted }]}>
                            {outage.source === OutageSource.CROWDSOURCE ? 'Reportado por vecinos' : 'Fuente: ANDE'}
                        </Text>
                    </View>
                </View>

                <MiniMap location={effectiveLocation} color={meta.color} />

                <View style={styles.cards}>
                    {(outage.scheduled_start || outage.scheduled_end) && (
                        <SectionCard>
                            <InfoTitle icon={<Clock3 size={18} color={DS.amber} />} title="Horario" />
                            <InfoRow label="Inicio" value={formatDateTime24(outage.scheduled_start)} />
                            <InfoRow label="Fin estimado" value={formatDateTime24(outage.scheduled_end)} />
                        </SectionCard>
                    )}

                    <SectionCard>
                        <InfoTitle icon={<MapPin size={18} color={DS.amber} />} title="Zona afectada" />
                        <Text style={styles.cardPrimary}>{outage.barrio || 'Zona no especificada'}</Text>
                        {outage.description ? <FormattedDescription text={outage.description} /> : null}
                    </SectionCard>

                    <SectionCard>
                        <InfoTitle icon={<UsersRound size={18} color={DS.violet} />} title="Reportes vecinales" />
                        <Text style={styles.cardBody}>Los comentarios de vecinos ayudan a confirmar si el corte sigue activo.</Text>
                    </SectionCard>

                    {FEATURES.WHATSAPP_ANDE_BOT && (
                        <TouchableOpacity
                            style={styles.whatsappButton}
                            activeOpacity={0.85}
                            onPress={() => Linking.openURL(`https://wa.me/${ANDE_WHATSAPP_NUMBER.replace('+', '')}`)}
                        >
                            <Text style={styles.whatsappButtonText}>Reportar a ANDE por WhatsApp</Text>
                        </TouchableOpacity>
                    )}

                    <View style={styles.commentsBlock}>
                        <Text style={styles.commentsTitle}>Comentarios {comments.length > 0 ? `(${comments.length})` : ''}</Text>
                        {comments.length === 0 ? (
                            <Text style={styles.emptyText}>Sé el primero en comentar.</Text>
                        ) : (
                            comments.map((comment, index) => (
                                <View key={comment.id} style={styles.commentCard}>
                                    <View style={[styles.avatar, { backgroundColor: avatarColors[index % avatarColors.length] }]}>
                                        <Text style={styles.avatarText}>{String.fromCharCode(65 + (index % 26))}</Text>
                                    </View>
                                    <View style={styles.commentContent}>
                                        <View style={styles.commentTop}>
                                            <Text style={styles.commentName}>Vecino #{comment.id.toString(16).toUpperCase()}</Text>
                                            <Text style={styles.commentTime}>{formatRelative(comment.created_at)}</Text>
                                        </View>
                                        <Text style={styles.commentText}>{comment.text}</Text>
                                    </View>
                                </View>
                            ))
                        )}
                    </View>
                </View>
            </ScrollView>

            <View style={styles.inputRow}>
                <TextInput
                    style={styles.input}
                    placeholder="Compartí lo que está pasando..."
                    placeholderTextColor={DS.textMuted}
                    value={commentText}
                    onChangeText={setCommentText}
                    maxLength={500}
                    returnKeyType="send"
                    onSubmitEditing={submitComment}
                />
                <TouchableOpacity
                    onPress={submitComment}
                    disabled={!commentText.trim() || submitting}
                    style={[styles.sendButton, (!commentText.trim() || submitting) && styles.sendButtonDisabled]}
                >
                    {submitting ? <ActivityIndicator size="small" color={DS.ink} /> : <Send size={18} color={DS.ink} />}
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

function InfoTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
    return (
        <View style={styles.infoTitle}>
            {icon}
            <Text style={styles.infoTitleText}>{title}</Text>
        </View>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{label}</Text>
            <Text style={styles.infoValue}>{value}</Text>
        </View>
    );
}

function MiniMap({ location, color }: { location: { latitude: number; longitude: number } | null; color: string }) {
    const hasLocation = location != null;
    const router = useRouter();
    const region = hasLocation
        ? { latitude: location.latitude, longitude: location.longitude, latitudeDelta: 0.015, longitudeDelta: 0.015 }
        : { latitude: -25.2867, longitude: -57.647, latitudeDelta: 4, longitudeDelta: 4 };

    const openInMaps = () => {
        if (!hasLocation) return;
        router.navigate({
            pathname: '/(tabs)/',
            params: { focusLat: location.latitude.toString(), focusLon: location.longitude.toString() },
        });
    };

    return (
        <TouchableOpacity
            style={styles.miniMap}
            activeOpacity={0.9}
            onPress={openInMaps}
            disabled={!hasLocation}
        >
            <MapView
                style={StyleSheet.absoluteFillObject}
                region={region}
                scrollEnabled={false}
                zoomEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
                pointerEvents="none"
            >
                {hasLocation && (
                    <Marker
                        coordinate={{ latitude: location.latitude, longitude: location.longitude }}
                        pinColor={color}
                    />
                )}
            </MapView>
            <View style={styles.openMapBadge}>
                <Text style={styles.openMapText}>
                    {hasLocation ? 'Abrir en Mapa' : 'Ubicación no disponible'}
                </Text>
            </View>
        </TouchableOpacity>
    );
}

const avatarColors = [DS.violet, DS.green, DS.blue, DS.red];

const styles = StyleSheet.create({
    scroll: {
        flex: 1,
    },
    content: {
        paddingBottom: 20,
    },
    errorText: {
        color: DS.text,
    },
    hero: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 16,
    },
    title: {
        color: DS.text,
        fontSize: 22,
        fontWeight: '800',
        lineHeight: 30,
        marginTop: 8,
    },
    subtitle: {
        color: DS.textMid,
        fontSize: 15,
        lineHeight: 21,
        marginTop: 4,
    },
    sourceBadge: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 5,
        marginTop: 10,
    },
    sourceText: {
        fontSize: 12,
    },
    miniMap: {
        height: 160,
        marginHorizontal: 16,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#0D1626',
    },
    openMapBadge: {
        position: 'absolute',
        right: 8,
        bottom: 8,
        backgroundColor: 'rgba(15,23,42,0.85)',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    openMapText: {
        color: DS.text,
        fontSize: 11,
    },
    descriptionBlock: {
        marginTop: 6,
        gap: 5,
    },
    descriptionLine: {
        color: DS.textMid,
        fontSize: 14,
        lineHeight: 20,
    },
    descriptionLabel: {
        color: DS.text,
        fontWeight: '700',
    },
    cards: {
        padding: 16,
        gap: 10,
    },
    infoTitle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
    },
    infoTitleText: {
        color: DS.textMuted,
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 4,
        gap: 12,
    },
    infoLabel: {
        color: DS.textMuted,
        fontSize: 14,
    },
    infoValue: {
        color: DS.text,
        fontSize: 14,
        fontWeight: '600',
        flexShrink: 1,
        textAlign: 'right',
    },
    cardPrimary: {
        color: DS.text,
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 4,
    },
    cardBody: {
        color: DS.textMid,
        fontSize: 14,
        lineHeight: 20,
    },
    whatsappButton: {
        minHeight: 50,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#25D366',
    },
    whatsappButtonText: {
        color: '#062E14',
        fontSize: 15,
        fontWeight: '800',
    },
    commentsBlock: {
        borderTopWidth: 1,
        borderTopColor: DS.border,
        paddingTop: 12,
        gap: 8,
    },
    commentsTitle: {
        color: DS.text,
        fontSize: 17,
        fontWeight: '800',
        marginBottom: 4,
    },
    emptyText: {
        color: DS.textMuted,
        fontSize: 14,
    },
    commentCard: {
        flexDirection: 'row',
        gap: 10,
        backgroundColor: DS.surface,
        borderRadius: 12,
        padding: 12,
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '800',
    },
    commentContent: {
        flex: 1,
    },
    commentTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        marginBottom: 5,
    },
    commentName: {
        color: DS.textMid,
        fontSize: 13,
        fontWeight: '700',
        flexShrink: 1,
    },
    commentTime: {
        color: DS.textMuted,
        fontSize: 12,
    },
    commentText: {
        color: DS.text,
        fontSize: 13,
        lineHeight: 19,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: DS.border,
        backgroundColor: DS.bg,
    },
    input: {
        flex: 1,
        minHeight: 48,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: DS.border,
        color: DS.text,
        backgroundColor: DS.surface,
        paddingHorizontal: 14,
        fontSize: 14,
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: DS.amber,
    },
    sendButtonDisabled: {
        opacity: 0.45,
    },
});
