import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
  Dimensions,
  RefreshControl,
  TextInput
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { API_URL } from '../../../constants/config';
import { getToken, getDarkMode, getUserData } from '../../../services/storage';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSocket } from '../../../hooks/useSocket';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import Pagination from './components/Pagination';
import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';

const { width } = Dimensions.get('window');

// --- TEMA ---
const getTheme = (isDark: boolean) => ({
  primary: '#3b82f6',
  secondary: '#2563eb',
  background: isDark ? '#0a0a0a' : '#f8fafc',
  cardBg: isDark ? '#141414' : '#ffffff',
  text: isDark ? '#ffffff' : '#1e293b',
  textSecondary: isDark ? '#a1a1aa' : '#475569',
  textMuted: isDark ? '#71717a' : '#64748b',
  border: isDark ? '#27272a' : '#e2e8f0',
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  primaryGradient: ['#3b82f6', '#2563eb'] as const,
  tableHeaderBg: isDark ? '#1e1e1e' : '#eff6ff',
  categoryHeaderBg: isDark ? 'rgba(59, 130, 246, 0.1)' : '#f1f5f9',
  stickyColShadow: isDark ? '#000000' : '#e2e8f0'
});

// --- INTERFACES ---
interface Tarea {
  id_tarea: number;
  titulo: string;
  nota_maxima: number;
  id_modulo?: number;
  modulo_nombre?: string;
  categoria_nombre?: string;
  ponderacion?: number; // Peso de la categoría
  categoria_ponderacion?: number; // Ponderación específica de la categoría
}

interface ModuloDetalle {
  nombre_modulo: string;
  promedio_modulo_sobre_10: number;
}

interface Estudiante {
  id_estudiante: number;
  nombre: string;
  apellido: string;
  identificacion?: string;
  calificaciones: { [tareaId: number]: number | null };
  promedio_global?: number;
  modulos_detalle?: ModuloDetalle[];
}

// --- PICKER COMPONENT ---
interface PickerItem { label: string; value: string; }
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
      <View style={[styles.pickerIcon, { backgroundColor: theme.primary + '15' }]}>
        <Ionicons name="chevron-down" size={16} color={theme.primary} />
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
                {items.map((item: any) => {
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
                        isSelected && { backgroundColor: theme.primary + '15', borderColor: theme.primary }
                      ]}
                    >
                      <View style={styles.optionInfo}>
                        <Text style={[
                          styles.optionText,
                          { color: isSelected ? theme.primary : theme.text },
                          isSelected && { fontWeight: '700' }
                        ]}>
                          {item.label}
                        </Text>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={22} color={theme.primary} />
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
                <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 16 }}>Listo</Text>
              </TouchableOpacity>
            </View>
            <Picker
              selectedValue={selectedValue}
              onValueChange={(itemValue) => onValueChange(itemValue as string)}
              style={{ height: 200 }}
              itemStyle={{ color: theme.text, fontSize: 18 }}
            >
              {items.map((item: any) => (
                <Picker.Item key={item.value} label={item.label} value={item.value} />
              ))}
            </Picker>
          </View>
        </View>
      </Modal>
    </>
  );
};

// --- TEMA ---
// (Moved Theme usage inside component or passed as prop)

