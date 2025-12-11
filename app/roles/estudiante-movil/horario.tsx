import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../../../constants/config';
import { getToken, storage } from '../../../services/storage';
import { eventEmitter } from '../../../services/eventEmitter';

interface Horario {
  id_curso: number;
  nombre: string;
  codigo_curso: string;
  aula_nombre: string;
  aula_ubicacion: string;
  hora_inicio: string;
  hora_fin: string;
  dias: string;
  docente_nombre: string;
}

export default function HorarioEstudiante() {
  const [darkMode, setDarkMode] = useState(false);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const loadDarkMode = async () => {
      const savedMode = await storage.getItem('dark_mode');
      if (savedMode !== null) {
        setDarkMode(savedMode === 'true');
      }
    };
    
    loadDarkMode();
    fetchHorario();
    
    eventEmitter.on('themeChanged', (isDark: boolean) => {
      setDarkMode(isDark);
    });
  }, []);

  const fetchHorario = async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/estudiantes/mis-cursos`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const cursosConHorario = data
          .filter((curso: any) => curso.horario?.hora_inicio && curso.horario?.hora_fin && curso.horario?.dias)
          .map((curso: any) => ({
            id_curso: curso.id_curso,
            nombre: curso.nombre,
            codigo_curso: curso.codigo_curso,
            aula_nombre: curso.aula?.nombre || 'Sin aula',
            aula_ubicacion: curso.aula?.ubicacion || '',
            hora_inicio: curso.horario.hora_inicio,
            hora_fin: curso.horario.hora_fin,
            dias: curso.horario.dias,
            docente_nombre: curso.docente?.nombre_completo || 'Sin docente'
          }));
        setHorarios(cursosConHorario);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchHorario();
  };

  const colors = {
    background: darkMode ? '#000000' : '#f8fafc',
    card: darkMode ? '#1a1a1a' : '#ffffff',
    text: darkMode ? '#ffffff' : '#1e293b',
    textSecondary: darkMode ? 'rgba(255,255,255,0.7)' : 'rgba(30,41,59,0.7)',
    border: darkMode ? 'rgba(251, 191, 36, 0.2)' : 'rgba(251, 191, 36, 0.3)',
    accent: '#fbbf24',
  };

  const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const coloresClases = ['#fbbf24', '#f59e0b', '#d97706', '#b45309', '#92400e'];

  // Agrupar horarios por día
  const horariosPorDia = diasSemana.map((dia) => ({
    dia,
    clases: horarios.filter(h => h.dias.split(',').map(d => d.trim()).includes(dia))
  }));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Mi Horario</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Calendario semanal de clases
          </Text>
        </View>

        {loading ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Cargando horario...</Text>
          </View>
        ) : horarios.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="calendar-outline" size={40} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No tienes clases programadas</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Consulta con tu coordinador académico
            </Text>
          </View>
        ) : (
          <View style={styles.section}>
            {horariosPorDia.map(({ dia, clases }) => (
              clases.length > 0 && (
                <View key={dia} style={styles.diaContainer}>
                  <View style={[styles.diaHeader, { backgroundColor: `${colors.accent}15`, borderColor: colors.border }]}>
                    <Text style={[styles.diaText, { color: colors.accent }]}>{dia}</Text>
                    <Text style={[styles.diaCount, { color: colors.textSecondary }]}>
                      {clases.length} {clases.length === 1 ? 'clase' : 'clases'}
                    </Text>
                  </View>

                  {clases.map((clase, index) => (
                    <View
                      key={clase.id_curso}
                      style={[
                        styles.claseCard,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                          borderLeftColor: coloresClases[index % coloresClases.length],
                          borderLeftWidth: 4,
                        }
                      ]}
                    >
                      <View style={styles.claseHeader}>
                        <View style={styles.claseInfo}>
                          <Text style={[styles.claseNombre, { color: colors.text }]} numberOfLines={2}>
                            {clase.nombre}
                          </Text>
                          <View style={[styles.claseBadge, { backgroundColor: `${coloresClases[index % coloresClases.length]}20` }]}>
                            <Text style={[styles.claseBadgeText, { color: coloresClases[index % coloresClases.length] }]}>
                              {clase.codigo_curso}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <View style={styles.claseDetails}>
                        <View style={styles.claseDetail}>
                          <Ionicons name="time" size={14} color={colors.accent} />
                          <Text style={[styles.claseDetailText, { color: colors.textSecondary }]}>
                            {clase.hora_inicio.substring(0, 5)} - {clase.hora_fin.substring(0, 5)}
                          </Text>
                        </View>

                        <View style={styles.claseDetail}>
                          <Ionicons name="location" size={14} color={colors.accent} />
                          <Text style={[styles.claseDetailText, { color: colors.textSecondary }]} numberOfLines={1}>
                            {clase.aula_nombre}
                          </Text>
                        </View>

                        <View style={styles.claseDetail}>
                          <Ionicons name="person" size={14} color={colors.accent} />
                          <Text style={[styles.claseDetailText, { color: colors.textSecondary }]} numberOfLines={1}>
                            {clase.docente_nombre}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )
            ))}
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
    paddingBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 11,
  },
  section: {
    padding: 16,
    paddingTop: 4,
    gap: 10,
  },
  emptyCard: {
    margin: 16,
    padding: 32,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 12,
    textAlign: 'center',
  },
  diaContainer: {
    gap: 8,
  },
  diaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  diaText: {
    fontSize: 13,
    fontWeight: '700',
  },
  diaCount: {
    fontSize: 10,
    fontWeight: '600',
  },
  claseCard: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  claseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  claseInfo: {
    flex: 1,
    gap: 6,
  },
  claseNombre: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
  },
  claseBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    alignSelf: 'flex-start',
  },
  claseBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  claseDetails: {
    gap: 6,
  },
  claseDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  claseDetailText: {
    fontSize: 11,
    flex: 1,
  },
});
