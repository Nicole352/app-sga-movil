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
import { LinearGradient } from 'expo-linear-gradient';
import { storage, getDarkMode } from '../../../services/storage';
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
  foto_perfil?: string;
}

interface Stats {
  totalAdmins: number;
  activeAdmins: number;
  sessionsToday: number;
}

interface Activity {
  action: string;
  time: string;
  color: string;
}

export default function ConfiguracionScreen() {
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userData, setUserData] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<Stats>({
    totalAdmins: 0,
    activeAdmins: 0,
    sessionsToday: 0,
  });
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);

  const theme = darkMode ? {
    bg: '#0f172a',
    cardBg: '#1e293b',
    text: '#f8fafc',
    textSecondary: '#cbd5e1',
    textMuted: '#94a3b8',
    border: '#334155',
    primary: '#ef4444',
    inputBg: '#334155',
    success: '#10b981',
    info: '#3b82f6',
  } : {
    bg: '#f8fafc',
    cardBg: '#ffffff',
    text: '#0f172a',
    textSecondary: '#475569',
    textMuted: '#64748b',
    border: '#e2e8f0',
    primary: '#ef4444',
    inputBg: '#ffffff',
    success: '#059669',
    info: '#3b82f6',
  };

  useEffect(() => {
    const loadDarkMode = async () => {
      const mode = await getDarkMode();
      setDarkMode(mode);
    };
    loadDarkMode();

    const handleDarkModeChange = (value: boolean) => setDarkMode(value);
    eventEmitter.on('themeChanged', handleDarkModeChange);
    return () => { eventEmitter.off('themeChanged', handleDarkModeChange); };
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

      const today = new Date().toISOString().split('T')[0];
      const auditRes = await fetch(
        `${API_URL}/auditoria/historial-completo?fecha_inicio=${today}&fecha_fin=${today}`,
        { headers: { Authorization: `Bearer ${token}` } }
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

  const loadRecentActivity = async () => {
    try {
      const token = await storage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(`${API_URL}/auditoria/historial-completo?limite=4`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        const activities = data.data?.auditorias?.map((audit: any) => {
          const timeAgo = getTimeAgo(audit.fecha_operacion);
          let color = '#3b82f6';

          if (audit.operacion === 'INSERT') color = '#10b981';
          else if (audit.operacion === 'UPDATE') color = '#f59e0b';
          else if (audit.operacion === 'DELETE') color = '#ef4444';

          return {
            action: audit.descripcion,
            time: timeAgo,
            color
          };
        }) || [];

        setRecentActivity(activities);
      }
    } catch (error) {
      console.error('Error cargando actividad reciente:', error);
    }
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `Hace ${diffMins} min${diffMins !== 1 ? 's' : ''}`;
    if (diffHours < 24) return `Hace ${diffHours} hora${diffHours !== 1 ? 's' : ''}`;
    return `Hace ${diffDays} día${diffDays !== 1 ? 's' : ''}`;
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchUserData();
      await loadStats();
      await loadRecentActivity();
      setLoading(false);
    };
    init();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUserData();
    await loadStats();
    await loadRecentActivity();
    setRefreshing(false);
  };

  const getInitials = () => {
    if (!userData) return 'SA';
    return `${userData.nombre.charAt(0)}${userData.apellido.charAt(0)}`.toUpperCase();
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg, justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Standardized Header */}
      <LinearGradient
        colors={darkMode ? ['#b91c1c', '#991b1b'] : ['#ef4444', '#dc2626']}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Mi Perfil</Text>
        <Text style={styles.headerSubtitle}>Información personal del Super Administrador</Text>
      </LinearGradient>

      {/* Stats Cards */}
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <View style={[styles.statIconContainer, { backgroundColor: `${theme.primary}15` }]}>
            <Ionicons name="people" size={18} color={theme.primary} />
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={[styles.statValue, { color: theme.text }]}>{stats.totalAdmins}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]} numberOfLines={1}>Total</Text>
          </View>
        </View>

        <View style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <View style={[styles.statIconContainer, { backgroundColor: `${theme.info}15` }]}>
            <Ionicons name="shield-checkmark" size={18} color={theme.info} />
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={[styles.statValue, { color: theme.text }]}>{stats.activeAdmins}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]} numberOfLines={1}>Activos</Text>
          </View>
        </View>

        <View style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <View style={[styles.statIconContainer, { backgroundColor: `${theme.success}15` }]}>
            <Ionicons name="checkmark-circle" size={18} color={theme.success} />
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={[styles.statValue, { color: theme.text }]}>{stats.sessionsToday}</Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]} numberOfLines={1}>Hoy</Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
            {userData?.foto_perfil ? (
              <Text>IMG</Text>
            ) : (
              <Text style={styles.avatarText}>{getInitials()}</Text>
            )}
          </View>
          <Text style={[styles.profileName, { color: theme.text }]}>
            {userData?.nombre} {userData?.apellido}
          </Text>
          <Text style={[styles.profileEmail, { color: theme.textSecondary }]}>
            @{userData?.email?.split('@')[0]}
          </Text>
          <View style={[styles.roleBadge, { backgroundColor: `${theme.primary}15` }]}>
            <Ionicons name="shield-checkmark" size={14} color={theme.primary} />
            <Text style={[styles.roleBadgeText, { color: theme.primary }]}>
              {userData?.rol.toUpperCase()}
            </Text>
          </View>
          <View style={[styles.statusRow, { borderTopColor: theme.border }]}>
            <Ionicons name="checkmark-circle" size={16} color={userData?.estado === 'activo' ? theme.success : theme.primary} />
            <Text style={[styles.statusText, { color: theme.textSecondary }]}>
              Estado: <Text style={{ color: theme.text, fontWeight: '600', textTransform: 'capitalize' }}>{userData?.estado}</Text>
            </Text>
          </View>
          {userData?.cedula && (
            <View style={styles.statusRow}>
              <Ionicons name="card" size={16} color={theme.textMuted} />
              <Text style={[styles.statusText, { color: theme.textSecondary }]}>
                CI: <Text style={{ color: theme.text, fontWeight: '600' }}>{userData.cedula}</Text>
              </Text>
            </View>
          )}
        </View>

        {/* Personal Information */}
        <View style={[styles.section, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="person" size={20} color={theme.primary} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>INFORMACIÓN PERSONAL</Text>
          </View>

          <View style={styles.infoGrid}>
            {[
              { icon: 'person', label: 'Nombres', value: userData?.nombre || 'N/A' },
              { icon: 'person-outline', label: 'Apellidos', value: userData?.apellido || 'N/A' },
              { icon: 'mail', label: 'Email', value: userData?.email || 'N/A' },
              { icon: 'call', label: 'Teléfono', value: userData?.telefono || 'N/A' },
              {
                icon: 'calendar',
                label: 'Fecha Nacimiento',
                value: userData?.fecha_nacimiento
                  ? new Date(userData.fecha_nacimiento).toLocaleDateString('es-EC')
                  : 'N/A',
              },
              {
                icon: 'male-female',
                label: 'Género',
                value: userData?.genero
                  ? userData.genero.charAt(0).toUpperCase() + userData.genero.slice(1)
                  : 'N/A',
              },
            ].map((item, index) => (
              <View key={index} style={styles.infoItem}>
                <View style={[styles.infoBox, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                  <View style={styles.infoHeader}>
                    <Ionicons name={item.icon as any} size={14} color={theme.textMuted} />
                    <Text style={[styles.infoLabel, { color: theme.textMuted }]}>
                      {item.label}
                    </Text>
                  </View>
                  <Text style={[styles.infoValue, { color: theme.text }]} numberOfLines={2}>
                    {item.value}
                  </Text>
                </View>
              </View>
            ))}
            {/* Dirección - Full Width */}
            <View style={styles.infoItemFull}>
              <View style={[styles.infoBox, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                <View style={styles.infoHeader}>
                  <Ionicons name="location" size={14} color={theme.textMuted} />
                  <Text style={[styles.infoLabel, { color: theme.textMuted }]}>
                    Dirección
                  </Text>
                </View>
                <Text style={[styles.infoValue, { color: theme.text }]} numberOfLines={2}>
                  {userData?.direccion || 'N/A'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={[styles.section, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="time" size={20} color={theme.primary} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>ACTIVIDAD RECIENTE</Text>
          </View>

          {recentActivity.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>No hay actividad reciente</Text>
          ) : (
            <View style={styles.activityList}>
              {recentActivity.map((activity, index) => (
                <View key={index} style={[styles.activityItem, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                  <View style={[styles.activityDot, { backgroundColor: activity.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.activityAction, { color: theme.text }]} numberOfLines={2}>
                      {activity.action}
                    </Text>
                    <Text style={[styles.activityTime, { color: theme.textMuted }]}>
                      {activity.time}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 25,
    paddingBottom: 25,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 4 },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },

  // Stats Cards
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: -25,
    gap: 10,
    zIndex: 10,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statLabel: { fontSize: 10, fontWeight: '600', marginBottom: 2 },
  statValue: { fontSize: 14, fontWeight: '700' },

  // Content
  content: { padding: 16, paddingTop: 24 },

  // Profile Card
  profileCard: {
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '700' },
  profileName: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  profileEmail: { fontSize: 13, marginBottom: 10 },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: 12,
  },
  roleBadgeText: { fontSize: 12, fontWeight: '700' },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    width: '100%',
    justifyContent: 'center',
  },
  statusText: { fontSize: 13 },

  // Section
  section: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },

  // Info Grid
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  infoItem: { width: '48%' },
  infoItemFull: { width: '100%' },
  infoBox: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  infoLabel: { fontSize: 11, fontWeight: '600' },
  infoValue: { fontSize: 13, fontWeight: '500' },

  // Activity
  activityList: { gap: 10 },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activityAction: { fontSize: 13, fontWeight: '500', marginBottom: 4 },
  activityTime: { fontSize: 11 },
  emptyText: { textAlign: 'center', fontSize: 13, padding: 20 },
});
