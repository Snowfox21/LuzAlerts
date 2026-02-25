import axios from 'axios';
import { Platform } from 'react-native';

// Auto-detect backend host for simulators/emulators
const getBaseUrl = () => {
    if (__DEV__) {
        if (Platform.OS === 'android') {
            return 'http://10.0.2.2:8000'; // Special loopback for Android Emulator
        }
        return 'http://localhost:8000'; // Works for iOS Simulator
    }
    return 'https://api.luzparaguay.com'; // Production URL placeholder
};

const apiClient = axios.create({
    baseURL: getBaseUrl(),
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
});

export default apiClient;
