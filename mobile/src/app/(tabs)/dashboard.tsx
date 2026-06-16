import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io, Socket } from 'socket.io-client';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type AlertItem = {
  id: string;
  message: string;
  isRead: boolean;
  snoozedUntil: number | null;
};

export default function DashboardScreen() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const router = useRouter();
  
  useEffect(() => {
    let socket: Socket;
    
    // Interval to trigger re-renders so snoozed alerts pop back up
    const interval = setInterval(() => setAlerts(a => [...a]), 10000);

    const initSocket = async () => {
      const baseUrl = await AsyncStorage.getItem('backend_url');
      if (baseUrl) {
        const socketUrl = baseUrl.replace('/api', '');
        socket = io(socketUrl);
        
        socket.on('inventory_alert', (data) => {
          setAlerts(prev => [{
            id: Date.now().toString() + Math.random(),
            message: `Inventory: ${data.message}`,
            isRead: false,
            snoozedUntil: null
          }, ...prev]);
          Notifications.scheduleNotificationAsync({
            content: { title: 'Inventory Alert', body: data.message },
            trigger: null,
          });
        });
        
        socket.on('finance_alert', (data) => {
          setAlerts(prev => [{
            id: Date.now().toString() + Math.random(),
            message: `Finance: ${data.message}`,
            isRead: false,
            snoozedUntil: null
          }, ...prev]);
          Notifications.scheduleNotificationAsync({
            content: { title: 'Finance Alert', body: data.message },
            trigger: null,
          });
        });
      }
    };
    initSocket();
    
    return () => {
      clearInterval(interval);
      if (socket) socket.disconnect();
    };
  }, []);

  const markAsRead = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, isRead: true } : a));
  };

  const snoozeAlert = (id: string) => {
    // Snooze for 5 minutes
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, snoozedUntil: Date.now() + 5 * 60000 } : a));
  };

  const visibleAlerts = alerts.filter(a => !a.snoozedUntil || a.snoozedUntil < Date.now());

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
      {visibleAlerts.length === 0 && <Text style={styles.none}>No recent alerts</Text>}
      {visibleAlerts.map(alert => (
        <View key={alert.id} style={[styles.alertCard, alert.isRead && styles.alertCardRead]}>
          <Text style={[styles.alertText, alert.isRead && styles.alertTextRead]}>{alert.message}</Text>
          {!alert.isRead && (
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => markAsRead(alert.id)}>
                <Ionicons name="checkmark-circle-outline" size={20} color="#166534" />
                <Text style={styles.readBtnText}>Mark Read</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => snoozeAlert(alert.id)}>
                <Ionicons name="time-outline" size={20} color="#854d0e" />
                <Text style={styles.snoozeBtnText}>Snooze 5m</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
  alertCard: { padding: 15, backgroundColor: '#fee2e2', marginBottom: 10, borderRadius: 8, borderWidth: 1, borderColor: '#fca5a5' },
  alertCardRead: { backgroundColor: '#f3f4f6', borderColor: '#d1d5db' },
  alertText: { color: '#991b1b', fontSize: 16, marginBottom: 10 },
  alertTextRead: { color: '#6b7280', textDecorationLine: 'line-through' },
  actionRow: { flexDirection: 'row', gap: 15 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.5)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 5 },
  readBtnText: { marginLeft: 5, color: '#166534', fontWeight: 'bold' },
  snoozeBtnText: { marginLeft: 5, color: '#854d0e', fontWeight: 'bold' },
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
