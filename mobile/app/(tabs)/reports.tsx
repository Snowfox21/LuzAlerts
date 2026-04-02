import React, { useState } from 'react';
import { View, Text, StyleSheet, useColorScheme, Platform, Alert, ActivityIndicator, TextInput, KeyboardAvoidingView, ScrollView, Modal } from 'react-native';
import { TouchableOpacity, GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Typography } from '../../src/theme/Theme';
import { AlertTriangle, CheckCircle2, MapPin, X } from 'lucide-react-native';
import apiClient from '../../src/api/client';
import { getOrCreateDeviceId } from '../../src/utils/device';

export default function ReportsScreen() {
    const colorScheme = useColorScheme() ?? 'dark';
    const router = useRouter();
    const [modalVisible, setModalVisible] = React.useState(false);
    const [submitting, setSubmitting] = React.useState(false);
    const [autofilling, setAutofilling] = React.useState(false);
    const [success, setSuccess] = React.useState(false);

    const [coords, setCoords] = React.useState<{ lat: number, lon: number } | null>(null);
    const [address, setAddress] = React.useState({
        department: '',
        city: '',
        barrio: '',
        street: '',
        house: ''
    });
    const [comment, setComment] = React.useState('');

    const handleOpenModal = () => {
        setModalVisible(true);
        setSuccess(false);
        setAddress({ department: '', city: '', barrio: '', street: '', house: '' });
        setComment('');
        setCoords(null);
    };

    const handleAutofill = async () => {
        console.log('Autofill requested');
        setAutofilling(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permiso denegado', 'Necesitamos tu ubicación para usar esta función.');
                setAutofilling(false);
                return;
            }

            let location;
            try {
                location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            } catch (error) {
                console.log('Current position failed, trying last known');
                location = await Location.getLastKnownPositionAsync();
                if (!location) {
                    Alert.alert('Ubicación no disponible', 'Asegúrate de que el GPS esté encendido.');
                    setAutofilling(false);
                    return;
                }
            }

            const { latitude, longitude } = location.coords;
            setCoords({ lat: latitude, lon: longitude });

            // Reverse Geocode
            const geocoded = await Location.reverseGeocodeAsync({ latitude, longitude });
            console.log('Geocoded data:', JSON.stringify(geocoded, null, 2));
            if (geocoded.length > 0) {
                const loc = geocoded[0];
                setAddress({
                    department: loc.region || loc.subregion || '',
                    city: loc.city || loc.subregion || loc.district || '',
                    barrio: loc.district || loc.street || loc.name || '',
                    street: loc.street || loc.name || '',
                    house: loc.streetNumber || ''
                });
            }
        } catch (error) {
            console.warn('Geocoding error:', error);
            Alert.alert('Error', 'No se pudo obtener la dirección exacta, но las coordenadas han sido guardadas.');
        } finally {
            setAutofilling(false);
        }
    };

    const handleSubmit = async () => {
        if (!address.city && !address.street && !coords) {
            Alert.alert('Datos incompletos', 'Por favor, usa "Completar por ubicación" o ingresa ciudad y calle manualmente.');
            return;
        }

        setSubmitting(true);
        try {
            const deviceId = await getOrCreateDeviceId();

            try {
                await apiClient.post('/users/', { device_id: deviceId });
            } catch (authError) {
                // Ignore if user already exists
            }

            const reportData = {
                device_id: deviceId,
                latitude: coords?.lat || null,
                longitude: coords?.lon || null,
                department: address.department.trim() || null,
                city: address.city.trim() || null,
                barrio: address.barrio.trim() || null,
                street: address.street.trim() || null,
                house: address.house.trim() || null,
                comment: comment.trim() || 'Corte reportado desde la app móvil'
            };

            await apiClient.post('/reports/', reportData);

            setSuccess(true);
            setModalVisible(false);
        } catch (error) {
            console.error('Error reporting outage:', error);
            Alert.alert('Error', 'Hubo un problema al enviar el reporte. Verifica tu conexión o los datos ingresados.');
        } finally {
            setSubmitting(false);
        }
    };

    if (success) {
        return (
            <View style={[styles.container, styles.center, { backgroundColor: Colors[colorScheme].background }]}>
                <CheckCircle2 size={80} color={Colors[colorScheme].tint} />
                <Text style={[Typography.title, { marginTop: Spacing.md, color: Colors[colorScheme].text }]}>
                    ¡Reporte enviado!
                </Text>
                <Text style={{ color: Colors[colorScheme].icon, textAlign: 'center', marginTop: Spacing.sm, marginBottom: Spacing.xl }}>
                    Gracias por ayudar a la comunidad.
                </Text>
                <TouchableOpacity
                    style={[styles.button, { backgroundColor: Colors[colorScheme].tint, width: '60%' }]}
                    onPress={() => {
                        setSuccess(false);
                        if (coords) {
                            router.navigate({ pathname: '/(tabs)/', params: { focusLat: String(coords.lat), focusLon: String(coords.lon) } });
                        } else {
                            router.navigate('/(tabs)/');
                        }
                    }}
                >
                    <Text style={styles.buttonText}>Aceptar</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: Colors[colorScheme].background }]}>
            <View style={styles.contentContainer}>
                <View style={styles.iconWrapper}>
                    <AlertTriangle size={64} color={Colors[colorScheme].tint} />
                </View>
                <Text style={[Typography.title, { color: Colors[colorScheme].text, marginTop: Spacing.md, textAlign: 'center' }]}>
                    ¿No tienes luz?
                </Text>
                <Text style={[Typography.body, { color: Colors[colorScheme].icon, textAlign: 'center', marginVertical: Spacing.md }]}>
                    Informa sobre el corte en tu ubicación actual o ingresa una dirección manualmente para que otros usuarios lo sepan.
                </Text>

                <TouchableOpacity
                    style={[styles.button, { backgroundColor: Colors[colorScheme].tint, marginTop: Spacing.xl }]}
                    onPress={handleOpenModal}
                    activeOpacity={0.7}
                >
                    <Text style={styles.buttonText}>Reportar ahora</Text>
                </TouchableOpacity>

                <Text style={styles.footerNote}>
                    Si usas tu ubicación, los reportes cercanos se agruparán automáticamente.
                </Text>
            </View>

            <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
                <SafeAreaView style={{ flex: 1, backgroundColor: Colors[colorScheme].background }}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                        <ScrollView contentContainerStyle={{ padding: Spacing.lg }} keyboardShouldPersistTaps="handled">
                            <View style={styles.modalHeader}>
                                <Text style={[Typography.title, { color: Colors[colorScheme].text }]}>Reportar Corte</Text>
                                <TouchableOpacity onPress={() => setModalVisible(false)}>
                                    <X size={28} color={Colors[colorScheme].text} />
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity
                                style={[styles.autofillButton, { borderColor: Colors[colorScheme].tint }]}
                                onPress={handleAutofill}
                                disabled={autofilling}
                            >
                                {autofilling ? (
                                    <ActivityIndicator size="small" color={Colors[colorScheme].tint} />
                                ) : (
                                    <>
                                        <MapPin size={20} color={Colors[colorScheme].tint} />
                                        <Text style={[styles.autofillText, { color: Colors[colorScheme].tint }]}>Completar por ubicación</Text>
                                    </>
                                )}
                            </TouchableOpacity>

                            <View style={styles.formGroup}>
                                <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Departamento</Text>
                                <TextInput
                                    style={[styles.input, { borderColor: Colors[colorScheme].border, color: Colors[colorScheme].text, backgroundColor: colorScheme === 'dark' ? '#1c1c1e' : '#f9f9f9' }]}
                                    value={address.department}
                                    placeholder="Ej: Central"
                                    placeholderTextColor={Colors[colorScheme].icon}
                                    onChangeText={(t) => setAddress({ ...address, department: t })}
                                />
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Ciudad</Text>
                                <TextInput
                                    style={[styles.input, { borderColor: Colors[colorScheme].border, color: Colors[colorScheme].text, backgroundColor: colorScheme === 'dark' ? '#1c1c1e' : '#f9f9f9' }]}
                                    value={address.city}
                                    placeholder="Ej: Asunción"
                                    placeholderTextColor={Colors[colorScheme].icon}
                                    onChangeText={(t) => setAddress({ ...address, city: t })}
                                />
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Barrio</Text>
                                <TextInput
                                    style={[styles.input, { borderColor: Colors[colorScheme].border, color: Colors[colorScheme].text, backgroundColor: colorScheme === 'dark' ? '#1c1c1e' : '#f9f9f9' }]}
                                    value={address.barrio}
                                    placeholder="Ej: Villa Morra"
                                    placeholderTextColor={Colors[colorScheme].icon}
                                    onChangeText={(t) => setAddress({ ...address, barrio: t })}
                                />
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Calle principal</Text>
                                <TextInput
                                    style={[styles.input, { borderColor: Colors[colorScheme].border, color: Colors[colorScheme].text, backgroundColor: colorScheme === 'dark' ? '#1c1c1e' : '#f9f9f9' }]}
                                    value={address.street}
                                    placeholder="Ej: Mcal. López"
                                    placeholderTextColor={Colors[colorScheme].icon}
                                    onChangeText={(t) => setAddress({ ...address, street: t })}
                                />
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Número de casa / Depto</Text>
                                <TextInput
                                    style={[styles.input, { borderColor: Colors[colorScheme].border, color: Colors[colorScheme].text, backgroundColor: colorScheme === 'dark' ? '#1c1c1e' : '#f9f9f9' }]}
                                    value={address.house}
                                    placeholder="Ej: 1234"
                                    placeholderTextColor={Colors[colorScheme].icon}
                                    onChangeText={(t) => setAddress({ ...address, house: t })}
                                />
                            </View>

                            <View style={styles.formGroup}>
                                <Text style={[styles.label, { color: Colors[colorScheme].text }]}>Comentarios (Opcional)</Text>
                                <TextInput
                                    style={[styles.input, { height: 80, borderColor: Colors[colorScheme].border, color: Colors[colorScheme].text, backgroundColor: colorScheme === 'dark' ? '#1c1c1e' : '#f9f9f9' }]}
                                    value={comment}
                                    placeholder="Colado de transformador, etc."
                                    placeholderTextColor={Colors[colorScheme].icon}
                                    onChangeText={setComment}
                                    multiline
                                    textAlignVertical="top"
                                />
                            </View>

                            <TouchableOpacity
                                style={[styles.button, { backgroundColor: Colors[colorScheme].tint, marginTop: Spacing.md, marginBottom: Spacing.xl * 2 }]}
                                onPress={handleSubmit}
                                disabled={submitting}
                                activeOpacity={0.7}
                            >
                                {submitting ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.buttonText}>Enviar Reporte</Text>
                                )}
                            </TouchableOpacity>

                        </ScrollView>
                    </KeyboardAvoidingView>
                </SafeAreaView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    contentContainer: {
        flex: 1,
        padding: Spacing.lg,
        justifyContent: 'center',
    },
    iconWrapper: {
        alignItems: 'center',
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    autofillButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.md,
        borderWidth: 1,
        borderRadius: 8,
        marginBottom: Spacing.lg,
        backgroundColor: 'transparent',
    },
    autofillText: {
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: Spacing.sm,
    },
    formGroup: {
        width: '100%',
        marginBottom: Spacing.md,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: Spacing.xs,
    },
    input: {
        borderWidth: 1,
        borderRadius: 8,
        padding: Spacing.sm,
        fontSize: 16,
        minHeight: 48,
    },
    button: {
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.xl,
        borderRadius: Platform.OS === 'ios' ? 12 : 8,
        width: '100%',
        height: 56,
        justifyContent: 'center',
        alignItems: 'center',
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 4,
            },
            android: {
                elevation: 4,
            }
        })
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    footerNote: {
        fontSize: 12,
        color: '#999',
        marginTop: Spacing.xl,
        textAlign: 'center',
        paddingHorizontal: Spacing.md,
    }
});
