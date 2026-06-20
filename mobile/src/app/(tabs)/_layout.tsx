import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TouchableOpacity } from 'react-native';

export default function TabLayout() {
  const router = useRouter();

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    router.replace('/');
  };

  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#2563eb' }}>
      <Tabs.Screen 
        name="dashboard" 
        options={{ 
          title: 'Home', 
          tabBarIcon: ({color}) => <Ionicons name="home" size={24} color={color} />,
          headerRight: () => (
            <TouchableOpacity onPress={handleLogout} style={{ marginRight: 15 }}>
              <Ionicons name="log-out-outline" size={24} color="#ef4444" />
            </TouchableOpacity>
          )
        }} 
      />
      <Tabs.Screen name="inventory" options={{ title: 'Inventory', tabBarIcon: ({color}) => <Ionicons name="cube" size={24} color={color} /> }} />
      <Tabs.Screen name="finance" options={{ title: 'Finance', tabBarIcon: ({color}) => <Ionicons name="cash" size={24} color={color} /> }} />
      <Tabs.Screen name="camera" options={{ title: 'Camera', tabBarIcon: ({color}) => <Ionicons name="camera" size={24} color={color} /> }} />
    </Tabs>
  );
}
