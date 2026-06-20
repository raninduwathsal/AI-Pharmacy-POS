import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

export const fetchWithAuth = async (endpoint: string, options: RequestInit = {}) => {
    const baseUrl = await AsyncStorage.getItem('backend_url');
    if (!baseUrl) {
        throw new Error('Backend URL not configured');
    }

    const token = await AsyncStorage.getItem('token');
    const headers = new Headers(options.headers);
    if (!(options.body instanceof FormData)) {
        headers.set('Content-Type', 'application/json');
    }

    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(`${baseUrl}${endpoint}`, {
        ...options,
        headers,
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
            await AsyncStorage.removeItem('token');
            await AsyncStorage.removeItem('user');
            
            const savedPin = await SecureStore.getItemAsync('saved_pin');
            if (savedPin) {
                router.replace('/pin-login');
            } else {
                router.replace('/login');
            }
        }
        throw new Error(data.error || 'API request failed');
    }

    return data;
};
