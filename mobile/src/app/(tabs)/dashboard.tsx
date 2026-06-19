import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io, Socket } from 'socket.io-client';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Alert } from 'react-native';

type AlertItem = {
  id: string;
  message: string;
  isRead: boolean;
  snoozedUntil: number | null;
};

export default function DashboardScreen() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  
  const fetchInitialAlerts = useCallback(async () => {
    try {
      const baseUrl = await AsyncStorage.getItem('backend_url');
      const token = await AsyncStorage.getItem('token');
      if (!baseUrl || !token) return;

      const headers = { 'Authorization': `Bearer ${token}` };
      let fetchedAlerts: AlertItem[] = [];

      // Fetch Inventory Alerts
      const invRes = await fetch(`${baseUrl}/inventory/alerts`, { headers });
      if (invRes.ok) {
        const invData = await invRes.json();
        const lowStockCount = (invData.lowStock || []).length;
        const nearExpiryCount = (invData.nearExpiry || []).length;
        
        if (lowStockCount > 0) {
          fetchedAlerts.push({
            id: `ls-initial`,
            message: `Inventory: ${lowStockCount} items are low on stock.`,
            isRead: false,
            snoozedUntil: null
          });
        }
        if (nearExpiryCount > 0) {
          fetchedAlerts.push({
            id: `ne-initial`,
            message: `Inventory: ${nearExpiryCount} items are nearing expiry.`,
            isRead: false,
            snoozedUntil: null
          });
        }
      } else {
        const errText = await invRes.text();
        Alert.alert('Inventory Fetch Error', `Status: ${invRes.status}\n${errText}`);
      }

      // Fetch Finance Alerts
      const finRes = await fetch(`${baseUrl}/finance/pending-checks`, { headers });
      if (finRes.ok) {
        const checksData = await finRes.json();
        const now = new Date();
        const in7Days = new Date();
        in7Days.setDate(now.getDate() + 7);
        
        const upcomingOrOverdue = (checksData || []).filter((check: any) => {
            const checkDate = new Date(check.check_date);
            return checkDate <= in7Days;
        });

        if (upcomingOrOverdue.length > 0) {
          fetchedAlerts.push({
            id: `fin-initial`,
            message: `Finance: ${upcomingOrOverdue.length} upcoming or overdue checks.`,
            isRead: false,
            snoozedUntil: null
          });
        }
      } else {
        const errText = await finRes.text();
        Alert.alert('Finance Fetch Error', `Status: ${finRes.status}\n${errText}`);
      }
      
      setAlerts(prev => {
          const dynamicAlerts = prev.filter(a => !['ls-initial', 'ne-initial', 'fin-initial'].includes(a.id));
          return [...fetchedAlerts, ...dynamicAlerts];
      });
    } catch (error) {
      console.error("Failed to fetch initial alerts", error);
    }
  }, []);

  useEffect(() => {
    fetchInitialAlerts();
  }, [fetchInitialAlerts]);

  useEffect(() => {
    let socket: Socket;
    
    // Interval to trigger re-renders so snoozed alerts pop back up
    const interval = setInterval(() => setAlerts(a => [...a]), 10000);

    const initSocket = async () => {
      const baseUrl = await AsyncStorage.getItem('backend_url');
      if (baseUrl) {
        const socketUrl = baseUrl.replace('/api', '');
        socket = io(socketUrl, {
          transports: ['websocket']
        });
        
        socket.on('connect', () => {
          console.log('Connected to socket server');
        });

        socket.on('inventory_alert', (data) => {
          setAlerts(prev => [{
            id: Date.now().toString() + Math.random(),
            message: `Inventory: ${data.message}`,
            isRead: false,
            snoozedUntil: null
          }, ...prev]);
        });
        
        socket.on('finance_alert', (data) => {
          setAlerts(prev => [{
            id: Date.now().toString() + Math.random(),
            message: `Finance: ${data.message}`,
            isRead: false,
            snoozedUntil: null
          }, ...prev]);
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchInitialAlerts();
    setRefreshing(false);
  }, [fetchInitialAlerts]);

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
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
