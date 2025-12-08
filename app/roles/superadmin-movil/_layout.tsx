import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Switch, Alert } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { storage } from '../../../services/storage';
import { eventEmitter } from '../../../services/eventEmitter';

export default function SuperAdminLayout() {
  const router = useRouter();
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadUserData();
    loadDarkMode();
  }, []);

  const loadUserData = async () => {
    try {
      const userDataStr = await storage.getItem('user_data');
      if (userDataStr) {
        setUserData(JSON.parse(userDataStr));
      }
    } catch (error) {
      console.error('Error loading user data:', error);
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

  const toggleDarkMode = async (value: boolean) => {
    setDarkMode(value);
    await storage.setItem('dark_mode', value.toString());
    // Emitir evento para que otras pantallas se actualicen
    eventEmitter.emit('darkModeChanged', value);
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
    cardBg: 'rgba(18, 18, 18, 0.95)',
    text: '#fff',
    textSecondary: 'rgba(255, 255, 255, 0.7)',
    border: 'rgba(239, 68, 68, 0.2)',
    accent: '#ef4444',
    tabBg: 'rgba(0, 0, 0, 0.95)',
    tabActive: '#ef4444',
    tabInactive: 'rgba(255, 255, 255, 0.5)',
  } : {
    bg: '#f8fafc',
    cardBg: 'rgba(255, 255, 255, 0.95)',
    text: '#1e293b',
    textSecondary: 'rgba(30, 41, 59, 0.7)',
    border: 'rgba(239, 68, 68, 0.2)',
    accent: '#ef4444',
    tabBg: 'rgba(255, 255, 255, 0.95)',
    tabActive: '#ef4444',
    tabInactive: 'rgba(30, 41, 59, 0.5)',
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
          headerRight: () => (
            <TouchableOpacity
              onPress={() => setShowProfileDrawer(true)}
              style={styles.profileButton}
            >
              <Ionicons name="menu" size={28} color={theme.accent} />
            </TouchableOpacity>
          ),
          tabBarStyle: {
            backgroundColor: theme.tabBg,
            borderTopWidth: 1,
            borderTopColor: theme.border,
            paddingBottom: insets.bottom,
            height: 60 + insets.bottom,
          },
          tabBarActiveTintColor: theme.tabActive,
          tabBarInactiveTintColor: theme.tabInactive,
          tabBarShowLabel: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="stats-chart" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="administradores"
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="people" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="auditoria"
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="shield-checkmark" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="configuracion"
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings" size={size} color={color} />
            ),
          }}
        />
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
            <ScrollView>
              {/* Header del drawer */}
              <View style={styles.drawerHeader}>
                <TouchableOpacity onPress={() => setShowProfileDrawer(false)}>
                  <Ionicons name="close" size={28} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.drawerTitle, { color: theme.text }]}>Configuración</Text>
              </View>

              {/* Perfil */}
              <View style={[styles.profileSection, { borderBottomColor: theme.border }]}>
                <View style={styles.avatarContainer}>
                  <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
                    <Text style={styles.avatarText}>SA</Text>
                  </View>
                </View>
                <Text style={[styles.profileName, { color: theme.text }]}>
                  {userData?.nombre || 'Super Admin'}
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
  profileButton: {
    marginRight: 16,
    padding: 8,
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
