import { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ConfigScreen() {
  const [url, setUrl] = useState('');
  const router = useRouter();

  useEffect(() => {
    const checkConfig = async () => {
      const savedUrl = await AsyncStorage.getItem('backend_url');
      if (savedUrl) {
        const token = await AsyncStorage.getItem('token');
        if (token) {
          router.replace('/(tabs)/dashboard');
        } else {
          router.replace('/login');
        }
      }
    };
    checkConfig();
  }, [router]);

  const saveUrl = async () => {
    if (!url) return;
    await AsyncStorage.setItem('backend_url', url);
    router.replace('/login');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pharmacy POS Setup</Text>
      <Text>Enter Backend API URL (e.g., http://192.168.1.100:5000/api)</Text>
      <TextInput
        style={styles.input}
        value={url}
        onChangeText={setUrl}
        placeholder="Backend URL"
        autoCapitalize="none"
      />
      <Button title="Save & Continue" onPress={saveUrl} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, marginVertical: 10, borderRadius: 5 }
});