// --- TARJETA ESTUDIANTE (Refactored) ---
const StudentCard = React.memo(({
  est,
  expanded,
  onPress,
  theme,
  moduloActivo,
  modulosList,
  tareas
}: {
  est: Estudiante,
  expanded: boolean,
  onPress: () => void,
  theme: any,
  moduloActivo: string,
  modulosList: string[],
  tareas: Tarea[]
}) => {
  // Determinar estado global
  const promedio = est.promedio_global || 0;
  const isAprobado = promedio >= 7;
  const statusColor = isAprobado ? theme.success : theme.error;
  const statusBg = isAprobado ? theme.success + '15' : theme.error + '15';

  // Datos para vista detallada (agrupación de tareas)
  const groupedTasks = useMemo(() => {
    if (moduloActivo === 'todos') return [];

    // Filtrar tareas del módulo
    const tareasModulo = tareas.filter(t => t.modulo_nombre === moduloActivo);

    // Agrupar por categoría
    const grupos: { [key: string]: { category: string, weight: number, tasks: Tarea[] } } = {};

    tareasModulo.forEach(t => {
      const cat = t.categoria_nombre || 'General';
      if (!grupos[cat]) {
        grupos[cat] = { category: cat, weight: 0, tasks: [] };
      }

      // PRIORIDAD: Usar categoria_ponderacion que viene del JOIN con categorias_evaluacion
      if (t.categoria_ponderacion && t.categoria_ponderacion > 0) {
        grupos[cat].weight = Number(t.categoria_ponderacion);
      }
      // FALLBACK: Si no hay categoria_ponderacion, intentar usar ponderacion de la tarea (si es que se usó esa columna)
      else if (t.ponderacion && t.ponderacion > grupos[cat].weight) {
        grupos[cat].weight = Number(t.ponderacion);
      }

      grupos[cat].tasks.push(t);
    });

    return Object.values(grupos);
  }, [moduloActivo, tareas]);

  return (
    <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
      <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
        <View style={styles.cardHeader}>
          <View style={styles.cardInfo}>
            <Text style={[styles.studentName, { color: theme.text }]}>
              {est.apellido} {est.nombre}
            </Text>
            <Text style={[styles.studentId, { color: theme.textSecondary }]}>
              ID: {est.identificacion}
            </Text>
          </View>
          <View style={[styles.gradeBadge, { backgroundColor: statusBg, borderColor: statusColor + '30' }]}>
            <Text style={[styles.gradeValue, { color: statusColor }]}>
              {promedio.toFixed(2)}
            </Text>
            <Text style={[styles.gradeLabel, { color: statusColor }]}>
              GLOBAL
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {expanded && (
        <Animated.View entering={FadeInDown.duration(200)} style={[styles.cardBody, { borderTopColor: theme.border }]}>
          {moduloActivo === 'todos' ? (
            // VISTA DE TODOS LOS MÓDULOS (RESUMEN)
            <View style={styles.modulesGrid}>
              {modulosList.map((mod, idx) => {
                const det = est.modulos_detalle?.find(d => d.nombre_modulo === mod);
                const notaMod = det ? parseFloat(String(det.promedio_modulo_sobre_10)) : 0;
                const modColor = notaMod >= 7 ? theme.success : (notaMod > 0 ? theme.error : theme.textMuted);

                return (
                  <View key={idx} style={[styles.moduleItem, { backgroundColor: theme.background }]}>
                    <Text style={[styles.moduleName, { color: theme.textSecondary }]} numberOfLines={1}>
                      {mod}
                    </Text>
                    <Text style={[styles.moduleGrade, { color: modColor }]}>
                      {notaMod > 0 ? notaMod.toFixed(2) : '-'}
                    </Text>
                  </View>
                );
              })}
            </View>
          ) : (
            // VISTA DETALLADA POR TAREAS (MÓDULO ESPECÍFICO)
            <View>
              {/* Promedio del Módulo Actual */}
              <View style={[styles.moduleSummary, { backgroundColor: theme.background }]}>
                <Text style={[styles.moduleSummaryTitle, { color: theme.text }]}>PROMEDIO {moduloActivo.toUpperCase()}</Text>
                {(() => {
                  const det = est.modulos_detalle?.find(d => d.nombre_modulo === moduloActivo);
                  const nota = det ? parseFloat(String(det.promedio_modulo_sobre_10)) : 0;
                  const color = nota >= 7 ? theme.success : theme.error;
                  return (
                    <Text style={[styles.moduleSummaryGrade, { color }]}>{nota.toFixed(2)}</Text>
                  );
                })()}
              </View>

              {/* Lista de Tareas Agrupadas */}
              {groupedTasks.length > 0 ? groupedTasks.map((group, idx) => (
                <View key={idx} style={styles.taskGroup}>
                  {/* Encabezado de Categoría estilo Web (Azul + Icono) */}
                  <View style={[
                    styles.taskGroupHeader,
                    {
                      backgroundColor: theme.primary + '10', // Fondo azul muy suave
                      paddingVertical: 8,
                      paddingHorizontal: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6
                    }
                  ]}>
                    <Ionicons name="bookmark" size={14} color={theme.primary} />
                    <Text style={[styles.taskGroupTitle, { color: theme.primary, fontSize: 12 }]}>
                      {group.category.toUpperCase()} ({group.weight.toFixed(2)} pts)
                    </Text>
                  </View>

                  {group.tasks.map(task => {
                    const notaTarea = est.calificaciones[task.id_tarea];
                    const max = task.nota_maxima;

                    // Calcular peso individual de la tarea
                    const numTareas = group.tasks.length;
                    const pesoIndividual = numTareas > 0 ? group.weight / numTareas : 0;

                    // Calculamos porcentaje para color
                    let tColor = theme.textMuted;
                    if (notaTarea !== null && notaTarea !== undefined) {
                      const pct = (Number(notaTarea) / max) * 100;
                      tColor = pct >= 70 ? theme.success : (pct >= 50 ? theme.warning : theme.error);
                    }

                    return (
                      <View key={task.id_tarea} style={[styles.taskRow, { borderBottomColor: theme.border }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.taskTitle, { color: theme.text }]}>{task.titulo}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
                            <Ionicons name="scale-outline" size={9} color={theme.textMuted} />
                            <Text style={[styles.taskWeight, { color: theme.textMuted }]}>
                              {pesoIndividual.toFixed(2)}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.taskGradeContainer}>
                          <Text style={[styles.taskGrade, { color: tColor }]}>
                            {notaTarea ?? '-'}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )) : (
                <Text style={{ color: theme.textMuted, fontSize: 12, textAlign: 'center', padding: 10 }}>
                  No hay tareas registradas en este módulo.
                </Text>
              )}
            </View>
          )}
        </Animated.View>
      )}

      <TouchableOpacity
        style={[styles.expandButton, { borderTopColor: theme.border }]}
        onPress={onPress}
      >
        <Text style={{ fontSize: 11, color: theme.primary, fontWeight: '600' }}>
          {expanded ? 'Ocultar Detalles' : 'Ver Detalles'}
        </Text>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={theme.primary} />
      </TouchableOpacity>
    </View>
  );
});

// --- PANTALLA PRINCIPAL ---
export default function CalificacionesCursoScreen() {
  const { id } = useLocalSearchParams();
  const id_curso = id;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [userId, setUserId] = useState<number | undefined>();
  const theme = getTheme(darkMode);

  // Datos
  const [cursoNombre, setCursoNombre] = useState("Calificaciones");
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
  const [filteredEstudiantes, setFilteredEstudiantes] = useState<Estudiante[]>([]);
  const [modulosList, setModulosList] = useState<string[]>([]);

  // Filtros
  const [moduloActivo, setModuloActivo] = useState<string>("todos");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "aprobados" | "reprobados">("todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [downloadingExcel, setDownloadingExcel] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useFocusEffect(
    useCallback(() => {
      setCurrentPage(1);
    }, [])
  );

  useEffect(() => {
    getUserData().then(user => setUserId(user?.id_usuario));
  }, []);

  useSocket({
    'calificacion_actualizada': () => loadData(true),
    'entrega_calificada': () => loadData(true),
    'tarea_calificada': () => loadData(true),
    'nueva_entrega': () => loadData(true),
    'tarea_entregada_docente': () => loadData(true),
    'tarea_entregada': () => loadData(true),
    'entrega_actualizada': () => loadData(true),
    'nueva_matricula_curso': () => loadData(true),
    'estudiante_matriculado': () => loadData(true),
  }, userId);

  useEffect(() => { loadData(); }, [id_curso]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData(true);
    setRefreshing(false);
  };

  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const token = await getToken();
      const isDark = await getDarkMode();
      setDarkMode(isDark);
      if (!token || !id_curso) return;

      // 1. Info Curso
      const cursoRes = await fetch(`${API_URL}/cursos/${id_curso}`, { headers: { Authorization: `Bearer ${token}` } });
      if (cursoRes.ok) setCursoNombre((await cursoRes.json()).nombre || "Curso");

      // 2. Tareas
      const tareasRes = await fetch(`${API_URL}/cursos/${id_curso}/tareas`, { headers: { Authorization: `Bearer ${token}` } });
      let tareasArr: Tarea[] = tareasRes.ok ? (await tareasRes.json()).tareas || [] : [];

      // 3. Estudiantes
      const estRes = await fetch(`${API_URL}/cursos/${id_curso}/estudiantes`, { headers: { Authorization: `Bearer ${token}` } });
      let estArr: any[] = estRes.ok ? (await estRes.json()).estudiantes || [] : [];

      // 4. Calificaciones
      const califRes = await fetch(`${API_URL}/cursos/${id_curso}/calificaciones`, { headers: { Authorization: `Bearer ${token}` } });
      let califArr: any[] = califRes.ok ? (await califRes.json()).calificaciones || [] : [];

      // 5. Completo (Promedios/Módulos)
      const completoRes = await fetch(`${API_URL}/calificaciones/curso/${id_curso}/completo`, { headers: { Authorization: `Bearer ${token}` } });
      let datosCompletos: any = { modulos: [] };
      if (completoRes.ok) datosCompletos = await completoRes.json();

      setModulosList(datosCompletos.modulos || []);

      // Mapa Promedios
      const mapaPromedios = new Map();
      if (datosCompletos.success && datosCompletos.estudiantes) {
        datosCompletos.estudiantes.forEach((est: any) => {
          mapaPromedios.set(est.id_estudiante, {
            promedio_global: parseFloat(est.promedio_global) || 0,
            modulos_detalle: est.modulos_detalle || []
          });
        });
      }

      // Procesar Estudiantes
      const procesados = estArr.map((est: any) => {
        const califs: { [key: number]: number | null } = {};
        tareasArr.forEach(tarea => {
          const found = califArr.find(c => c.id_estudiante === est.id_estudiante && c.id_tarea === tarea.id_tarea);
          califs[tarea.id_tarea] = found && found.nota_obtenida !== null ? Number(found.nota_obtenida) : null;
        });
        const dataProm = mapaPromedios.get(est.id_estudiante) || {};
        return {
          id_estudiante: est.id_estudiante,
          nombre: est.nombre,
          apellido: est.apellido,
          identificacion: est.cedula,
          calificaciones: califs,
          promedio_global: parseFloat(String(dataProm.promedio_global)) || 0,
          modulos_detalle: dataProm.modulos_detalle || []
        };
      });

      procesados.sort((a, b) => (a.apellido || '').localeCompare(b.apellido || '', 'es'));
      setTareas(tareasArr);
      setEstudiantes(procesados);
      setFilteredEstudiantes(procesados);
    } catch (error) {
      console.error("Error loading:", error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    let result = [...estudiantes];

    // Filtrar por ID, Nombre o Apellido
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(e =>
        (e.nombre?.toLowerCase() || '').includes(query) ||
        (e.apellido?.toLowerCase() || '').includes(query) ||
        (e.identificacion || '').includes(query)
      );
    }

    if (filtroEstado === 'aprobados') result = result.filter(e => (e.promedio_global || 0) >= 7);
    else if (filtroEstado === 'reprobados') result = result.filter(e => (e.promedio_global || 0) < 7);

    setFilteredEstudiantes(result);
    setCurrentPage(1); // Reset page on filter change
  }, [filtroEstado, estudiantes, searchQuery, moduloActivo]);

  const descargarExcel = async () => {
    try {
      setDownloadingExcel(true);
      const token = await getToken();
      if (!token || !id_curso) {
        Alert.alert('Error', 'No se pudo obtener el token de autenticación');
        return;
      }

      const url = `${API_URL}/calificaciones/curso/${id_curso}/excel`;
      const dateStr = new Date().toISOString().split('T')[0];
      const nombreArchivo = `Calificaciones_${cursoNombre.replace(/\s+/g, '_')}_${dateStr}.xlsx`;
      // @ts-ignore - documentDirectory y cacheDirectory existen en runtime
      const tempDir = Platform.OS === 'ios' ? FileSystem.documentDirectory : FileSystem.cacheDirectory;
      const fileUri = `${tempDir}${nombreArchivo}`;

      // Descargar archivo
      // @ts-ignore - downloadAsync existe en runtime
      const downloadResult = await FileSystem.downloadAsync(url, fileUri, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (downloadResult.status === 200) {
        // Compartir archivo
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(downloadResult.uri, {
            mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            dialogTitle: 'Guardar Reporte de Calificaciones'
          });
        } else {
          Alert.alert('Éxito', `Archivo descargado en: ${downloadResult.uri}`);
        }
      } else {
        Alert.alert('Error', 'No se pudo descargar el archivo Excel');
      }
    } catch (error) {
      console.error('Error descargando Excel:', error);
      Alert.alert('Error', 'Ocurrió un error al generar el reporte Excel');
    } finally {
      setDownloadingExcel(false);
    }
  };


  const [expandedId, setExpandedId] = useState<number | null>(null);
  const toggleExpand = (id: number) => {
    // Si ya está expandido, lo cerramos. Si no, abrimos este y cerramos el anterior (acordeón)
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Animated.View entering={FadeInDown.duration(400)}>
        <View style={[styles.header, { backgroundColor: theme.cardBg, borderBottomColor: theme.border, borderBottomWidth: 1 }]}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={20} color={theme.text} />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.headerTitle, { color: theme.text }]} numberOfLines={1}>Calificaciones</Text>
              <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>{cursoNombre}</Text>
            </View>
            <TouchableOpacity
              onPress={descargarExcel}
              disabled={downloadingExcel || loading}
              style={[styles.headerIcon, { backgroundColor: theme.success + '15', marginRight: 8 }]}
            >
              {downloadingExcel ? (
                <ActivityIndicator size="small" color={theme.success} />
              ) : (
                <Ionicons name="download-outline" size={20} color={theme.success} />
              )}
            </TouchableOpacity>
            <View style={[styles.headerIcon, { backgroundColor: theme.primary + '15' }]}>
              <Ionicons name="school-outline" size={20} color={theme.primary} />
            </View>
          </View>
        </View>
      </Animated.View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={{ marginTop: 10, color: theme.textMuted, fontSize: 12 }}>Cargando notas...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={{ paddingBottom: 20 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.primary]}
              tintColor={theme.primary}
            />
          }
        >
          {/* Filtros */}
          <View style={[styles.filtersCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>

            {/* Search Bar */}
            <View style={{ marginBottom: 15 }}>
              <Text style={[styles.label, { color: theme.textMuted }]}>BUSCAR ESTUDIANTE</Text>
              <View style={[styles.searchInputContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
                <Ionicons name="search" size={18} color={theme.textMuted} style={{ marginRight: 8 }} />
                <TextInput
                  style={[styles.searchInput, { color: theme.text }]}
                  placeholder="Buscar por nombre, apellido o ID..."
                  placeholderTextColor={theme.textMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={18} color={theme.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1.4 }}>
                <Text style={[styles.label, { color: theme.textMuted }]}>Módulo</Text>
                <CompactPicker
                  items={[
                    { label: "TODOS", value: "todos" },
                    ...modulosList.map(m => ({ label: m, value: m }))
                  ]}
                  selectedValue={moduloActivo} onValueChange={setModuloActivo} theme={theme}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: theme.textMuted }]}>Estado</Text>
                <CompactPicker
                  items={[{ label: "Todos", value: "todos" }, { label: "Aprobados", value: "aprobados" }, { label: "Reprobados", value: "reprobados" }]}
                  selectedValue={filtroEstado} onValueChange={(val: any) => setFiltroEstado(val)} theme={theme}
                  placeholder="Filtrar"
                />
              </View>
            </View>

            {/* Stats Compactos */}
            <View style={styles.statsSummary}>
              <View style={styles.statItem}>
                <Text style={{ color: theme.textMuted, fontSize: 11 }}>PROMEDIO GRUPAL</Text>
                <Text style={{ color: theme.primary, fontSize: 18, fontWeight: '700' }}>
                  {(filteredEstudiantes.reduce((acc, curr) => acc + (curr.promedio_global || 0), 0) / (filteredEstudiantes.length || 1)).toFixed(2)}
                </Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
              <View style={styles.statItem}>
                <Text style={{ color: theme.textMuted, fontSize: 11 }}>ESTUDIANTE</Text>
                <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>
                  {filteredEstudiantes.length}
                </Text>
              </View>
            </View>
          </View>

          {/* Lista de Estudiantes (Tarjetas) */}
          <View style={styles.listContainer}>
            {filteredEstudiantes.length > 0 ? (
              <>
                {filteredEstudiantes
                  .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                  .map((est) => (
                    <StudentCard
                      key={est.id_estudiante}
                      est={est}
                      expanded={expandedId === est.id_estudiante}
                      onPress={() => toggleExpand(est.id_estudiante)}
                      theme={theme}
                      moduloActivo={moduloActivo}
                      modulosList={modulosList}
                      tareas={tareas}
                    />
                  ))}

                <Pagination
                  currentPage={currentPage}
                  totalPages={Math.ceil(filteredEstudiantes.length / itemsPerPage)}
                  totalItems={filteredEstudiantes.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).length}
                  onPageChange={setCurrentPage}
                  theme={theme}
                  itemLabel="estudiantes"
                />
              </>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={40} color={theme.textMuted} />
                <Text style={{ color: theme.textMuted, marginTop: 10 }}>No se encontraron estudiantes con los filtros seleccionados.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20
  },
  headerContent: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '700' },
  headerSubtitle: { fontSize: 12 },
  headerIcon: { padding: 6, borderRadius: 10 },
  backButton: { padding: 4 },

  content: { flex: 1, padding: 16 },

  // Filtros
  filtersCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2
  },
  label: { fontSize: 11, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
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

  // Stats
  statsSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)'
  },
  statItem: { alignItems: 'center' },
  statDivider: { width: 1, height: 24, backgroundColor: '#e2e8f0' },

  // Lista
  listContainer: { gap: 12, paddingBottom: 10 },
  emptyState: { alignItems: 'center', marginTop: 40, padding: 20 },

  // Tarjeta Estudiante
  card: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 6,
    overflow: 'hidden',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1
  },
  cardHeader: { flexDirection: 'row', padding: 16, alignItems: 'center', justifyContent: 'space-between' },
  cardInfo: { flex: 1 },
  studentName: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  studentId: { fontSize: 11 },
  gradeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    minWidth: 50
  },
  gradeValue: { fontSize: 14, fontWeight: '800' },
  gradeLabel: { fontSize: 8, fontWeight: '700', marginTop: 2 },

  // Cuerpo Tarjeta
  cardBody: { paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, paddingTop: 12 },

  // Grid Modulos
  modulesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  moduleItem: {
    width: '48%',
    padding: 10,
    borderRadius: 10,
    justifyContent: 'space-between'
  },
  moduleName: { fontSize: 11, fontWeight: '600', marginBottom: 4 },
  moduleGrade: { fontSize: 14, fontWeight: '700' },

  // Detalle Tareas
  moduleSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12
  },
  moduleSummaryTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  moduleSummaryGrade: { fontSize: 16, fontWeight: '800' },

  taskGroup: { marginBottom: 12 },
  taskGroupHeader: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 6 },
  taskGroupTitle: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  taskRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 0.5, alignItems: 'flex-start' },
  taskTitle: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
  taskWeight: { fontSize: 10, fontWeight: '400' },
  taskGradeContainer: { flexDirection: 'row', alignItems: 'baseline' },
  taskGrade: { fontSize: 13, fontWeight: '700', marginRight: 2 },
  taskMax: { fontSize: 10 },

  // Boton Expandir
  expandButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.01)'
  },

  // Picker Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 14,
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
});
