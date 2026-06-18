import { View, Text, StyleSheet } from 'react-native';
import { useState, useCallback } from 'react';
import { Calendar } from 'react-native-calendars';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { Skeleton } from '../../components/ui/Skeleton';

export default function FinanceScreen() {
  const [markedDates, setMarkedDates] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const loadChecks = async () => {
        setIsLoading(true);
        const baseUrl = await AsyncStorage.getItem('backend_url');
        const token = await AsyncStorage.getItem('token');
        if (baseUrl && token) {
          try {
            const res = await fetch(`${baseUrl}/finance/pending-checks`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
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
            theme={{
              todayTextColor: '#2563eb',
              arrowColor: '#2563eb',
              dotColor: '#ef4444',
            }}
          />
        )}
      </View>
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
  }
});
