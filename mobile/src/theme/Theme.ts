import { Platform } from 'react-native';

export const Colors = {
    light: {
        text: '#11181C',
        background: '#fff',
        tint: Platform.OS === 'ios' ? '#007AFF' : '#2196F3', // iOS blue vs MD blue
        icon: '#687076',
        border: '#D1D5DB',
    },
    dark: {
        text: '#ECEDEE',
        background: '#151718',
        tint: Platform.OS === 'ios' ? '#0A84FF' : '#90CAF9',
        icon: '#9BA1A6',
        border: '#374151',
    },
};

export const Spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
};

export const Typography = {
    title: {
        fontSize: Platform.OS === 'ios' ? 28 : 24,
        fontWeight: 'bold' as const,
        lineHeight: Platform.OS === 'ios' ? 34 : 32,
    },
    body: {
        fontSize: 16,
        lineHeight: 24,
    },
};
