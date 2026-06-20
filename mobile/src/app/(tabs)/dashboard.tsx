import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Alert } from 'react-native';
import { fetchWithAuth } from '../../lib/api';

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
      let fetchedAlerts: AlertItem[] = [];

      // Fetch Read Alerts History
      let readAlertsList: any[] = [];
      try {
        readAlertsList = await fetchWithAuth('/alerts/read');
      } catch (e) {
        // Ignore read alerts error
      }
      const readIds = new Set(readAlertsList.map(r => r.alert_id));

      // Fetch Inventory Alerts
      try {
        const invData = await fetchWithAuth('/inventory/alerts');
        
        if (invData.lowStock && invData.lowStock.length > 0) {
          invData.lowStock.forEach((item: any) => {
            const id = `ls-${item.product_id}`;
            if (!readIds.has(id)) {
              fetchedAlerts.push({
                id,
                message: `Low Stock: ${item.name} (${item.current_stock_level} left)`,
                isRead: false,
                snoozedUntil: null
              });
            }
          });
        }
        
        if (invData.nearExpiry && invData.nearExpiry.length > 0) {
          invData.nearExpiry.forEach((item: any) => {
            const id = `ne-${item.product_id}`;
            if (!readIds.has(id)) {
              fetchedAlerts.push({
                id,
                message: `Expiry Alert: ${item.name} expires on ${item.expiring_dates.join(', ')}`,
                isRead: false,
                snoozedUntil: null
              });
            }
          });
        }
      } catch (err: any) {
        Alert.alert('Inventory Fetch Error', err.message);
      }

      // Fetch Finance Alerts
      try {
        const checksData = await fetchWithAuth('/finance/pending-checks');
        const now = new Date();
        const in7Days = new Date();
        in7Days.setDate(now.getDate() + 7);
        
        const upcomingOrOverdue = (checksData || []).filter((check: any) => {
            const checkDate = new Date(check.check_date);
            return checkDate <= in7Days;
        });

        if (upcomingOrOverdue.length > 0) {
          const id = `fin-initial`;
          if (!readIds.has(id)) {
            fetchedAlerts.push({
              id,
              message: `Finance: ${upcomingOrOverdue.length} upcoming or overdue checks.`,
              isRead: false,
              snoozedUntil: null
            });
          }
        }
      } catch (err: any) {
        Alert.alert('Finance Fetch Error', err.message);
      }

      // Map History
      const historyAlerts: AlertItem[] = readAlertsList.map(r => ({
        id: r.alert_id,
        message: r.message,
        isRead: true,
        snoozedUntil: null
      }));
      
      setAlerts([...fetchedAlerts, ...historyAlerts]);
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

  const markAsRead = async (id: string, message: string) => {
    // Optimistic local update
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, isRead: true } : a));

    try {
      await fetchWithAuth('/alerts/read', {
        method: 'POST',
        body: JSON.stringify({ alert_id: id, message })
      });
    } catch (e) {
       console.error("Failed to mark as read", e);
    }
  };

  const snoozeAlert = (id: string) => {
    // Snooze for 5 minutes
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, snoozedUntil: Date.now() + 5 * 60000 } : a));
  };

  const visibleAlerts = alerts.filter(a => !a.snoozedUntil || a.snoozedUntil < Date.now());
  const activeAlerts = visibleAlerts.filter(a => !a.isRead);
  const readAlerts = visibleAlerts.filter(a => a.isRead);

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
      {activeAlerts.length === 0 && <Text style={styles.none}>No recent alerts</Text>}
      {activeAlerts.map(alert => (
        <View key={alert.id} style={styles.alertCard}>
          <Text style={styles.alertText}>{alert.message}</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => markAsRead(alert.id, alert.message)}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#166534" />
              <Text style={styles.readBtnText}>Mark Read</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => snoozeAlert(alert.id)}>
              <Ionicons name="time-outline" size={20} color="#854d0e" />
              <Text style={styles.snoozeBtnText}>Snooze 5m</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {readAlerts.length > 0 && (
        <>
          <Text style={[styles.title, { marginTop: 20, fontSize: 18, color: '#6b7280' }]}>Recent History</Text>
          {readAlerts.map(alert => (
            <View key={alert.id} style={[styles.alertCard, styles.alertCardRead]}>
              <Text style={[styles.alertText, styles.alertTextRead]}>{alert.message}</Text>
            </View>
          ))}
        </>
      )}
      <View style={{ height: 40 }} />
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
  none: { color: '#666', fontStyle: 'italic', marginBottom: 20 },
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
