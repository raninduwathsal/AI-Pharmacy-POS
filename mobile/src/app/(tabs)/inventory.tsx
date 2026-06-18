import { View, Text, StyleSheet, FlatList, TextInput } from 'react-native';
import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { Skeleton } from '../../components/ui/Skeleton';
import Fuse from 'fuse.js';

export default function InventoryScreen() {
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        setIsLoading(true);
        const baseUrl = await AsyncStorage.getItem('backend_url');
        const token = await AsyncStorage.getItem('token');
        if (baseUrl && token) {
          try {
            const res = await fetch(`${baseUrl}/products`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) setProducts(data);
          } catch (e) { console.error(e); }
        }
        setIsLoading(false);
      };
      loadData();
    }, [])
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        {[1,2,3,4,5].map(key => (
           <View key={key} style={styles.card}>
             <Skeleton height={20} width="60%" style={{ marginBottom: 10 }} />
             <Skeleton height={15} width="40%" />
           </View>
        ))}
      </View>
    );
  }

  const fuse = new Fuse(products, {
    keys: ['name'],
    threshold: 0.3
  });

  const filteredProducts = searchQuery
    ? fuse.search(searchQuery).map(result => result.item)
    : products;

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search inventory..."
        value={searchQuery}
        onChangeText={setSearchQuery}
      />
      <FlatList
        data={filteredProducts}
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
  searchInput: { backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#e5e7eb', fontSize: 16 },
  card: { padding: 15, backgroundColor: '#fff', marginBottom: 10, borderRadius: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3 },
  name: { fontSize: 16, fontWeight: 'bold' }
});
