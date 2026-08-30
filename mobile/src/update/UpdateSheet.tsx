import React, { useState } from 'react';
import { ActivityIndicator, Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Download } from 'lucide-react-native';

import { DS, PrimaryButton } from '../components/DesignSystem';
import { UpdateManifest } from './manifest';
import {
    InstallError,
    downloadAndInstall,
    installErrorCopy,
    openUnknownSourcesSettings,
} from './installApk';
import { skipVersion } from './checkForUpdate';

/**
 * Диалог обновления вне Google Play.
 *
 * Сообщать размер обязательно: сборка весит ~100 МБ, а мобильный интернет
 * в Парагвае у многих лимитированный — молча съесть трафик нельзя.
 */
export function UpdateSheet({
    manifest,
    onDismiss,
}: {
    manifest: UpdateManifest | null;
    onDismiss: () => void;
}) {
    const [progress, setProgress] = useState<number | null>(null);

    if (!manifest) return null;

    const downloading = progress !== null;

    const handleInstall = async () => {
        setProgress(0);
        try {
            await downloadAndInstall(manifest, setProgress);
            // Установщик открылся поверх приложения; диалог убираем, чтобы
            // человек не вернулся на него после установки.
            onDismiss();
        } catch (error) {
            const kind = error instanceof InstallError ? error.kind : 'intent';
            const copy = installErrorCopy(kind);
            if (kind === 'permission') {
                Alert.alert(copy.title, copy.message, [
                    { text: 'Ahora no', style: 'cancel' },
                    { text: 'Abrir ajustes', onPress: () => { openUnknownSourcesSettings(); } },
                ]);
            } else {
                Alert.alert(copy.title, copy.message);
            }
        } finally {
            setProgress(null);
        }
    };

    const handleLater = async () => {
        await skipVersion(manifest.versionCode);
        onDismiss();
    };

    const sizeMb = manifest.sizeBytes ? Math.round(manifest.sizeBytes / 1024 / 1024) : null;

    return (
        <Modal
            visible
            transparent
            animationType="fade"
            // Обязательное обновление не закрывается кнопкой "назад".
            onRequestClose={manifest.mandatory ? undefined : onDismiss}
        >
            <View style={styles.backdrop}>
                <View style={styles.sheet}>
                    <View style={styles.icon}>
                        <Download size={28} color={DS.amber} />
                    </View>

                    <Text style={styles.title}>Nueva versión disponible</Text>
                    <Text style={styles.version}>
                        LuzAlerts {manifest.versionName}
                        {sizeMb ? ` · ${sizeMb} MB` : ''}
                    </Text>

                    {manifest.notes_es ? (
                        <Text style={styles.notes}>{manifest.notes_es}</Text>
                    ) : null}

                    {downloading ? (
                        <View style={styles.progressWrap}>
                            <View style={styles.progressTrack}>
                                <View style={[styles.progressFill, { width: `${Math.round((progress ?? 0) * 100)}%` }]} />
                            </View>
                            <Text style={styles.progressText}>
                                Descargando… {Math.round((progress ?? 0) * 100)}%
                            </Text>
                        </View>
                    ) : null}

                    <PrimaryButton onPress={handleInstall} disabled={downloading} style={styles.cta}>
                        {downloading
                            ? <ActivityIndicator color={DS.ink} />
                            : <Text style={styles.ctaText}>Actualizar ahora</Text>}
                    </PrimaryButton>

                    {!manifest.mandatory && !downloading ? (
                        <TouchableOpacity onPress={handleLater} activeOpacity={0.7} style={styles.later}>
                            <Text style={styles.laterText}>Después</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(2,6,23,0.75)',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    sheet: {
        backgroundColor: DS.surface,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: DS.border,
        padding: 24,
        alignItems: 'center',
    },
    icon: {
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(251,191,36,0.15)',
        marginBottom: 16,
    },
    title: {
        color: DS.text,
        fontSize: 20,
        fontWeight: '800',
        textAlign: 'center',
    },
    version: {
        color: DS.textMuted,
        fontSize: 13,
        fontWeight: '700',
        marginTop: 4,
    },
    notes: {
        color: DS.textMid,
        fontSize: 14,
        lineHeight: 21,
        textAlign: 'center',
        marginTop: 14,
    },
    progressWrap: {
        alignSelf: 'stretch',
        marginTop: 20,
    },
    progressTrack: {
        height: 8,
        borderRadius: 999,
        backgroundColor: DS.surfaceVar,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 999,
        backgroundColor: DS.amber,
    },
    progressText: {
        color: DS.textMuted,
        fontSize: 12,
        textAlign: 'center',
        marginTop: 8,
    },
    cta: {
        alignSelf: 'stretch',
        marginTop: 22,
    },
    ctaText: {
        color: DS.ink,
        fontSize: 16,
        fontWeight: '800',
    },
    later: {
        paddingVertical: 14,
        paddingHorizontal: 20,
    },
    laterText: {
        color: DS.textMuted,
        fontSize: 15,
        fontWeight: '700',
    },
});
