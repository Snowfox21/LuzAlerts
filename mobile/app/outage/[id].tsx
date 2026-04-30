import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Linking,
    Platform,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Building2, ChevronLeft, Clock3, MapPin, MessageSquare, Send, Share2, UsersRound } from 'lucide-react-native';
import { Outage, OutageSource } from '../../src/api/types';
import apiClient from '../../src/api/client';
import { ANDE_WHATSAPP_NUMBER, FEATURES } from '../../src/constants/features';
import { getOrCreateDeviceId } from '../../src/utils/device';
import { DS, IconButton, SectionCard, StatusChip, sharedStyles, statusMeta } from '../../src/components/DesignSystem';
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

export default function OutageDetailScreen() {
    const { id } = useLocalSearchParams();
    const navigation = useNavigation();
    const router = useRouter();
    const [outage, setOutage] = useState<Outage | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [commentText, setCommentText] = useState('');
    const [submitting, setSubmitting] = useState(false);

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
    const mapLabel = outage.barrio || outage.title;
    const mapRegion = buildRegion(outage.latitude, outage.longitude);

    const handleBack = () => {
        if (navigation.canGoBack()) {
            router.back();
            return;
        }

        router.replace('/(tabs)/');
    };

    const handleShare = async () => {
        const mapsUrl = buildWebMapsUrl(outage.latitude, outage.longitude);
        const parts = [
            outage.title,
            outage.barrio ? `Zona: ${outage.barrio}` : null,
            outage.scheduled_start ? `Inicio: ${formatDateTime24(outage.scheduled_start)}` : null,
            outage.scheduled_end ? `Fin estimado: ${formatDateTime24(outage.scheduled_end)}` : null,
            mapsUrl,
        ].filter(Boolean);

        try {
            await Share.share({
                message: parts.join('\n'),
            });
        } catch {}
    };

    const handleOpenInMaps = async () => {
        if (outage.latitude == null || outage.longitude == null) return;
        await openSystemMaps(outage.latitude, outage.longitude, mapLabel);
    };

    return (
        <KeyboardAvoidingView
            style={sharedStyles.screen}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
        >
            <Stack.Screen
                options={{
                    title: 'Detalle del corte',
                    headerStyle: { backgroundColor: DS.bg },
                    headerTintColor: DS.text,
                    headerShadowVisible: false,
                    headerLeft: () => (
                        <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.75}>
                            <ChevronLeft size={18} color={DS.text} />
                            <Text style={styles.backButtonText}>Mapa</Text>
                        </TouchableOpacity>
                    ),
                    headerBackVisible: false,
                    headerRight: () => (
                        <IconButton style={styles.headerIconButton} onPress={handleShare}>
                            <Share2 size={19} color={DS.textMuted} />
                        </IconButton>
                    ),
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

                <MiniMap
                    color={meta.color}
                    region={mapRegion}
                    onPress={handleOpenInMaps}
                />

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
                        {outage.description ? <AffectedAreaText description={outage.description} /> : null}
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

function MiniMap({
    color,
    region,
    onPress,
}: {
    color: string;
    region: Region | null;
    onPress: () => void;
}) {
    if (!region) {
        return (
            <View style={styles.miniMap}>
                <View style={styles.miniMapFallback}>
                    <Text style={styles.miniMapFallbackText}>Ubicación exacta no disponible</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.miniMap}>
            <MapView
                style={StyleSheet.absoluteFillObject}
                pointerEvents="none"
                initialRegion={region}
                customMapStyle={darkMapStyle}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
                toolbarEnabled={false}
            >
                <Marker coordinate={{ latitude: region.latitude, longitude: region.longitude }}>
                    <View style={[styles.mapMarkerGlow, { backgroundColor: `${color}24` }]}>
                        <View style={[styles.mapMarker, { backgroundColor: color }]} />
                    </View>
                </Marker>
            </MapView>
            <TouchableOpacity style={styles.miniMapPressArea} activeOpacity={0.9} onPress={onPress}>
                <View style={styles.openMapBadge}>
                    <Text style={styles.openMapText}>Abrir en Maps</Text>
                </View>
            </TouchableOpacity>
        </View>
    );
}

function AffectedAreaText({ description }: { description: string }) {
    const blocks = formatAffectedArea(description);

    return (
        <View style={styles.descriptionBlock}>
            {blocks.map((block, index) => (
                <Text key={`${block.heading}-${index}`} style={styles.cardBody}>
                    {block.heading ? <Text style={styles.cardBodyHeading}>{block.heading}: </Text> : null}
                    {block.body}
                </Text>
            ))}
        </View>
    );
}

function formatAffectedArea(description: string): Array<{ heading: string | null; body: string }> {
    return description
        .split(/\n\s*\n/)
        .map(block => block.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .map(block => {
            const match = block.match(/^([^:]{2,40}):\s*(.+)$/);
            if (!match) {
                return { heading: null, body: block };
            }

            return {
                heading: match[1].trim(),
                body: match[2].trim(),
            };
        });
}

function buildRegion(latitude?: number, longitude?: number): Region | null {
    if (latitude == null || longitude == null) {
        return null;
    }

    return {
        latitude,
        longitude,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
    };
}

async function openSystemMaps(latitude: number, longitude: number, label: string) {
    const encodedLabel = encodeURIComponent(label);
    const platformUrl = Platform.select({
        ios: `http://maps.apple.com/?ll=${latitude},${longitude}&q=${encodedLabel}`,
        android: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodedLabel})`,
        default: buildWebMapsUrl(latitude, longitude),
    })!;

    try {
        await Linking.openURL(platformUrl);
    } catch {
        await Linking.openURL(buildWebMapsUrl(latitude, longitude));
    }
}

function buildWebMapsUrl(latitude?: number, longitude?: number): string {
    if (latitude == null || longitude == null) {
        return 'https://www.google.com/maps';
    }

    return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
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
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 6,
        paddingRight: 8,
    },
    backButtonText: {
        color: DS.text,
        fontSize: 15,
        fontWeight: '700',
    },
    headerIconButton: {
        backgroundColor: DS.surface,
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
    miniMapPressArea: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
    },
    miniMapFallback: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0D1626',
        paddingHorizontal: 20,
    },
    miniMapFallbackText: {
        color: DS.textMuted,
        fontSize: 13,
    },
    mapMarkerGlow: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
    },
    mapMarker: {
        width: 18,
        height: 18,
        borderRadius: 9,
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
    descriptionBlock: {
        gap: 10,
    },
    cardBodyHeading: {
        color: DS.text,
        fontWeight: '800',
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

const darkMapStyle = [
    { elementType: 'geometry', stylers: [{ color: '#0D1626' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#0D1626' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#7C8DA3' }] },
    { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#CBD5E1' }] },
    { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#64748B' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#22314D' }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#131E30' }] },
    { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#E2E8F0' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#374B6A' }] },
    { featureType: 'transit', elementType: 'labels.text.fill', stylers: [{ color: '#94A3B8' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0A1520' }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#64748B' }] },
];
