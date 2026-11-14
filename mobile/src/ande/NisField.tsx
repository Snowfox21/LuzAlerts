import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { DS } from '../components/DesignSystem';
import { cleanNis, isValidNis, NIS_LENGTH } from './nis';

export function NisField({ value, onChange, onSave, allowEmptySave, autoFocus }: {
    value: string;
    onChange: (value: string) => void;
    onSave?: () => void;
    allowEmptySave?: boolean;
    autoFocus?: boolean;
}) {
    const [focused, setFocused] = useState(false);
    const [touched, setTouched] = useState(false);
    const incomplete = value.length > 0 && value.length < NIS_LENGTH;
    const showError = touched && !focused && incomplete;
    const canSave = isValidNis(value) || (!!allowEmptySave && value.length === 0);

    return (
        <View style={styles.wrap}>
            <View style={styles.row}>
                <TextInput
                    style={[
                        styles.input,
                        focused && styles.inputFocused,
                        showError && styles.inputError,
                    ]}
                    value={value}
                    onChangeText={text => onChange(cleanNis(text))}
                    placeholder="Número de NIS"
                    placeholderTextColor={DS.textMuted}
                    accessibilityLabel="Número de NIS"
                    keyboardType="number-pad"
                    inputMode="numeric"
                    autoFocus={autoFocus}
                    returnKeyType="done"
                    onFocus={() => setFocused(true)}
                    onBlur={() => { setFocused(false); setTouched(true); }}
                    onSubmitEditing={() => { if (onSave && canSave) onSave(); }}
                />
                {onSave ? (
                    <TouchableOpacity
                        style={[styles.save, !canSave && styles.saveDisabled]}
                        activeOpacity={0.85}
                        disabled={!canSave}
                        onPress={onSave}
                        accessibilityRole="button"
                        accessibilityState={{ disabled: !canSave }}
                    >
                        <Text style={styles.saveText}>Guardar</Text>
                    </TouchableOpacity>
                ) : null}
            </View>
            <Text style={[styles.counter, showError && styles.errorText]}>
                {showError
                    ? 'El NIS tiene 7 dígitos. Lo encontrás arriba en tu factura de ANDE.'
                    : `${value.length} de ${NIS_LENGTH} dígitos`}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        gap: 6,
    },
    row: {
        flexDirection: 'row',
        gap: 10,
    },
    input: {
        flex: 1,
        minHeight: 48,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: DS.border,
        paddingHorizontal: 14,
        color: DS.text,
        fontSize: 17,
        letterSpacing: 1,
        backgroundColor: DS.bg,
    },
    inputFocused: {
        borderColor: DS.amber,
    },
    inputError: {
        borderColor: DS.redLight,
    },
    save: {
        minHeight: 48,
        borderRadius: 10,
        paddingHorizontal: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: DS.amber,
    },
    saveDisabled: {
        opacity: 0.55,
    },
    saveText: {
        color: DS.ink,
        fontSize: 15,
        fontWeight: '800',
    },
    counter: {
        color: DS.textMuted,
        fontSize: 12,
        lineHeight: 17,
    },
    errorText: {
        color: DS.redLight,
    },
});
