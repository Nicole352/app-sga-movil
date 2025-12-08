import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { storage } from '../../../services/storage';
import { eventEmitter } from '../../../services/eventEmitter';
import { API_URL } from '../../../constants/config';

interface UserProfile {
  id_usuario: number;
  cedula?: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono?: string;
  direccion?: string;
  fecha_nacimiento?: string;
  genero?: string;
  rol: string;
  estado: string;
}

interface Stats {
  totalAdmins: number;
  activeAdmins: number;
  sessionsToday: number;
}

export default function ConfiguracionScreen() {
  const [darkMode, setDarkMode] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userData, setUserData] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<Stats>({
    totalAdmins: 0,
    activeAdmins: 0,
    sessionsToday: 0,
  });

  const theme = darkMode
    ? {
        bg: '#0a0a0a',
        cardBg: 'rgba(18, 18, 18, 0.95)',
        text: '#fff',
        textSecondary: 'rgba(255, 255, 255, 0.7)',
        textMuted: 'rgba(255, 255, 255, 0.5)',
        border: 'rgba(239, 68, 68, 0.2)',
        accent: '#ef4444',
      }
    : {
        bg: '#f8fafc',
        cardBg: 'rgba(255, 255, 255, 0.95)',
        text: '#1e293b',
        textSecondary: 'rgba(30, 41, 59, 0.7)',
        textMuted: 'rgba(30, 41, 59, 0.5)',
        border: 'rgba(239, 68, 68, 0.2)',
        accent: '#ef4444',
      };

  useEffect(() => {
    const loadDarkMode = async () => {
      const savedMode = await storage.getItem('dark_mode');
      if (savedMode !== null) {
        setDarkMode(savedMode === 'true');
      }
    };
    loadDarkMode();

    const handleDarkModeChange = (value: boolean) => {
      setDarkMode(value);
    };

    eventEmitter.on('darkModeChanged', handleDarkModeChange);

    return () => {
      eventEmitter.off('darkModeChanged', handleDarkModeChange);
    };
  }, []);

  const fetchUserData = async () => {
    try {
      const token = await storage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setUserData(data);
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
    }
  };

  const loadStats = async () => {
    try {
      const token = await storage.getItem('auth_token');
      if (!token) return;

      // Cargar total de admins
      const adminsRes = await fetch(`${API_URL}/admins`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (adminsRes.ok) {
        const adminsData = await adminsRes.json();
        const total = adminsData.length;
        const active = adminsData.filter((a: any) => a.estado === 'activo').length;

        setStats((prev) => ({
          ...prev,
          totalAdmins: total,
          activeAdmins: active,
        }));
      }

      // Cargar sesiones de hoy
      const today = new Date().toISOString().split('T')[0];
      const auditRes = await fetch(
        `${API_URL}/auditoria/historial-completo?fecha_inicio=${today}&fecha_fin=${today}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (auditRes.ok) {
        const auditData = await auditRes.json();
        const sessions =
          auditData.data?.auditorias?.filter(
            (a: any) => a.tabla_afectada === 'sesiones_usuario' && a.operacion === 'INSERT'
          ).length || 0;

        setStats((prev) => ({
          ...prev,
          sessionsToday: sessions,
        }));
      }
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchUserData();
      await loadStats();
      setLoading(false);
    };
    init();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUserData();
    await loadStats();
    setRefreshing(false);
  };

  const getInitials = () => {
    if (!userData) return 'SA';
    return `${userData.nombre.charAt(0)}${userData.apellido.charAt(0)}`.toUpperCase();
  };

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: theme.bg, justifyContent: 'center' },
        ]}
      >
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.bg }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.accent}
        />
      }
    >
      <View style={styles.content}>
        {/* Perfil */}
        <View
          style={[
            styles.profileCard,
            { backgroundColor: theme.cardBg, borderColor: theme.border },
          ]}
        >
          <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
            <Text style={styles.avatarText}>{getInitials()}</Text>
          </View>
          <Text style={[styles.profileName, { color: theme.text }]}>
            {userData?.nombre} {userData?.apellido}
          </Text>
          <Text style={[styles.profileRole, { color: theme.textSecondary }]}>
            {userData?.rol.toUpperCase()}
          </Text>
        </View>

        {/* Información Personal */}
        <View
          style={[
            styles.section,
            { backgroundColor: theme.cardBg, borderColor: theme.border },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Ionicons name="person" size={20} color={theme.accent} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Información Personal
            </Text>
          </View>

          <View style={styles.infoGrid}>
            {[
              { icon: 'card', label: 'Cédula', value: userData?.cedula || 'N/A' },
              { icon: 'mail', label: 'Email', value: userData?.email },
              { icon: 'call', label: 'Teléfono', value: userData?.telefono || 'N/A' },
              {
                icon: 'calendar',
                label: 'Fecha Nacimiento',
                value: userData?.fecha_nacimiento
                  ? new Date(userData.fecha_nacimiento).toLocaleDateString('es-EC')
                  : 'N/A',
              },
              { icon: 'location', label: 'Dirección', value: userData?.direccion || 'N/A' },
              {
                icon: 'male-female',
                label: 'Género',
                value: userData?.genero
                  ? userData.genero.charAt(0).toUpperCase() + userData.genero.slice(1)
                  : 'N/A',
              },
            ].map((item, index) => (
              <View key={index} style={styles.infoItem}>
                <View style={styles.infoHeader}>
                  <Ionicons name={item.icon as any} size={16} color={theme.textMuted} />
                  <Text style={[styles.infoLabel, { color: theme.textMuted }]}>
                    {item.label}
                  </Text>
                </View>
                <Text style={[styles.infoValue, { color: theme.text }]} numberOfLines={2}>
                  {item.value}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Estadísticas */}
        <View
          style={[
            styles.section,
            { backgroundColor: theme.cardBg, borderColor: theme.border },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Ionicons name="stats-chart" size={20} color={theme.accent} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Estadísticas del Sistema
            </Text>
          </View>

          <View style={styles.statsGrid}>
            {[
              {
                icon: 'people',
                label: 'Total Admins',
                value: stats.totalAdmins,
                color: '#3b82f6',
              },
              {
                icon: 'checkmark-circle',
                label: 'Admins Activos',
                value: stats.activeAdmins,
                color: '#10b981',
              },
              {
                icon: 'log-in',
                label: 'Sesiones Hoy',
                value: stats.sessionsToday,
                color: '#f59e0b',
              },
            ].map((stat, index) => (
              <View
                key={index}
                style={[
                  styles.statCard,
                  {
                    backgroundColor: `${stat.color}15`,
                    borderColor: `${stat.color}30`,
                  },
                ]}
              >
                <Ionicons name={stat.icon as any} size={28} color={stat.color} />
                <Text style={[styles.statValue, { color: stat.color }]}>
                  {stat.value}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  profileCard: {
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '700',
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
  },
  section: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  infoGrid: {
    gap: 12,
  },
  infoItem: {
    gap: 6,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '30%',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    textAlign: 'center',
  },
});
