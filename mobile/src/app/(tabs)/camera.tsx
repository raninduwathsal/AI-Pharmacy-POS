import { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchWithAuth } from '../../lib/api';

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [isUploading, setIsUploading] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  if (!permission) return <View />;
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>We need your permission to show the camera</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        setIsUploading(true);
        const photo = await cameraRef.current.takePictureAsync({ base64: false, quality: 0.3 });
        if (!photo) throw new Error('No photo taken');

        const baseUrl = await AsyncStorage.getItem('backend_url');
        const token = await AsyncStorage.getItem('token');
        if (!baseUrl || !token) throw new Error('Missing configuration');

        const formData = new FormData();
        formData.append('image', {
          uri: photo.uri,
          name: 'photo.jpg',
          type: 'image/jpeg'
        } as any);

        await fetchWithAuth('/pos/upload-mobile-prescription', {
          method: 'POST',
          body: formData
        });

        Alert.alert('Success', 'Photo uploaded and sent to web app!');
      } catch (error: any) {
        Alert.alert('Error', error.message || 'Failed to upload photo');
      } finally {
        setIsUploading(false);
      }
    }
  };

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} ref={cameraRef}>
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.captureBtn} onPress={takePicture} disabled={isUploading}>
            {isUploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.captureText}>Capture Prescription</Text>}
          </TouchableOpacity>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  camera: { flex: 1 },
  buttonContainer: { flex: 1, backgroundColor: 'transparent', flexDirection: 'row', justifyContent: 'center', margin: 20 },
  captureBtn: { alignSelf: 'flex-end', backgroundColor: '#2563eb', padding: 15, borderRadius: 10, marginBottom: 20 },
  captureText: { fontSize: 18, color: 'white', fontWeight: 'bold' },
  text: { textAlign: 'center', marginBottom: 20 },
  btn: { backgroundColor: '#2563eb', padding: 15, borderRadius: 5, alignSelf: 'center' },
  btnText: { color: 'white', fontWeight: 'bold' }
});
