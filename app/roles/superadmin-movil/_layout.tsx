import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Image, ScrollView, Switch, Modal, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BarChart3, Users, Shield, Settings } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { storage, getToken, setUserData as saveUserData } from '../../../services/storage';
import { eventEmitter } from '../../../services/eventEmitter';
import { API_URL } from '../../../constants/config';

export default function SuperAdminLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    loadUserData();
    loadDarkMode();
  }, []);

  const loadUserData = async () => {
    try {
      const token = await getToken();
      if (!token) {
        const userDataStr = await storage.getItem('user_data');
        if (userDataStr) setUserData(JSON.parse(userDataStr));
        return;
      }

      const response = await fetch(`${API_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setUserData(data);
        await saveUserData(data);
      } else {
        const userDataStr = await storage.getItem('user_data');
        if (userDataStr) setUserData(JSON.parse(userDataStr));
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      const userDataStr = await storage.getItem('user_data');
      if (userDataStr) setUserData(JSON.parse(userDataStr));
    }
  };

  const loadDarkMode = async () => {
    try {
      const savedMode = await storage.getItem('dark_mode');
      if (savedMode !== null) {
        setDarkMode(savedMode === 'true');
      }
    } catch (error) {
      console.error('Error loading dark mode:', error);
    }
  };

  const handlePhotoOptions = () => {
    const options: any[] = [
      { text: 'Tomar Foto', onPress: () => takePhoto() },
      { text: 'Elegir de Galería', onPress: () => pickImage() },
    ];
    if (userData?.foto || userData?.foto_perfil || userData?.foto_perfil_url) {
      options.push({ text: 'Eliminar Foto', onPress: () => deletePhoto(), style: 'destructive' });
    }
    options.push({ text: 'Cancelar', style: 'cancel' });

    Alert.alert('Foto de Perfil', 'Selecciona una opción', options);
  };

  const deletePhoto = async () => {
    Alert.alert(
      'Eliminar foto',
      '¿Estás seguro de que quieres eliminar tu foto de perfil?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getToken();
              if (!userData?.id_usuario && !userData?.id) return;
              const userId = userData.id_usuario || userData.id;

              const response = await fetch(`${API_URL}/usuarios/${userId}/foto-perfil`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
              });

              if (response.ok) {
                await loadUserData(); // Recargar datos
                Alert.alert('Éxito', 'Foto eliminada correctamente');
              } else {
                Alert.alert('Error', 'No se pudo eliminar la foto');
              }
            } catch (error) {
              console.error('Error eliminando foto:', error);
              Alert.alert('Error', 'Error al eliminar la foto');
            }
          }
        }
      ]
    );
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso Denegado', 'Se necesita acceso a la cámara');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      uploadPhoto(result.assets[0].uri);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso Denegado', 'Se necesita acceso a la galería');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      uploadPhoto(result.assets[0].uri);
    }
  };

  const uploadPhoto = async (uri: string) => {
    try {
      const token = await getToken();
      if (!userData?.id_usuario && !userData?.id) {
        Alert.alert('Error', 'No se pudo obtener la información del usuario');
        return;
      }
      const userId = userData.id_usuario || userData.id;

      const formData = new FormData();
      const filename = uri.split('/').pop() || 'photo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('foto', {
        uri,
        name: filename,
        type
      } as any);

      const response = await fetch(`${API_URL}/usuarios/${userId}/foto-perfil`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      if (response.ok) {
        await loadUserData(); // Recargar datos
        Alert.alert('Éxito', 'Foto actualizada correctamente');
      } else {
        const errorText = await response.text();
        console.error('Upload Error:', errorText);
        Alert.alert('Error', 'No se pudo actualizar la foto');
      }
    } catch (error: any) {
      console.error('Error subiendo foto:', error);
      Alert.alert('Error', error?.message || 'No se pudo actualizar la foto');
    }
  };

  const toggleDarkMode = async (value: boolean) => {
    setDarkMode(value);
    await storage.setItem('dark_mode', value.toString());
    // Emitir evento para que otras pantallas se actualicen
    eventEmitter.emit('themeChanged', value);
  };

  const handleLogout = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro que deseas cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Sesión',
          style: 'destructive',
          onPress: async () => {
            await storage.clear();
            setShowProfileDrawer(false);
            router.replace('/aula-virtual');
          },
        },
      ]
    );
  };

  const theme = darkMode ? {
    bg: '#0a0a0a',
    cardBg: '#141414',
    text: '#ffffff',
    textSecondary: '#a1a1aa',
    border: '#27272a',
    accent: '#ef4444',
    tabBg: '#141414',
    tabActive: '#ef4444',
    tabInactive: '#71717a',
  } : {
    bg: '#f8fafc',
    cardBg: '#ffffff',
    text: '#1e293b',
    textSecondary: 'rgba(30, 41, 59, 0.7)',
    border: 'rgba(239, 68, 68, 0.15)',
    accent: '#ef4444',
    tabBg: '#ffffff',
    tabActive: '#ef4444',
    tabInactive: 'rgba(30, 41, 59, 0.4)',
  };

  return (
    <>
      <Tabs
        key={darkMode ? 'dark' : 'light'}
        screenOptions={{
          headerShown: true,
          headerStyle: {
            backgroundColor: theme.cardBg,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
          },
          headerTintColor: theme.text,
          headerTitle: 'PANEL SUPER ADMIN',
          headerTitleAlign: 'left',
          headerTitleStyle: {
            fontWeight: '700',
            fontSize: 16,
            letterSpacing: 0.5,
          },
          headerRight: () => {
            const initials = userData?.nombre && userData?.apellido
              ? `${userData.nombre.charAt(0)}${userData.apellido.charAt(0)}`
              : userData?.nombre?.charAt(0) || 'SA';

            return (
              <TouchableOpacity onPress={() => setShowProfileDrawer(true)} style={{ marginRight: 16 }}>
                <View style={[styles.headerAvatar, { backgroundColor: theme.accent }]}>
                  {userData?.foto || userData?.foto_perfil || userData?.foto_perfil_url ? (
                    <Image source={{ uri: userData.foto || userData.foto_perfil || userData.foto_perfil_url }} style={styles.headerAvatarImg} />
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                      {initials}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          },
          tabBarShowLabel: false,
          tabBarActiveTintColor: theme.accent,
          tabBarInactiveTintColor: theme.tabInactive,
          tabBarStyle: {
            backgroundColor: theme.cardBg,
            borderTopColor: theme.border,
            borderTopWidth: 1,
            height: 60 + insets.bottom,
            paddingTop: 12,
            elevation: 0,
            shadowOpacity: 0,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Resumen',
            tabBarIcon: ({ color, size, focused }) => (
              <BarChart3 size={24} color={color} strokeWidth={focused ? 2.5 : 2} />
            ),
          }}
        />
        <Tabs.Screen
          name="administradores"
          options={{
            title: 'Admins',
            tabBarIcon: ({ color, size, focused }) => (
              <Users size={24} color={color} strokeWidth={focused ? 2.5 : 2} />
            ),
          }}
        />
        <Tabs.Screen
          name="auditoria"
          options={{
            title: 'Auditoría',
            tabBarIcon: ({ color, size, focused }) => (
              <Shield size={24} color={color} strokeWidth={focused ? 2.5 : 2} />
            ),
          }}
        />
        <Tabs.Screen
          name="configuracion"
          options={{
            title: 'Ajustes',
            tabBarIcon: ({ color, size, focused }) => (
              <Settings size={24} color={color} strokeWidth={focused ? 2.5 : 2} />
            ),
          }}
        />

        {/* Ocultar rutas extra explícitamente */}
        <Tabs.Screen name="components/CompactPicker" options={{ href: null }} />
        <Tabs.Screen name="components/Pagination" options={{ href: null }} />
      </Tabs>

      {/* Drawer lateral derecho para perfil */}
      <Modal
        visible={showProfileDrawer}
        animationType="slide"
        transparent
        onRequestClose={() => setShowProfileDrawer(false)}
      >
        <TouchableOpacity
          style={styles.drawerOverlay}
          activeOpacity={1}
          onPress={() => setShowProfileDrawer(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.drawerContent, { backgroundColor: theme.cardBg }]}
            onPress={(e) => e.stopPropagation()}
          >
            <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 1 }}>
              {/* Header del drawer */}
              <View style={styles.drawerHeader}>
                <TouchableOpacity onPress={() => setShowProfileDrawer(false)}>
                  <Ionicons name="close" size={28} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.drawerTitle, { color: theme.text }]}>Configuración</Text>
              </View>

              {/* Perfil */}
              <View style={[styles.profileSection, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={handlePhotoOptions} style={styles.avatarContainer}>
                  <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
                    {userData?.foto || userData?.foto_perfil || userData?.foto_perfil_url ? (
                      <Image source={{ uri: userData.foto || userData.foto_perfil || userData.foto_perfil_url }} style={[styles.avatar, { width: 80, height: 80, borderRadius: 40 }]} />
                    ) : (
                      <Text style={styles.avatarText}>
                        {userData?.nombre && userData?.apellido
                          ? `${userData.nombre.charAt(0)}${userData.apellido.charAt(0)}`
                          : userData?.nombre?.charAt(0) || 'SA'}
                      </Text>
                    )}
                    <View style={styles.editIconContainer}>
                      <Ionicons name="camera" size={14} color="#fff" />
                    </View>
                  </View>
                </TouchableOpacity>
                <Text style={[styles.profileName, { color: theme.text }]}>
                  {userData?.nombre || 'Super Admin'} {userData?.apellido || ''}
                </Text>
                <Text style={[styles.profileEmail, { color: theme.textSecondary }]}>
                  {userData?.email || userData?.username || 'superadmin@belleza.com'}
                </Text>
              </View>

              {/* Modo oscuro */}
              <View style={[styles.settingItem, { borderBottomColor: theme.border }]}>
                <View style={styles.settingLeft}>
                  <Ionicons
                    name={darkMode ? 'moon' : 'sunny'}
                    size={24}
                    color={theme.accent}
                  />
                  <Text style={[styles.settingText, { color: theme.text }]}>Modo Oscuro</Text>
                </View>
                <Switch
                  value={darkMode}
                  onValueChange={toggleDarkMode}
                  trackColor={{ false: '#767577', true: theme.accent }}
                  thumbColor="#fff"
                />
              </View>

              {/* Cerrar sesión */}
              <TouchableOpacity
                style={[styles.settingItem, { borderBottomWidth: 0 }]}
                onPress={handleLogout}
              >
                <View style={styles.settingLeft}>
                  <Ionicons name="log-out-outline" size={24} color="#ef4444" />
                  <Text style={[styles.settingText, { color: '#ef4444' }]}>Cerrar Sesión</Text>
                </View>
              </TouchableOpacity>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarImg: {
    width: 33,
    height: 33,
    borderRadius: 16.5,
  },
  drawerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  drawerContent: {
    width: '100%',
    maxHeight: '80%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 16,
  },
  drawerTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 1,
    marginHorizontal: 20,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  bigAvatarText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
  },
  editIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    padding: 4,
  },
  drawerName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  settingText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
