import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, TouchableOpacity, ActivityIndicator, Button } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export default function PinLoginScreen() {
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handlePinLogin = async () => {
    if (pin.length !== 4) {
      Alert.alert('Error', 'PIN must be 4 digits');
      return;
    }
    setIsLoading(true);
    try {
      const savedPin = await SecureStore.getItemAsync('saved_pin');
      if (pin !== savedPin) {
        Alert.alert('Error', 'Incorrect PIN');
        setIsLoading(false);
        return;
      }

      const email = await SecureStore.getItemAsync('saved_email');
      const password = await SecureStore.getItemAsync('saved_password');
      const baseUrl = await AsyncStorage.getItem('backend_url');

      if (!email || !password || !baseUrl) {
        Alert.alert('Error', 'Missing saved credentials. Please login again.');
        router.replace('/login');
        return;
      }

      const res = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (res.ok) {
        await AsyncStorage.setItem('token', data.token);
        await AsyncStorage.setItem('user', JSON.stringify(data.user));
        router.replace('/(tabs)/dashboard');
      } else {
        Alert.alert('Login Failed', data.error || 'Saved credentials invalid');
        router.replace('/login');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchUser = async () => {
    await SecureStore.deleteItemAsync('saved_pin');
    await SecureStore.deleteItemAsync('saved_email');
    await SecureStore.deleteItemAsync('saved_password');
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    router.replace('/login');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enter PIN</Text>
      <TextInput
        style={styles.input}
        placeholder="****"
        placeholderTextColor="#666"
        value={pin}
        onChangeText={setPin}
        keyboardType="numeric"
        maxLength={4}
        secureTextEntry
        autoFocus
      />
      
      <TouchableOpacity 
        style={[styles.loginBtn, isLoading && styles.loginBtnDisabled]} 
        onPress={handlePinLogin} 
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.loginBtnText}>Unlock</Text>
        )}
      </TouchableOpacity>

      <View style={{ marginTop: 20 }}>
        <Button title="Login with Email" onPress={handleSwitchUser} color="#888" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, marginVertical: 10, borderRadius: 5, textAlign: 'center', fontSize: 24, letterSpacing: 10, color: '#000' },
  loginBtn: { backgroundColor: '#2563eb', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});
