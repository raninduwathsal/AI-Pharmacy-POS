import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#2563eb' }}>
      <Tabs.Screen name="dashboard" options={{ title: 'Home', tabBarIcon: ({color}) => <Ionicons name="home" size={24} color={color} /> }} />
      <Tabs.Screen name="inventory" options={{ title: 'Inventory', tabBarIcon: ({color}) => <Ionicons name="cube" size={24} color={color} /> }} />
      <Tabs.Screen name="finance" options={{ title: 'Finance', tabBarIcon: ({color}) => <Ionicons name="cash" size={24} color={color} /> }} />
      <Tabs.Screen name="camera" options={{ title: 'Camera', tabBarIcon: ({color}) => <Ionicons name="camera" size={24} color={color} /> }} />
    </Tabs>
  );
}
