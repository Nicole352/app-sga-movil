import React, { useState, useEffect, useRef } from 'react';
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
  RefreshControl
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { API_URL } from '../../../constants/config';
import { getToken, getDarkMode, getUserData } from '../../../services/storage';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSocket } from '../../../hooks/useSocket';

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
    if (filtroEstado === 'aprobados') result = result.filter(e => (e.promedio_global || 0) >= 7);
    else if (filtroEstado === 'reprobados') result = result.filter(e => (e.promedio_global || 0) < 7);
    setFilteredEstudiantes(result);
  }, [filtroEstado, estudiantes]);

  // --- PREPARAR DATOS PARA LA TABLA ---

  // Tareas filtradas por módulo activo
  const tareasVisibles = moduloActivo === 'todos' || moduloActivo === 'resumen_global' ? [] : tareas.filter(t => t.modulo_nombre === moduloActivo);

  // Agrupar Tareas por Categoría para el Header
  const groupedTasks = React.useMemo(() => {
    if (moduloActivo === 'todos' || moduloActivo === 'resumen_global') return [];

    // Ordenar tareas
    // Ordenar tareas por ID (orden de creación) para coincidir con la web
    const sorted = [...tareasVisibles].sort((a, b) => {
      return a.id_tarea - b.id_tarea;
    });

    const groups: { category: string, weight: number, tasks: Tarea[] }[] = [];
    let currentGroup: any = null;

    sorted.forEach(t => {
      const catName = t.categoria_nombre || 'Sin Categoría';
      if (!currentGroup || currentGroup.category !== catName) {
        if (currentGroup) groups.push(currentGroup);
        currentGroup = { category: catName, weight: t.ponderacion || 0, tasks: [] };
      }
      currentGroup.tasks.push(t);
    });
    if (currentGroup) groups.push(currentGroup);
    return groups;
  }, [tareasVisibles, moduloActivo]);


  const renderBadge = (val: number, isGood: boolean) => (
    <View style={[styles.badgeContainer, { backgroundColor: isGood ? theme.success + '15' : theme.error + '15', borderColor: isGood ? theme.success + '30' : theme.error + '30' }]}>
      <Text style={{ fontWeight: '700', fontSize: 13, color: isGood ? theme.success : theme.error }}>{val.toFixed(2)}</Text>
    </View>
  );

  const renderGrade = (val: number | null | undefined, max: number) => {
    if (val === null || val === undefined) return <Text style={{ color: theme.textMuted, fontSize: 13 }}>-</Text>;
    const pct = (val / max) * 100;
    let color = theme.error;
    if (pct >= 70) color = theme.success;
    else if (pct >= 50) color = theme.warning;
    return <Text style={{ color, fontWeight: '600', fontSize: 13 }}>{val}</Text>;
  };

  // CALCULO DINÁMICO DE ANCHO COLUMNA ESTUDIANTE (Solo para Resumen Global)
  // Pantalla - Padding (16*2) - GlobalCol (110) - BorderSafety (2)
  const studentColWidthGlobal = width - 36 - 110;

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
            <View style={[styles.headerIcon, { backgroundColor: theme.primary + '15' }]}>
              <Ionicons name="school-outline" size={20} color={theme.primary} />
            </View>
          </View>
        </View>
      </Animated.View>

      {loading && !refreshing ? <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} /> : (
        <ScrollView
          style={styles.content}
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
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1.4 }}>
                <Text style={[styles.label, { color: theme.textMuted }]}>Módulo</Text>
                <CompactPicker
                  items={[
                    { label: "Todos los módulos", value: "todos" },
                    { label: "Resumen Global", value: "resumen_global" },
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
            <View style={styles.statsSummary}>
              <View style={styles.statItem}>
                <Ionicons name="people-outline" size={14} color={theme.textMuted} />
                <Text style={{ color: theme.textMuted, fontSize: 12, marginLeft: 4 }}>
                  Estudiantes: <Text style={{ color: theme.text, fontWeight: '700' }}>{filteredEstudiantes.length}</Text>
                </Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="analytics-outline" size={14} color={theme.textMuted} />
                <Text style={{ color: theme.textMuted, fontSize: 12, marginLeft: 4 }}>
                  Promedio: <Text style={{ color: theme.primary, fontWeight: '700' }}>
                    {(filteredEstudiantes.reduce((acc, curr) => acc + (curr.promedio_global || 0), 0) / (filteredEstudiantes.length || 1)).toFixed(2)}
                  </Text>
                </Text>
              </View>
            </View>
          </View>

          {/* Tabla */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tableScroll}>
            <View style={{ minWidth: '100%' }}>
              {/* --- HEADER DE TABLA --- */}
              <View style={[styles.tableHeader, { backgroundColor: theme.tableHeaderBg, borderColor: theme.border }]}>
                {/* Columna Estudiante Dynamic Width */}
                <View style={[styles.colNameWrapper, {
                  borderRightColor: theme.border,
                  width: moduloActivo === 'resumen_global' ? studentColWidthGlobal : 140
                }]}>
                  <View style={[styles.colNameContainer, { backgroundColor: theme.tableHeaderBg }]}>
                    <Text style={[styles.headText, { color: theme.primary, textAlign: 'left', paddingLeft: 12 }]}>ESTUDIANTE</Text>
                  </View>
                  <LinearGradient
                    colors={darkMode ? ['rgba(0,0,0,0.5)', 'transparent'] : ['rgba(0,0,0,0.05)', 'transparent']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.stickyShadow}
                  />
                </View>

                {moduloActivo === 'todos' ? (
                  <>
                    {modulosList.map((m, i) => (
                      <View key={i} style={[styles.colModule, { borderColor: theme.border }]}>
                        <Text style={[styles.headText, { color: theme.text }]} numberOfLines={2}>{m.toUpperCase()}</Text>
                      </View>
                    ))}
                    <View style={[styles.colGrade, { borderColor: theme.border }]}>
                      <Text style={[styles.headText, { color: theme.primary, fontWeight: '800' }]}>GLOBAL</Text>
                    </View>
                  </>
                ) : moduloActivo === 'resumen_global' ? (
                  <View style={[styles.colGrade, { borderColor: theme.border, width: 110 }]}>
                    <Text style={[styles.headText, { color: theme.primary, fontWeight: '800', fontSize: 11 }]}>GLOBAL</Text>
                  </View>
                ) : (
                  <>
                    {groupedTasks.map((group, i) => (
                      <View key={i} style={{ flexDirection: 'column', width: group.tasks.length * 130 }}>
                        <View style={{
                          backgroundColor: theme.categoryHeaderBg,
                          paddingVertical: 6,
                          borderBottomWidth: 1,
                          borderColor: theme.border,
                          alignItems: 'center',
                          marginHorizontal: 1,
                          borderTopLeftRadius: 8,
                          borderTopRightRadius: 8,
                        }}>
                          <Text style={{ fontSize: 10, fontWeight: '700', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }} numberOfLines={1}>
                            {group.category.toUpperCase()} <Text style={{ fontWeight: '400', fontSize: 9 }}>({group.weight}%)</Text>
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row' }}>
                          {group.tasks.map(t => (
                            <View key={t.id_tarea} style={[styles.colTask, { borderColor: theme.border }]}>
                              <Text style={[styles.headText, { fontSize: 11, color: theme.text, marginBottom: 2 }]} numberOfLines={1}>{t.titulo}</Text>
                              <Text style={{ fontSize: 9, color: theme.textMuted, fontWeight: '500' }}>/{t.nota_maxima}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    ))}
                    <View style={[styles.colGrade, { borderColor: theme.border, backgroundColor: theme.warning + '08' }]}>
                      <Text style={[styles.headText, { color: theme.warning, fontWeight: '800' }]}>PROMEDIO {moduloActivo.toUpperCase()}</Text>
                    </View>
                  </>
                )}
              </View>

              {/* --- BODY --- */}
              <ScrollView bounces={false}>
                {filteredEstudiantes.map((est, idx) => (
                  <View key={est.id_estudiante} style={[styles.row, {
                    backgroundColor: idx % 2 === 0 ? theme.cardBg : (darkMode ? 'rgba(255,255,255,0.02)' : '#fafafa'),
                    borderColor: theme.border
                  }]}>
                    <View style={[styles.colNameWrapper, {
                      borderRightColor: theme.border,
                      width: moduloActivo === 'resumen_global' ? studentColWidthGlobal : 140
                    }]}>
                      <View style={[styles.colNameContainer, {
                        backgroundColor: idx % 2 === 0 ? theme.cardBg : (darkMode ? '#1e1e1e' : '#fafafa')
                      }]}>
                        <ScrollView
                          horizontal
                          nestedScrollEnabled={true}
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={{ alignItems: 'center', paddingLeft: 12, paddingRight: 12 }}
                        >
                          <Text style={{ fontSize: 10, fontWeight: '700', color: theme.text }}>
                            {est.apellido.toUpperCase()}, {est.nombre.toUpperCase()}
                          </Text>
                        </ScrollView>
                      </View>
                      <LinearGradient
                        colors={darkMode ? ['rgba(0,0,0,0.5)', 'transparent'] : ['rgba(0,0,0,0.05)', 'transparent']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={styles.stickyShadow}
                      />
                    </View>

                    {moduloActivo === 'todos' ? (
                      <>
                        {modulosList.map((m, i) => {
                          const det = est.modulos_detalle?.find(d => d.nombre_modulo === m);
                          const nota = det ? parseFloat(String(det.promedio_modulo_sobre_10)) : 0;
                          return (
                            <View key={i} style={[styles.colModule, { borderColor: theme.border }]}>
                              {renderBadge(nota, nota >= 7)}
                            </View>
                          );
                        })}
                        <View style={[styles.colGrade, { borderColor: theme.border }]}>
                          <Text style={{ fontWeight: '800', fontSize: 14, color: (est.promedio_global || 0) >= 7 ? theme.success : theme.error }}>
                            {(est.promedio_global || 0).toFixed(2)}
                          </Text>
                        </View>
                      </>
                    ) : moduloActivo === 'resumen_global' ? (
                      <View style={[styles.colGrade, { borderColor: theme.border, width: 110 }]}>
                        <Text style={{ fontWeight: '800', fontSize: 14, color: (est.promedio_global || 0) >= 7 ? theme.success : theme.error }}>
                          {(est.promedio_global || 0).toFixed(2)}
                        </Text>
                      </View>
                    ) : (
                      <>
                        {groupedTasks.map((group, i) => (
                          <React.Fragment key={i}>
                            {group.tasks.map(t => (
                              <View key={t.id_tarea} style={[styles.colTask, { borderColor: theme.border }]}>
                                {renderGrade(est.calificaciones[t.id_tarea], t.nota_maxima)}
                              </View>
                            ))}
                          </React.Fragment>
                        ))}
                        <View style={[styles.colGrade, { borderColor: theme.border, backgroundColor: theme.warning + '05' }]}>
                          {(() => {
                            const det = est.modulos_detalle?.find(d => d.nombre_modulo === moduloActivo);
                            const nota = det ? parseFloat(String(det.promedio_modulo_sobre_10)) : 0;
                            return renderBadge(nota, nota >= 7);
                          })()}
                        </View>
                      </>
                    )}
                  </View>
                ))}
                <View style={{ height: 60 }} />
              </ScrollView>
            </View>
          </ScrollView>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: Platform.OS === 'ios' ? 40 : 20,
    paddingBottom: 10,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20
  },
  headerContent: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  headerSubtitle: { fontSize: 12 },
  headerIcon: { padding: 6, borderRadius: 10 },
  backButton: { padding: 4 },

  content: { flex: 1, padding: 16 },
  filtersCard: { borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 2 },
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

  statsSummary: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, marginTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.05)' },
  statItem: { flexDirection: 'row', alignItems: 'center' },

  // TABLA
  tableScroll: { flex: 1, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, height: 50 }, // Altura fija header
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, height: 50 }, // Altura fija fila

  // Columnas
  colNameWrapper: { width: 140, height: '100%', position: 'relative', borderRightWidth: 1, zIndex: 10 },
  colNameContainer: { width: '100%', height: '100%', justifyContent: 'center' },
  stickyShadow: { position: 'absolute', right: -6, top: 0, bottom: 0, width: 6, zIndex: 5 },

  colModule: { width: 100, paddingHorizontal: 4, justifyContent: 'center', alignItems: 'center', borderRightWidth: 0.5, height: '100%' },
  colGrade: { width: 90, paddingHorizontal: 4, justifyContent: 'center', alignItems: 'center', borderRightWidth: 0.5, height: '100%' },
  colTask: { width: 130, paddingHorizontal: 2, justifyContent: 'center', alignItems: 'center', borderRightWidth: 0.5, paddingVertical: 8 },

  headText: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  badgeContainer: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1 }
});
