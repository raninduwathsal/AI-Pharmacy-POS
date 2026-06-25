import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { useState, useCallback } from 'react';
import { Calendar } from 'react-native-calendars';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { Skeleton } from '../../components/ui/Skeleton';
import { fetchWithAuth } from '../../lib/api';

export default function FinanceScreen() {
  const [markedDates, setMarkedDates] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);
  const [checks, setChecks] = useState<any[]>([]);
  const [selectedDateChecks, setSelectedDateChecks] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const loadChecks = async () => {
        setIsLoading(true);
        const baseUrl = await AsyncStorage.getItem('backend_url');
        const token = await AsyncStorage.getItem('token');
        if (baseUrl && token) {
          try {
            const data = await fetchWithAuth('/finance/pending-checks');
            if (data) {
              setChecks(data);
              const dates: any = {};
              data.forEach((check: any) => {
                const dateStr = new Date(check.check_date).toISOString().split('T')[0];
                dates[dateStr] = { marked: true, dotColor: '#ef4444' };
              });
              setMarkedDates(dates);
            }
          } catch(e) {
            console.error("Error loading pending checks:", e);
          }
        }
        setIsLoading(false);
      };
      loadChecks();
    }, [])
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pending Checks Tracker</Text>
      <View style={styles.calendarCard}>
        {isLoading ? (
           <View style={{ gap: 10, padding: 20 }}>
             <Skeleton height={30} width="100%" />
             <Skeleton height={250} width="100%" />
           </View>
        ) : (
          <Calendar
            markedDates={markedDates}
            onDayPress={(day: any) => {
               const dayChecks = checks.filter(c => new Date(c.check_date).toISOString().split('T')[0] === day.dateString);
               if (dayChecks.length > 0) {
                   setSelectedDateChecks(dayChecks);
                   setModalVisible(true);
               }
            }}
            theme={{
              todayTextColor: '#2563eb',
              arrowColor: '#2563eb',
              dotColor: '#ef4444',
            }}
          />
        )}
      </View>

      <Modal visible={modalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Checks Due on {selectedDateChecks[0] && new Date(selectedDateChecks[0].check_date).toLocaleDateString()}
            </Text>
            <ScrollView style={{maxHeight: 400}}>
              {selectedDateChecks.map((c, i) => (
                <View key={i} style={styles.checkCard}>
                  <Text style={styles.checkSupplier}>{c.supplier_name}</Text>
                  <Text style={styles.checkDetails}>Amount: {Number(c.total_amount).toFixed(2)}</Text>
                  <Text style={styles.checkDetails}>Invoice #: {c.supplier_invoice_number}</Text>
                  <Text style={styles.checkDetails}>Check #: {c.check_number}</Text>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setModalVisible(false)}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
  calendarCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: 'white', borderRadius: 12, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  checkCard: { backgroundColor: '#f8fafc', padding: 15, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  checkSupplier: { fontSize: 16, fontWeight: 'bold', color: '#1e293b', marginBottom: 5 },
  checkDetails: { fontSize: 14, color: '#475569', marginBottom: 2 },
  closeBtn: { marginTop: 10, backgroundColor: '#3b82f6', padding: 12, borderRadius: 8, alignItems: 'center' },
  closeBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});
