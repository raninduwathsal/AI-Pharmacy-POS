import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io, Socket } from 'socket.io-client';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function DashboardScreen() {
  const [alerts, setAlerts] = useState<string[]>([]);
  const router = useRouter();
  
  useEffect(() => {
    let socket: Socket;
    
    const initSocket = async () => {
      const baseUrl = await AsyncStorage.getItem('backend_url');
      if (baseUrl) {
        const socketUrl = baseUrl.replace('/api', '');
        socket = io(socketUrl);
        
        socket.on('inventory_alert', (data) => {
          setAlerts(prev => [...prev, `Inventory: ${data.message}`]);
          Notifications.scheduleNotificationAsync({
            content: { title: 'Inventory Alert', body: data.message },
            trigger: null,
          });
        });
        
        socket.on('finance_alert', (data) => {
          setAlerts(prev => [...prev, `Finance: ${data.message}`]);
          Notifications.scheduleNotificationAsync({
            content: { title: 'Finance Alert', body: data.message },
            trigger: null,
          });
        });
      }
    };
    initSocket();
    
    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  return (
    <ScrollView style={styles.container}>
      <TouchableOpacity 
        style={styles.cameraButton} 
        onPress={() => router.push('/(tabs)/camera')}
      >
        <Ionicons name="camera" size={48} color="white" />
        <Text style={styles.cameraButtonText}>Scan Prescription</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Dashboard Alerts</Text>
      {alerts.length === 0 && <Text style={styles.none}>No recent alerts</Text>}
      {alerts.map((a, i) => <Text key={i} style={styles.alert}>{a}</Text>)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
  alert: { padding: 15, backgroundColor: '#fee2e2', color: '#991b1b', marginBottom: 10, borderRadius: 5 },
  none: { color: '#666', fontStyle: 'italic' },
  cameraButton: {
    backgroundColor: '#2563eb',
    padding: 30,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5
  },
  cameraButtonText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginLeft: 15
  }
});
