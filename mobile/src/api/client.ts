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

apiClient.interceptors.response.use(
    response => response,
    error => {
        if (error.response) {
            // Log all error responses with a status code
            console.error(`API Error - Status ${error.response.status}:`, JSON.stringify(error.response.data, null, 2));
        } else if (error.request) {
            // The request was made but no response was received
            console.error('API Error: No response received', error.request);
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error('API Error:', error.message);
        }
        return Promise.reject(error);
    }
);

export default apiClient;
