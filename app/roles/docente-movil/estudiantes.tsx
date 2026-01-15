import { View, Text, ScrollView, StyleSheet, TextInput, TouchableOpacity, RefreshControl, Platform, StatusBar, Modal, Button, SafeAreaView } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { getToken, getDarkMode } from '../../../services/storage';
import { API_URL } from '../../../constants/config';
import { eventEmitter } from '../../../services/eventEmitter';

interface Estudiante {
  id_usuario: number;
  nombre: string;
  apellido: string;
  cedula: string;
  email: string;
  telefono?: string;
  curso_nombre: string;
  codigo_curso: string;
  promedio?: number;
  fecha_inicio_curso?: string;
  fecha_fin_curso?: string;
  estado_curso?: 'activo' | 'finalizado' | 'planificado' | 'cancelado';
  fecha_matricula?: string;
}

interface PickerItem {
  label: string;
  value: string;
}

const CompactPicker = ({
  items,
  selectedValue,
  onValueChange,
  placeholder,
  theme
}: {
  items: PickerItem[],
  selectedValue: string,
  onValueChange: (val: string) => void,
  placeholder?: string,
  theme: any
}) => {
  const [showModal, setShowModal] = useState(false);

  const selectedLabel = items.find(i => i.value === selectedValue)?.label || placeholder || items[0]?.label;

  // UI Trigger (Shared)
  const trigger = (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => setShowModal(true)}
      style={[styles.pickerTrigger, {
        backgroundColor: theme.cardBg,
        borderColor: theme.border
      }]}
    >
      <View style={{ flex: 1, marginRight: 8 }}>
        <Text style={{ color: theme.textMuted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 }}>
          {placeholder || 'Seleccionar'}
        </Text>
        <Text style={{ color: theme.text, fontSize: 13, fontWeight: '500' }} numberOfLines={1}>
          {selectedLabel}
        </Text>
      </View>
      <View style={[styles.pickerIcon, { backgroundColor: theme.accent + '15' }]}>
        <Ionicons name="chevron-down" size={16} color={theme.accent} />
      </View>
    </TouchableOpacity>
  );

  if (Platform.OS === 'android') {
    return (
      <>
        {trigger}
        <Modal
          animationType="slide"
          transparent={true}
          visible={showModal}
          onRequestClose={() => setShowModal(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setShowModal(false)}
            style={styles.modalOverlay}
          >
            <Animated.View
              entering={FadeInDown.duration(300)}
              style={[styles.modalContent, { backgroundColor: theme.cardBg }]}
            >
              <View style={[styles.modalIndicator, { backgroundColor: theme.border }]} />

              <View style={styles.modalHeader}>
                <View>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>Seleccionar Opción</Text>
                  <Text style={{ color: theme.textMuted, fontSize: 12 }}>Elige una de las opciones de la lista</Text>
                </View>
                <TouchableOpacity onPress={() => setShowModal(false)} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={24} color={theme.text} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
                {items.map((item, index) => {
                  const isSelected = item.value === selectedValue;
                  return (
                    <TouchableOpacity
                      key={item.value}
                      onPress={() => {
                        onValueChange(item.value);
                        setShowModal(false);
                      }}
                      style={[
                        styles.optionItem,
                        { borderBottomColor: theme.border + '50' },
                        isSelected && { backgroundColor: theme.accent + '15', borderColor: theme.accent }
                      ]}
                    >
                      <View style={styles.optionInfo}>
                        <Text style={[
                          styles.optionText,
                          { color: isSelected ? theme.accent : theme.text },
                          isSelected && { fontWeight: '700' }
                        ]}>
                          {item.label}
                        </Text>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={22} color={theme.accent} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </Animated.View>
          </TouchableOpacity>
        </Modal>
      </>
    );
  }

  // IOS: WHEEL
  return (
    <>
      {trigger}
      <Modal animationType="slide" transparent={true} visible={showModal} onRequestClose={() => setShowModal(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: theme.cardBg, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: theme.border }}>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={{ color: theme.textMuted, fontSize: 16 }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Text style={{ color: theme.accent, fontWeight: '700', fontSize: 16 }}>Listo</Text>
              </TouchableOpacity>
            </View>
            <Picker
              selectedValue={selectedValue}
              onValueChange={(itemValue) => onValueChange(itemValue as string)}
              style={{ height: 200 }}
              itemStyle={{ color: theme.text, fontSize: 18 }}
            >
              {items.map((item) => (
                <Picker.Item key={item.value} label={item.label} value={item.value} />
              ))}
            </Picker>
          </View>
        </View>
      </Modal>
    </>
  );
};

export default function MisEstudiantesScreen() {
  const [darkMode, setDarkMode] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cursoFiltro, setCursoFiltro] = useState<string>('');
  const [estadoFiltro, setEstadoFiltro] = useState<'todos' | 'activos' | 'finalizados'>('todos');

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
      await fetchEstudiantes();
    } catch (error) {
      console.error('Error cargando datos:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchEstudiantes();
    setRefreshing(false);
  };

  const fetchEstudiantes = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/docentes/mis-estudiantes`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        const sortedData = [...data].sort((a: Estudiante, b: Estudiante) => {
          const apellidoA = (a.apellido || '').trim().toUpperCase();
          const apellidoB = (b.apellido || '').trim().toUpperCase();
          return apellidoA.localeCompare(apellidoB, 'es');
        });
        setEstudiantes(sortedData);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const theme = darkMode
    ? {
      bg: '#0a0a0a',
      cardBg: '#141414',
      text: '#ffffff',
      textSecondary: '#a1a1aa',
      textMuted: '#71717a',
      border: '#27272a',
      accent: '#3b82f6',
      primaryGradient: ['#3b82f6', '#2563eb'] as const,
      green: '#10b981',
      orange: '#f59e0b',
      purple: '#8b5cf6',
    }
    : {
      bg: '#f8fafc',
      cardBg: '#ffffff',
      text: '#0f172a',
      textSecondary: '#475569',
      textMuted: '#64748b',
      border: '#e2e8f0',
      accent: '#2563eb',
      primaryGradient: ['#3b82f6', '#2563eb'] as const,
      green: '#10b981',
      orange: '#f59e0b',
      purple: '#8b5cf6',
    };

  const cursosUnicos = Array.from(new Set(estudiantes.map(e => `${e.codigo_curso}||${e.curso_nombre}`)))
    .map(k => ({ codigo: k.split('||')[0], nombre: k.split('||')[1] }));

  const estudiantesFiltrados = estudiantes.filter(est => {
    const matchTexto =
      est.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      est.apellido.toLowerCase().includes(searchTerm.toLowerCase()) ||
      est.cedula.includes(searchTerm) ||
      est.curso_nombre.toLowerCase().includes(searchTerm.toLowerCase());

    const matchCurso = !cursoFiltro || est.codigo_curso === cursoFiltro;

    const studentEstado = est.estado_curso || 'activo';

    const matchEstado = estadoFiltro === 'todos' ||
      (estadoFiltro === 'activos' && studentEstado === 'activo') ||
      (estadoFiltro === 'finalizados' && studentEstado === 'finalizado');

    return matchTexto && matchCurso && matchEstado;
  });

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  };

  const getEstadoColor = (estado?: string) => {
    const studentEstado = estado || 'activo';
    switch (studentEstado) {
      case 'activo':
        return { bg: 'rgba(16, 185, 129, 0.2)', color: theme.green };
      case 'finalizado':
        return { bg: 'rgba(156, 163, 175, 0.2)', color: theme.textMuted };
      case 'planificado':
        return { bg: 'rgba(245, 158, 11, 0.2)', color: theme.orange };
      case 'cancelado':
        return { bg: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' };
      default:
        return { bg: 'rgba(156, 163, 175, 0.2)', color: theme.textMuted };
    }
  };

  const getEstadoText = (estado?: string) => {
    const studentEstado = estado || 'activo';
    switch (studentEstado) {
      case 'activo': return 'Activo';
      case 'finalizado': return 'Finalizado';
      case 'planificado': return 'Planificado';
      case 'cancelado': return 'Cancelado';
      default: return 'Activo';
    }
  };

  const promedioGeneral = estudiantesFiltrados.length > 0
    ? (estudiantesFiltrados.reduce((acc, e) => acc + (e.promedio || 0), 0) / estudiantesFiltrados.length).toFixed(1)
    : '0.0';

  const destacados = estudiantesFiltrados.filter(e => e.promedio && e.promedio >= 8).length;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />

      {/* PREMIUM HEADER - CLEAN NIKE EFFECT */}
      <Animated.View entering={FadeInDown.duration(400)}>
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
          <View style={styles.headerContent}>
            <View>
              <Text style={[styles.headerTitle, { color: theme.text }]}>Mis Estudiantes</Text>
              <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Gestiona y monitorea el progreso</Text>
            </View>
            <Ionicons name="people" size={28} color={theme.accent} />
          </View>
        </View>
      </Animated.View>

      {/* Estadísticas */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.border, borderWidth: 1 }]}>
          <View style={{ padding: 6, borderRadius: 20, backgroundColor: theme.accent + '15', marginBottom: 4 }}>
            <Ionicons name="people" size={14} color={theme.accent} />
          </View>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total</Text>
          <Text style={[styles.statValue, { color: theme.text }]}>{estudiantesFiltrados.length}</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.border, borderWidth: 1 }]}>
          <View style={{ padding: 6, borderRadius: 20, backgroundColor: theme.green + '15', marginBottom: 4 }}>
            <Ionicons name="trophy" size={14} color={theme.green} />
          </View>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Destacados</Text>
          <Text style={[styles.statValue, { color: theme.text }]}>{destacados}</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.border, borderWidth: 1 }]}>
          <View style={{ padding: 6, borderRadius: 20, backgroundColor: theme.orange + '15', marginBottom: 4 }}>
            <Ionicons name="star" size={14} color={theme.orange} />
          </View>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Promedio</Text>
          <Text style={[styles.statValue, { color: theme.text }]}>{promedioGeneral}</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.border, borderWidth: 1 }]}>
          <View style={{ padding: 6, borderRadius: 20, backgroundColor: theme.purple + '15', marginBottom: 4 }}>
            <Ionicons name="book" size={14} color={theme.purple} />
          </View>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Cursos</Text>
          <Text style={[styles.statValue, { color: theme.text }]}>{cursosUnicos.length}</Text>
        </View>
      </View>

      {/* Filtros */}
      <View style={styles.filtersContainer}>
        <View style={[styles.searchContainer, { backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderColor: theme.border }]}>
          <Ionicons name="search" size={16} color={theme.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Buscar por nombre, cédula..."
            placeholderTextColor={theme.textMuted}
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
        </View>

        <CompactPicker
          items={[
            { label: "Todos los cursos", value: "" },
            ...cursosUnicos.map(c => ({ label: `${c.codigo} - ${c.nombre}`, value: c.codigo }))
          ]}
          selectedValue={cursoFiltro}
          onValueChange={setCursoFiltro}
          theme={theme}
          placeholder="Todos los cursos"
        />

        <CompactPicker
          items={[
            { label: "Todos los estados", value: "todos" },
            { label: "Cursos Activos", value: "activos" },
            { label: "Cursos Finalizados", value: "finalizados" }
          ]}
          selectedValue={estadoFiltro}
          onValueChange={(val) => setEstadoFiltro(val as any)}
          theme={theme}
          placeholder="Todos los estados"
        />
      </View>

      {/* Lista de Estudiantes */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Cargando estudiantes...</Text>
          </View>
        ) : estudiantesFiltrados.length === 0 ? (
          <View style={[styles.emptyContainer, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <Ionicons name="people-outline" size={64} color={theme.textMuted} style={{ opacity: 0.5 }} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              {searchTerm || cursoFiltro || estadoFiltro !== 'todos'
                ? 'No se encontraron estudiantes'
                : 'No tienes estudiantes asignados'}
            </Text>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              {searchTerm || cursoFiltro || estadoFiltro !== 'todos'
                ? 'Intenta con otros términos de búsqueda'
                : 'Los estudiantes aparecerán aquí cuando se matriculen'}
            </Text>
          </View>
        ) : (
          <View style={styles.estudiantesList}>
            {estudiantesFiltrados.map((estudiante) => {
              const estadoColor = getEstadoColor(estudiante.estado_curso);
              const estadoText = getEstadoText(estudiante.estado_curso);

              return (
                <View key={`${estudiante.id_usuario}-${estudiante.codigo_curso}`} style={[styles.estudianteCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                  {/* Compact Header: Avatar + Name + Badge in one line */}
                  <View style={styles.estudianteHeader}>
                    <View style={[styles.estudianteAvatar, { backgroundColor: theme.accent }]}>
                      <Text style={styles.estudianteAvatarText}>
                        {estudiante.nombre.charAt(0)}{estudiante.apellido.charAt(0)}
                      </Text>
                    </View>
                    <View style={styles.estudianteInfo}>
                      <Text style={[styles.estudianteNombre, { color: theme.text }]} numberOfLines={1}>
                        {estudiante.apellido}, {estudiante.nombre}
                      </Text>
                      <Text style={[styles.estudianteCedula, { color: theme.textMuted }]}>
                        {estudiante.cedula}
                      </Text>
                    </View>
                    <View style={[styles.estudianteEstadoBadge, { backgroundColor: estadoColor.bg }]}>
                      <Text style={[styles.estudianteEstadoText, { color: estadoColor.color }]}>
                        {estadoText}
                      </Text>
                    </View>
                  </View>

                  {/* Compact Details: Course + Dates in single row */}
                  <View style={[styles.estudianteDetails, { backgroundColor: darkMode ? 'rgba(59, 130, 246, 0.05)' : 'rgba(59, 130, 246, 0.03)' }]}>
                    <View style={styles.estudianteCurso}>
                      <Ionicons name="book" size={12} color={theme.accent} />
                      <View style={[styles.cursoBadge, { backgroundColor: theme.accent + '20' }]}>
                        <Text style={[styles.cursoBadgeText, { color: theme.accent }]}>
                          {estudiante.codigo_curso}
                        </Text>
                      </View>
                      <Text style={[styles.cursoNombre, { color: theme.text }]} numberOfLines={1}>
                        {estudiante.curso_nombre}
                      </Text>
                    </View>

                    <View style={styles.estudianteFechas}>
                      <View style={styles.fechaItem}>
                        <Ionicons name="calendar-outline" size={10} color={theme.textMuted} />
                        <Text style={[styles.fechaValue, { color: theme.textSecondary }]}>
                          {formatDate(estudiante.fecha_inicio_curso)}
                        </Text>
                      </View>
                      <Ionicons name="arrow-forward" size={10} color={theme.textMuted} />
                      <View style={styles.fechaItem}>
                        <Ionicons name="calendar-outline" size={10} color={theme.textMuted} />
                        <Text style={[styles.fechaValue, { color: theme.textSecondary }]}>
                          {formatDate(estudiante.fecha_fin_curso)}
                        </Text>
                      </View>
                    </View>
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
    paddingTop: Platform.OS === 'ios' ? 40 : 20,
    paddingBottom: 15,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 6,
  },
  statCard: {
    flex: 1,
    padding: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  statLabel: {
    color: '#fff',
    fontSize: 7.5,
    fontWeight: '700',
  },
  statValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  filtersContainer: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
  },
  pickerTrigger: {
    borderRadius: 12,
    borderWidth: 1.5,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  pickerIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '80%',
  },
  modalIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 20,
    opacity: 0.3,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalCloseBtn: {
    padding: 4,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderRadius: 12,
    marginBottom: 4,
  },
  optionInfo: {
    flex: 1,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '500',
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
  estudiantesList: {
    padding: 16,
    paddingTop: 0,
    gap: 8,
  },
  estudianteCard: {
    borderRadius: 10,
    borderWidth: 1,
    overflow: 'hidden',
  },
  estudianteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
  },
  estudianteAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  estudianteAvatarText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  estudianteInfo: {
    flex: 1,
    minWidth: 0,
  },
  estudianteNombre: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 1,
  },
  estudianteCedula: {
    fontSize: 10,
  },
  estudianteEstadoBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
  },
  estudianteEstadoText: {
    fontSize: 9,
    fontWeight: '700',
  },
  estudianteDetails: {
    padding: 8,
    gap: 6,
  },
  estudianteCurso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cursoBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cursoBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  cursoNombre: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
  },
  separator: {
    width: 1,
    height: 24,
  },
  estudianteFechas: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'space-around',
  },
  fechaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  fechaLabel: {
    fontSize: 9,
  },
  fechaValue: {
    fontSize: 10,
    fontWeight: '600',
  },
});
