import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { getToken, getDarkMode } from '../../../services/storage';
import { API_URL } from '../../../constants/config';
import { eventEmitter } from '../../../services/eventEmitter';

interface Horario {
  id_asignacion: number;
  curso_nombre: string;
  codigo_curso: string;
  aula_nombre: string;
  aula_ubicacion: string;
  hora_inicio: string;
  hora_fin: string;
  dias: string;
}

export default function HorarioScreen() {
  const [darkMode, setDarkMode] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [horarios, setHorarios] = useState<Horario[]>([]);

  const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  useEffect(() => {
    loadData();
    
    const themeHandler = (isDark: boolean) => setDarkMode(isDark);
    eventEmitter.on('themeChanged', themeHandler);
    return () => eventEmitter.off('themeChanged', themeHandler);
  }, []);

  const loadData = async () => {
    try {
      const mode = await getDarkMode();
      setDarkMode(mode);
      await fetchHorario();
    } catch (error) {
      console.error('Error cargando datos:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHorario();
    setRefreshing(false);
  };

  const fetchHorario = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/docentes/mi-horario`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setHorarios(data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const theme = {
    bg: darkMode ? '#000000' : '#f8fafc',
    cardBg: darkMode ? '#1a1a1a' : '#ffffff',
    text: darkMode ? '#ffffff' : '#1e293b',
    textSecondary: darkMode ? 'rgba(255,255,255,0.8)' : 'rgba(30,41,59,0.8)',
    textMuted: darkMode ? 'rgba(255,255,255,0.6)' : 'rgba(30,41,59,0.6)',
    border: darkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.3)',
    accent: '#3b82f6',
  };

  const coloresClases = [
    '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#14b8a6'
  ];

  const horariosPorDia = diasSemana.map((dia) => ({
    dia,
    clases: horarios.filter(h => h.dias.split(',').map(d => d.trim()).includes(dia))
  }));

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Mi Horario Semanal</Text>
        <Text style={[styles.headerSubtitle, { color: theme.textMuted }]}>
          Visualiza tu calendario de clases
        </Text>
      </View>

      {/* Lista de Días */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Cargando horario...</Text>
          </View>
        ) : horarios.length === 0 ? (
          <View style={[styles.emptyContainer, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <Ionicons name="calendar-outline" size={64} color={theme.textMuted} style={{ opacity: 0.5 }} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No hay horario asignado</Text>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              Tu horario de clases aparecerá aquí cuando se asigne
            </Text>
          </View>
        ) : (
          <View style={styles.diasList}>
            {horariosPorDia.map((diaData, diaIndex) => {
              if (diaData.clases.length === 0) return null;

              return (
                <View key={diaData.dia} style={[styles.diaCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                  <View style={[styles.diaHeader, { backgroundColor: theme.accent + '15', borderColor: theme.border }]}>
                    <Ionicons name="calendar" size={20} color={theme.accent} />
                    <Text style={[styles.diaNombre, { color: theme.accent }]}>{diaData.dia}</Text>
                    <View style={[styles.clasesCount, { backgroundColor: theme.accent }]}>
                      <Text style={styles.clasesCountText}>{diaData.clases.length}</Text>
                    </View>
                  </View>

                  <View style={styles.clasesList}>
                    {diaData.clases.map((clase, claseIndex) => {
                      const color = coloresClases[claseIndex % coloresClases.length];

                      return (
                        <View key={clase.id_asignacion} style={[styles.claseCard, { borderLeftColor: color, borderLeftWidth: 4 }]}>
                          <View style={styles.claseHeader}>
                            <View style={[styles.claseHora, { backgroundColor: color + '20' }]}>
                              <Ionicons name="time" size={14} color={color} />
                              <Text style={[styles.claseHoraText, { color }]}>
                                {clase.hora_inicio.substring(0, 5)} - {clase.hora_fin.substring(0, 5)}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.claseInfo}>
                            <View style={[styles.claseBadge, { backgroundColor: color + '20' }]}>
                              <Text style={[styles.claseBadgeText, { color }]}>{clase.codigo_curso}</Text>
                            </View>
                            <Text style={[styles.claseNombre, { color: theme.text }]}>{clase.curso_nombre}</Text>
                          </View>

                          <View style={styles.claseAula}>
                            <Ionicons name="location" size={14} color={theme.textMuted} />
                            <Text style={[styles.claseAulaText, { color: theme.textSecondary }]}>
                              {clase.aula_nombre}
                            </Text>
                            {clase.aula_ubicacion && (
                              <>
                                <Text style={[styles.claseAulaSeparator, { color: theme.textMuted }]}>•</Text>
                                <Text style={[styles.claseAulaUbicacion, { color: theme.textMuted }]}>
                                  {clase.aula_ubicacion}
                                </Text>
                              </>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
  },
  emptyContainer: {
    margin: 16,
    padding: 40,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  diasList: {
    padding: 16,
    gap: 16,
  },
  diaCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  diaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderBottomWidth: 1,
  },
  diaNombre: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
  },
  clasesCount: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clasesCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  clasesList: {
    padding: 12,
    gap: 12,
  },
  claseCard: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  claseHeader: {
    marginBottom: 8,
  },
  claseHora: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  claseHoraText: {
    fontSize: 13,
    fontWeight: '700',
  },
  claseInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  claseBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  claseBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  claseNombre: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  claseAula: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  claseAulaText: {
    fontSize: 13,
    fontWeight: '500',
  },
  claseAulaSeparator: {
    fontSize: 13,
  },
  claseAulaUbicacion: {
    fontSize: 12,
  },
});
