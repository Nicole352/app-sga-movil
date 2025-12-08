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
import { API_URL } from '../../../constants/config';
import { storage } from '../../../services/storage';
import { eventEmitter } from '../../../services/eventEmitter';

interface LogEntry {
  level: 'error' | 'warn' | 'info';
  message: string;
  timestamp: string;
}

export default function DashboardSuperAdmin() {
  const [darkMode, setDarkMode] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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

  const loadSystemMetrics = async () => {
    try {
      const token = await storage.getItem('auth_token');
      if (!token) {
        console.log('No token available');
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };

      // Cargar métricas del sistema
      const metricsRes = await fetch(`${API_URL}/sistema/metrics`, { headers });
      if (metricsRes.ok) {
        const metricsData = await metricsRes.json();
        setSystemMetrics(metricsData);
      }

      // Cargar métricas de la base de datos
      const dbRes = await fetch(`${API_URL}/sistema/database-metrics`, { headers });
      if (dbRes.ok) {
        const dbData = await dbRes.json();
        setDbMetrics(dbData);
      }

      // Cargar logs del sistema
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
      
      // Cargar modo oscuro
      const savedMode = await storage.getItem('dark_mode');
      if (savedMode !== null) {
        setDarkMode(savedMode === 'true');
      }
      
      await loadSystemMetrics();
      if (isMounted) {
        setLoading(false);
      }
    };

    loadData();

    // Actualizar métricas cada 30 segundos
    const interval = setInterval(loadSystemMetrics, 30000);

    // Escuchar cambios de modo oscuro
    const handleDarkModeChange = (value: boolean) => {
      setDarkMode(value);
    };
    
    eventEmitter.on('darkModeChanged', handleDarkModeChange);

    return () => {
      isMounted = false;
      clearInterval(interval);
      eventEmitter.off('darkModeChanged', handleDarkModeChange);
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
      case 'error':
        return 'alert-circle';
      case 'warn':
        return 'warning';
      default:
        return 'checkmark-circle';
    }
  };

  const getLogColor = (level: string) => {
    switch (level) {
      case 'error':
        return '#ef4444';
      case 'warn':
        return '#f59e0b';
      default:
        return '#22c55e';
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
      title: 'Tiempo Activo',
      value: systemMetrics.uptime,
      icon: 'time-outline',
      color: '#22c55e',
    },
    {
      title: 'Peticiones/Min',
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
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.bg }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
      }
    >
      <View style={styles.content}>
        {/* Métricas del Sistema */}
        <View style={styles.grid}>
          {systemTiles.map((tile, index) => (
            <View
              key={index}
              style={[
                styles.metricCard,
                {
                  backgroundColor: theme.cardBg,
                  borderColor: theme.border,
                },
              ]}
            >
              <View style={styles.metricHeader}>
                <View
                  style={[
                    styles.iconContainer,
                    {
                      backgroundColor: `${tile.color}20`,
                      borderColor: `${tile.color}40`,
                    },
                  ]}
                >
                  <Ionicons name={tile.icon as any} size={20} color={tile.color} />
                </View>
                <Text style={[styles.metricTitle, { color: theme.textSecondary }]}>
                  {tile.title}
                </Text>
              </View>
              <Text style={[styles.metricValue, { color: theme.text }]}>{tile.value}</Text>
              {tile.progress !== undefined && (
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${tile.progress}%`,
                        backgroundColor: getStatusColor(tile.progress, 100),
                      },
                    ]}
                  />
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Base de Datos */}
        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.cardBg,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Ionicons name="server" size={20} color={theme.accent} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Base de Datos</Text>
          </View>

          <View style={styles.dbGrid}>
            {[
              { label: 'Conexiones', value: dbMetrics.totalConnections, color: '#3b82f6' },
              { label: 'Consultas', value: dbMetrics.activeQueries, color: '#10b981' },
              { label: 'Tamaño', value: dbMetrics.dbSize, color: '#8b5cf6' },
              {
                label: 'Lentas',
                value: dbMetrics.slowQueries,
                color: dbMetrics.slowQueries > 0 ? '#ef4444' : '#22c55e',
              },
            ].map((item, index) => (
              <View
                key={index}
                style={[
                  styles.dbCard,
                  {
                    backgroundColor: `${item.color}15`,
                    borderColor: `${item.color}30`,
                  },
                ]}
              >
                <Text style={[styles.dbLabel, { color: theme.textMuted }]}>{item.label}</Text>
                <Text style={[styles.dbValue, { color: item.color }]}>{item.value}</Text>
              </View>
            ))}
          </View>

          {/* Pool de conexiones */}
          <View style={styles.poolSection}>
            <Text style={[styles.poolTitle, { color: theme.textSecondary }]}>
              Pool de Conexiones
            </Text>
            <View style={styles.poolBar}>
              <View
                style={[
                  styles.poolFill,
                  {
                    width: `${(dbMetrics.connectionPool.active / dbMetrics.connectionPool.total) * 100}%`,
                  },
                ]}
              />
            </View>
            <View style={styles.poolStats}>
              <Text style={[styles.poolText, { color: theme.textSecondary }]}>
                Activas: {dbMetrics.connectionPool.active}
              </Text>
              <Text style={[styles.poolText, { color: theme.textSecondary }]}>
                Inactivas: {dbMetrics.connectionPool.idle}
              </Text>
            </View>
          </View>
        </View>

        {/* Logs del Sistema */}
        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.cardBg,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text" size={20} color={theme.accent} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Registros del Sistema
            </Text>
          </View>

          {recentLogs.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="file-tray-outline" size={48} color={theme.textMuted} />
              <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                No hay registros disponibles
              </Text>
            </View>
          ) : (
            <View style={styles.logsContainer}>
              {recentLogs.map((log, index) => {
                const logColor = getLogColor(log.level);
                return (
                  <View
                    key={index}
                    style={[
                      styles.logItem,
                      {
                        backgroundColor: darkMode
                          ? 'rgba(255, 255, 255, 0.02)'
                          : 'rgba(255, 255, 255, 0.85)',
                        borderColor: darkMode
                          ? 'rgba(255, 255, 255, 0.05)'
                          : 'rgba(239, 68, 68, 0.12)',
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.logIconContainer,
                        {
                          backgroundColor: `${logColor}20`,
                          borderColor: `${logColor}40`,
                        },
                      ]}
                    >
                      <Ionicons
                        name={getLogIcon(log.level) as any}
                        size={16}
                        color={logColor}
                      />
                    </View>
                    <View style={styles.logContent}>
                      <Text
                        style={[styles.logMessage, { color: theme.text }]}
                        numberOfLines={2}
                      >
                        {log.message}
                      </Text>
                      <Text style={[styles.logTime, { color: theme.textMuted }]}>
                        {new Date(log.timestamp).toLocaleTimeString('es-ES', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
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
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    width: '48%',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  metricTitle: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  section: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  dbGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  dbCard: {
    width: '48%',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  dbLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  dbValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  poolSection: {
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 12,
  },
  poolTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  poolBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  poolFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
  },
  poolStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  poolText: {
    fontSize: 12,
  },
  logsContainer: {
    gap: 12,
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  logIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  logContent: {
    flex: 1,
  },
  logMessage: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  logTime: {
    fontSize: 11,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 12,
  },
});
