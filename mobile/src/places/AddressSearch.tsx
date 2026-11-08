import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { DS } from '../components/DesignSystem';
import { FoundAddress, PlaceSuggestion, searchAddress, suggestPlaces } from './places';

/** Pausa al escribir antes de pedir sugerencias, para no consultar por cada letra. */
const SUGGEST_DELAY_MS = 350;
const MIN_QUERY = 3;

/**
 * Campo "barrio, ciudad" con sugerencias mientras se escribe + botón Buscar.
 * Tocar una sugerencia elige ese lugar directamente; Buscar queda para lo
 * que no aparece en la lista (una dirección exacta, por ejemplo).
 */
export function AddressSearch({
    onFound,
    placeholder = 'Ej: Villa Morra, Asunción',
    buttonLabel = 'Buscar',
}: {
    onFound: (place: FoundAddress) => Promise<void> | void;
    placeholder?: string;
    buttonLabel?: string;
}) {
    const [query, setQuery] = useState('');
    const [busy, setBusy] = useState(false);
    const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
    const [suggesting, setSuggesting] = useState(false);
    const disabled = busy || query.trim().length < MIN_QUERY;

    useEffect(() => {
        const q = query.trim();
        if (q.length < MIN_QUERY) {
            setSuggestions([]);
            setSuggesting(false);
            return;
        }
        const controller = new AbortController();
        setSuggesting(true);
        const timer = setTimeout(async () => {
            try {
                const found = await suggestPlaces(q, controller.signal);
                if (!controller.signal.aborted) setSuggestions(found);
            } catch {
                // Sin sugerencias no pasa nada: queda el botón Buscar.
                if (!controller.signal.aborted) setSuggestions([]);
            } finally {
                if (!controller.signal.aborted) setSuggesting(false);
            }
        }, SUGGEST_DELAY_MS);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [query]);

    const choose = async (place: FoundAddress) => {
        if (busy) return;
        setBusy(true);
        setSuggestions([]);
        try {
            await onFound(place);
            setQuery('');
        } catch {
            Alert.alert('Sin conexión', 'No pudimos guardar el lugar. Probá de nuevo.');
        } finally {
            setBusy(false);
        }
    };

    const submit = async () => {
        const q = query.trim();
        if (q.length < MIN_QUERY || busy) return;
        setBusy(true);
        setSuggestions([]);
        try {
            const place = await searchAddress(q);
            if (!place) {
                Alert.alert('No encontrada', 'No encontramos esa dirección en Paraguay. Probá con barrio y ciudad, por ejemplo "Villa Morra, Asunción".');
                return;
            }
            await onFound(place);
            setQuery('');
        } catch {
            Alert.alert('Sin conexión', 'No pudimos buscar la dirección. Probá de nuevo.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <View style={styles.wrap}>
            <View style={styles.row}>
                <TextInput
                    style={styles.input}
                    value={query}
                    onChangeText={setQuery}
                    placeholder={placeholder}
                    placeholderTextColor={DS.textMuted}
                    returnKeyType="search"
                    onSubmitEditing={submit}
                    autoCorrect={false}
                    autoComplete="off"
                />
                <TouchableOpacity style={[styles.button, disabled && { opacity: 0.6 }]} onPress={submit} disabled={disabled}>
                    {busy ? <ActivityIndicator color={DS.ink} size="small" /> : <Text style={styles.buttonText}>{buttonLabel}</Text>}
                </TouchableOpacity>
            </View>
            {suggestions.length > 0 ? (
                <View style={styles.list} accessibilityRole="list">
                    {suggestions.map((s, i) => (
                        <TouchableOpacity
                            key={`${s.label}|${s.latitude}|${s.longitude}`}
                            style={[styles.item, i > 0 && styles.itemBorder]}
                            onPress={() => choose(s)}
                            disabled={busy}
                            accessibilityRole="button"
                        >
                            <MapPin size={14} color={DS.textMuted} />
                            <View style={styles.itemText}>
                                <Text style={styles.itemLabel} numberOfLines={1}>{s.label}</Text>
                                {s.detail ? <Text style={styles.itemDetail} numberOfLines={1}>{s.detail}</Text> : null}
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            ) : suggesting ? (
                <Text style={styles.status}>Buscando lugares…</Text>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        gap: 6,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    input: {
        flex: 1,
        minHeight: 42,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: DS.border,
        color: DS.text,
        backgroundColor: DS.bg,
        paddingHorizontal: 10,
        fontSize: 14,
    },
    button: {
        minWidth: 72,
        minHeight: 38,
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: DS.amber,
    },
    buttonText: {
        color: DS.ink,
        fontSize: 13,
        fontWeight: '800',
    },
    list: {
        borderRadius: 8,
        borderWidth: 1,
        borderColor: DS.border,
        backgroundColor: DS.bg,
        overflow: 'hidden',
    },
    item: {
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 10,
        paddingVertical: 7,
    },
    itemBorder: {
        borderTopWidth: 1,
        borderTopColor: DS.border,
    },
    itemText: {
        flex: 1,
    },
    itemLabel: {
        color: DS.text,
        fontSize: 14,
        fontWeight: '600',
    },
    itemDetail: {
        color: DS.textMuted,
        fontSize: 12,
        marginTop: 1,
    },
    status: {
        color: DS.textMuted,
        fontSize: 12,
        paddingHorizontal: 2,
    },
});
