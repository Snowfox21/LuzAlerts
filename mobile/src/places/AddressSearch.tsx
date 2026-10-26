import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { DS } from '../components/DesignSystem';
import { FoundAddress, searchAddress } from './places';

/** Поле "barrio, ciudad" + кнопка Buscar. Отдает найденное место наверх. */
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
    const disabled = busy || query.trim().length < 3;

    const submit = async () => {
        const q = query.trim();
        if (q.length < 3 || busy) return;
        setBusy(true);
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
        <View style={styles.row}>
            <TextInput
                style={styles.input}
                value={query}
                onChangeText={setQuery}
                placeholder={placeholder}
                placeholderTextColor={DS.textMuted}
                returnKeyType="search"
                onSubmitEditing={submit}
            />
            <TouchableOpacity style={[styles.button, disabled && { opacity: 0.6 }]} onPress={submit} disabled={disabled}>
                {busy ? <ActivityIndicator color={DS.ink} size="small" /> : <Text style={styles.buttonText}>{buttonLabel}</Text>}
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
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
        height: 38,
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
});
