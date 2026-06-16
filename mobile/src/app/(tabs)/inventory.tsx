import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

export default function InventoryScreen() {
  const [products, setProducts] = useState<any[]>([]);

  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        const baseUrl = await AsyncStorage.getItem('backend_url');
        const token = await AsyncStorage.getItem('token');
        if (baseUrl && token) {
          try {
            const res = await fetch(`${baseUrl}/products`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) setProducts(data);
          } catch(e) {}
        }
      };
      loadData();
    }, [])
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={products}
        keyExtractor={item => item.product_id.toString()}
        renderItem={({item}) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            <Text>Stock: {item.current_stock}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10 },
  card: { padding: 15, backgroundColor: '#fff', marginBottom: 10, borderRadius: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3 },
  name: { fontSize: 16, fontWeight: 'bold' }
});
