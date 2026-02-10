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
import { API_URL } from '../../../constants/config';
import { getDarkMode, getToken } from '../../../services/storage';
import { eventEmitter } from '../../../services/eventEmitter';
import { useSocket } from '../../../hooks/useSocket';

interface LogEntry {
  level: 'error' | 'warn' | 'info';
  message: string;
  timestamp: string;
}

export default function DashboardSuperAdmin() {
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [systemMetrics, setSystemMetrics] = useState({
    uptime: '0h 0m',
    cpuUsage: 0,
    memoryUsage: 0,
    activeConnections: 0,
    requestsPerMinute: 0,
    errorRate: 0,
  });
  const [dbMetrics, setDbMetrics] = useState({
    totalConnections: 0,
    activeQueries: 0,
    dbSize: '0 MB',
    slowQueries: 0,
    connectionPool: { active: 0, idle: 0, total: 10 },
  });
  const [recentLogs, setRecentLogs] = useState<LogEntry[]>([]);

  const theme = darkMode ? {
    bg: '#0a0a0a',
    cardBg: '#141414',
    text: '#ffffff',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',
    border: '#27272a',
    primary: '#ef4444',
    inputBg: '#1a1a1a',
  } : {
    bg: '#f8fafc',
    cardBg: '#ffffff',
    text: '#0f172a',
    textSecondary: '#475569',
    textMuted: '#64748b',
    border: '#e2e8f0',
    primary: '#ef4444',
    inputBg: '#ffffff',
  };

  useSocket({
    activeConnectionsUpdate: (data) => {
      setSystemMetrics(prev => ({
        ...prev,
        activeConnections: data.activeConnections
      }));
    }
  }, userData?.id_usuario);

  const loadSystemMetrics = async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const headers = { Authorization: `Bearer ${token}` };

      const metricsRes = await fetch(`${API_URL}/sistema/metrics`, { headers });
      if (metricsRes.ok) {
        const metricsData = await metricsRes.json();
        setSystemMetrics(metricsData);
      }

      const dbRes = await fetch(`${API_URL}/sistema/database-metrics`, { headers });
      if (dbRes.ok) {
        const dbData = await dbRes.json();
        setDbMetrics(dbData);
      }

      const logsRes = await fetch(`${API_URL}/sistema/logs?limit=10`, { headers });
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setRecentLogs(logsData);
      }
    } catch (error) {
      console.error('Error loading metrics:', error);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setLoading(true);
      const mode = await getDarkMode();
      setDarkMode(mode);

      // Load user data
      const token = await getToken();
      if (token) {
        try {
          const response = await fetch(`${API_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (response.ok) {
            const data = await response.json();
            setUserData(data);
          }
        } catch (error) {
          console.error('Error loading user data:', error);
        }
      }

      await loadSystemMetrics();
      if (isMounted) setLoading(false);
    };

    loadData();

    const interval = setInterval(loadSystemMetrics, 30000);

    const handleDarkModeChange = (value: boolean) => setDarkMode(value);
    eventEmitter.on('themeChanged', handleDarkModeChange);

    return () => {
      isMounted = false;
      clearInterval(interval);
      eventEmitter.off('themeChanged', handleDarkModeChange);
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSystemMetrics();
    setRefreshing(false);
  };

  const getStatusColor = (value: number, threshold: number) => {
    if (value < threshold * 0.6) return '#22c55e';
    if (value < threshold * 0.8) return '#f59e0b';
    return '#ef4444';
  };

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'error': return 'alert-circle';
      case 'warn': return 'warning';
      default: return 'checkmark-circle';
    }
  };

  const getLogColor = (level: string) => {
    switch (level) {
      case 'error': return '#ef4444';
      case 'warn': return '#f59e0b';
      default: return '#22c55e';
    }
  };

  const systemTiles = [
    {
      title: 'CPU',
      value: `${systemMetrics.cpuUsage}%`,
      icon: 'hardware-chip-outline',
      color: '#3b82f6',
      progress: systemMetrics.cpuUsage,
    },
    {
      title: 'Memoria',
      value: `${systemMetrics.memoryUsage}%`,
      icon: 'server-outline',
      color: '#10b981',
      progress: systemMetrics.memoryUsage,
    },
    {
      title: 'Conexiones',
      value: systemMetrics.activeConnections,
      icon: 'flash-outline',
      color: '#f59e0b',
    },
    {
      title: 'Uptime',
      value: systemMetrics.uptime,
      icon: 'time-outline',
      color: '#22c55e',
    },
    {
      title: 'Peticiones',
      value: systemMetrics.requestsPerMinute,
      icon: 'pulse-outline',
      color: '#8b5cf6',
    },
    {
      title: 'Errores',
      value: `${systemMetrics.errorRate.toFixed(2)}%`,
      icon: 'warning-outline',
      color: systemMetrics.errorRate > 1 ? '#ef4444' : '#22c55e',
    },
  ];

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
      {/* Standardized Header - Clean Nike Effect */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.cardBg,
            borderBottomColor: theme.border,
            borderBottomWidth: 1,
          }
        ]}
      >
        <View>
          <Text style={[styles.welcomeLabel, { color: theme.textSecondary }]}>Bienvenido,</Text>
          <Text style={[styles.userName, { color: theme.text }]}>
            {userData?.nombre} {userData?.apellido}
          </Text>
          <Text style={[styles.userRole, { color: theme.textMuted }]}>Super Administrador</Text>
        </View>
        <View style={styles.dateRow}>
          <Ionicons name="calendar-outline" size={14} color={theme.textSecondary} />
          <Text style={[styles.dateText, { color: theme.textSecondary }]}>
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        {/* Stats Cards - Now inside ScrollView */}
        <View style={styles.statsGrid}>
          {systemTiles.slice(0, 3).map((tile, index) => (
            <View key={index} style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <View style={[styles.statIconContainer, { backgroundColor: `${tile.color}15` }]}>
                <Ionicons name={tile.icon as any} size={16} color={tile.color} />
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={[styles.statValue, { color: theme.text }]}>{tile.value}</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]} numberOfLines={1}>{tile.title}</Text>
              </View>
              {tile.progress !== undefined && (
                <View style={[styles.progressBar, { backgroundColor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
                  <View style={[styles.progressFill, { width: `${tile.progress}%`, backgroundColor: getStatusColor(tile.progress, 100) }]} />
                </View>
              )}
            </View>
          ))}
        </View>
        {/* Remaining System Metrics */}
        <View style={styles.grid}>
          {systemTiles.slice(3).map((tile, index) => (
            <View key={index} style={[styles.metricCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <View style={styles.metricHeader}>
                <View style={[styles.iconContainer, { backgroundColor: `${tile.color}20`, borderColor: `${tile.color}40` }]}>
                  <Ionicons name={tile.icon as any} size={20} color={tile.color} />
                </View>
                <Text style={[styles.metricTitle, { color: theme.textSecondary }]}>{tile.title}</Text>
              </View>
              <Text style={[styles.metricValue, { color: theme.text }]}>{tile.value}</Text>
              {tile.progress !== undefined && (
                <View style={[styles.progressBar, { backgroundColor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
                  <View style={[styles.progressFill, { width: `${tile.progress}%`, backgroundColor: getStatusColor(tile.progress, 100) }]} />
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Database Metrics */}
        <View style={[styles.section, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="server" size={20} color={theme.primary} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Base de Datos</Text>
          </View>

          <View style={styles.dbGrid}>
            {[
              { label: 'Conexiones', value: dbMetrics.totalConnections, color: '#3b82f6' },
              { label: 'Consultas', value: dbMetrics.activeQueries, color: '#10b981' },
              { label: 'Tamaño', value: dbMetrics.dbSize, color: '#8b5cf6' },
              { label: 'Lentas', value: dbMetrics.slowQueries, color: dbMetrics.slowQueries > 0 ? '#ef4444' : '#22c55e' },
            ].map((item, index) => (
              <View key={index} style={[styles.dbCard, { backgroundColor: `${item.color}15`, borderColor: `${item.color}30` }]}>
                <Text style={[styles.dbLabel, { color: theme.textMuted }]}>{item.label}</Text>
                <Text style={[styles.dbValue, { color: item.color }]}>{item.value}</Text>
              </View>
            ))}
          </View>

          <View style={[styles.poolSection, { backgroundColor: darkMode ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.03)', borderColor: theme.border }]}>
            <Text style={[styles.poolTitle, { color: theme.textSecondary }]}>Pool de Conexiones</Text>
            <View style={[styles.poolBar, { backgroundColor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
              <View style={[styles.poolFill, { width: `${(dbMetrics.connectionPool.active / dbMetrics.connectionPool.total) * 100}%` }]} />
            </View>
            <View style={styles.poolStats}>
              <Text style={[styles.poolText, { color: theme.textSecondary }]}>Activas: {dbMetrics.connectionPool.active}</Text>
              <Text style={[styles.poolText, { color: theme.textSecondary }]}>Inactivas: {dbMetrics.connectionPool.idle}</Text>
            </View>
          </View>
        </View>

        {/* System Logs */}
        <View style={[styles.section, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text" size={20} color={theme.primary} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Registros del Sistema</Text>
          </View>

          {recentLogs.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="file-tray-outline" size={48} color={theme.textMuted} />
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>No hay registros disponibles</Text>
            </View>
          ) : (
            <View style={styles.logsContainer}>
              {recentLogs.map((log, index) => {
                const logColor = getLogColor(log.level);
                return (
                  <View key={index} style={[styles.logItem, { backgroundColor: darkMode ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.85)', borderColor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(239,68,68,0.12)' }]}>
                    <View style={[styles.logIconContainer, { backgroundColor: `${logColor}20`, borderColor: `${logColor}40` }]}>
                      <Ionicons name={getLogIcon(log.level) as any} size={16} color={logColor} />
                    </View>
                    <View style={styles.logContent}>
                      <Text style={[styles.logMessage, { color: theme.text }]} numberOfLines={2}>{log.message}</Text>
                      <Text style={[styles.logTime, { color: theme.textMuted }]}>
                        {new Date(log.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 8,
    paddingBottom: 15,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  welcomeLabel: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginBottom: 4 },
  userName: { fontSize: 19, fontWeight: '700', color: '#fff', marginBottom: 2 },
  userRole: { fontSize: 13, color: 'rgba(255,255,255,0.9)', marginBottom: 12 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateText: { fontSize: 12, color: 'rgba(255,255,255,0.9)', textTransform: 'capitalize' },

  // Stats Cards (Top 3)
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
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
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statLabel: { fontSize: 9, fontWeight: '600', marginBottom: 2 },
  statValue: { fontSize: 13, fontWeight: '700' },

  // Content
  content: { padding: 16, paddingTop: 12 },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 12,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    alignItems: 'center',
  },
  metricHeader: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  iconContainer: {
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 2,
  },
  metricTitle: { fontSize: 10, fontWeight: '600', textAlign: 'center' },
  metricValue: { fontSize: 13, fontWeight: '700', marginBottom: 2, textAlign: 'center' },
  progressBar: { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%' },

  // Sections
  section: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700' },

  // Database
  dbGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  dbCard: {
    width: '48%',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
  },
  dbLabel: { fontSize: 10, marginBottom: 2 },
  dbValue: { fontSize: 16, fontWeight: '700' },
  poolSection: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  poolTitle: { fontSize: 11, fontWeight: '600', marginBottom: 6 },
  poolBar: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  poolFill: { height: '100%', backgroundColor: '#3b82f6' },
  poolStats: { flexDirection: 'row', justifyContent: 'space-between' },
  poolText: { fontSize: 11 },

  // Logs
  logsContainer: { gap: 12 },
  logItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
  },
  logIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  logContent: { flex: 1 },
  logMessage: { fontSize: 12, fontWeight: '500', marginBottom: 2, fontFamily: 'monospace' },
  logTime: { fontSize: 10 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 14, marginTop: 10 },
});
