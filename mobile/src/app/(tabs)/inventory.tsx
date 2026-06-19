import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity } from 'react-native';
import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Skeleton } from '../../components/ui/Skeleton';
import { Ionicons } from '@expo/vector-icons';

export default function InventoryScreen() {
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      if (searchQuery.trim().length > 0) {
        setSearchHistory(prev => {
          const newHistory = [searchQuery.trim(), ...prev.filter(q => q !== searchQuery.trim())];
          return newHistory.slice(0, 5);
        });
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    const searchData = async () => {
      if (!debouncedQuery.trim()) {
        setProducts([]);
        return;
      }
      setIsLoading(true);
      const baseUrl = await AsyncStorage.getItem('backend_url');
      const token = await AsyncStorage.getItem('token');
      if (baseUrl && token) {
        try {
          const res = await fetch(`${baseUrl}/products/search?q=${encodeURIComponent(debouncedQuery)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          if (res.ok) setProducts(data);
        } catch (e) { console.error(e); }
      }
      setIsLoading(false);
    };
    searchData();
  }, [debouncedQuery]);

  const renderProduct = ({ item }: { item: any }) => {
    let expiries: string[] = [];
    if (item.expiry_dates) {
      try {
        expiries = typeof item.expiry_dates === 'string' ? JSON.parse(item.expiry_dates) : item.expiry_dates;
      } catch (e) {}
    }

    return (
      <View style={styles.card}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.detail}>Stock: {item.current_stock} {item.measure_unit}</Text>
        {expiries && expiries.length > 0 && (
          <Text style={styles.expiry}>Exp: {expiries.join(', ')}</Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search inventory..."
        value={searchQuery}
        onChangeText={setSearchQuery}
      />
      
      {!searchQuery.trim() && searchHistory.length > 0 && (
        <View style={styles.historyContainer}>
          <Text style={styles.historyTitle}>Recent Searches</Text>
          <View style={styles.historyList}>
            {searchHistory.map((query, index) => (
              <TouchableOpacity 
                key={index} 
                style={styles.historyChip} 
                onPress={() => setSearchQuery(query)}
              >
                <Ionicons name="time-outline" size={16} color="#666" style={{ marginRight: 4 }} />
                <Text style={styles.historyChipText}>{query}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {isLoading ? (
        <View>
          {[1,2,3,4,5].map(key => (
            <View key={key} style={styles.card}>
              <Skeleton height={20} width="60%" style={{ marginBottom: 10 }} />
              <Skeleton height={15} width="40%" />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={item => item.product_id.toString()}
          renderItem={renderProduct}
          ListEmptyComponent={
            searchQuery.trim() && !isLoading ? (
              <Text style={styles.emptyText}>No products found matching "{searchQuery}"</Text>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10 },
  searchInput: { backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#e5e7eb', fontSize: 16 },
  historyContainer: { marginBottom: 15 },
  historyTitle: { fontSize: 14, fontWeight: '600', color: '#6b7280', marginBottom: 8 },
  historyList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  historyChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e5e7eb', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  historyChipText: { fontSize: 14, color: '#374151' },
  card: { padding: 15, backgroundColor: '#fff', marginBottom: 10, borderRadius: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 3 },
  name: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  detail: { fontSize: 14, color: '#4b5563' },
  expiry: { fontSize: 12, color: '#ef4444', marginTop: 4 },
  emptyText: { textAlign: 'center', marginTop: 20, color: '#6b7280', fontStyle: 'italic' }
});
