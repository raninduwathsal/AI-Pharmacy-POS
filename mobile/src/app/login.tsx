import { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      const baseUrl = await AsyncStorage.getItem('backend_url');
      if (!baseUrl) {
        Alert.alert('Error', 'Backend URL not configured');
        router.replace('/');
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
        setShowPinSetup(true);
      } else {
        Alert.alert('Login Failed', data.error || 'Invalid credentials');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePin = async () => {
    if (pin.length !== 4) {
      Alert.alert('Error', 'PIN must be 4 digits');
      return;
    }
    await SecureStore.setItemAsync('saved_email', email);
    await SecureStore.setItemAsync('saved_password', password);
    await SecureStore.setItemAsync('saved_pin', pin);
    router.replace('/(tabs)/dashboard');
  };

  const handleSkipPin = () => {
    router.replace('/(tabs)/dashboard');
  };

  if (showPinSetup) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Setup Quick Login PIN</Text>
        <Text style={{ textAlign: 'center', marginBottom: 20 }}>Create a 4-digit PIN for faster logins</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter 4-digit PIN"
          placeholderTextColor="#666"
          value={pin}
          onChangeText={setPin}
          keyboardType="numeric"
          maxLength={4}
          secureTextEntry
        />
        <TouchableOpacity style={styles.loginBtn} onPress={handleSavePin}>
          <Text style={styles.loginBtnText}>Save PIN</Text>
        </TouchableOpacity>
        <View style={{ marginTop: 20 }}>
          <Button title="Skip for now" onPress={handleSkipPin} color="#888" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Staff Login</Text>
      <TextInput style={styles.input} placeholderTextColor="#666" placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
      <TextInput style={styles.input} placeholderTextColor="#666" placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
      
      <TouchableOpacity 
        style={[styles.loginBtn, isLoading && styles.loginBtnDisabled]} 
        onPress={handleLogin} 
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.loginBtnText}>Login</Text>
        )}
      </TouchableOpacity>

      <View style={{ marginTop: 20 }}>
        <Button title="Change Backend URL" onPress={() => router.replace('/')} color="#888" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, marginVertical: 10, borderRadius: 5, color: '#000' },
  loginBtn: { backgroundColor: '#2563eb', padding: 15, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});
