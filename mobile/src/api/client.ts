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
    return 'https://luzalerts.lat';
};

const apiClient = axios.create({
    baseURL: getBaseUrl(),
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
});

apiClient.interceptors.response.use(
    response => response,
    error => {
        if (error.response) {
            const status = error.response.status;
            // 404 is expected (device not yet registered, empty results, etc.)
            if (status !== 404) {
                console.error(`API Error - Status ${status}:`, JSON.stringify(error.response.data, null, 2));
            }
        } else if (error.request) {
            console.warn('API: No response received (backend unreachable?)');
        } else {
            console.error('API Error:', error.message);
        }
        return Promise.reject(error);
    }
);

export default apiClient;
