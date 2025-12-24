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
  Dimensions
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { API_URL } from '../../../constants/config';
import { getToken, getDarkMode } from '../../../services/storage';
import Animated, { FadeInDown } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

// --- TEMA ---
const getTheme = (isDark: boolean) => ({
  primary: '#2563eb',
  secondary: '#3b82f6',
  background: isDark ? '#000000' : '#f8fafc',
  cardBg: isDark ? '#1a1a1a' : '#ffffff',
  text: isDark ? '#ffffff' : '#1e293b',
  textMuted: isDark ? 'rgba(255,255,255,0.6)' : '#64748b',
  border: isDark ? 'rgba(59, 130, 246, 0.2)' : '#e2e8f0',
  success: '#10b981',
  error: '#ef4444',
  warning: '#f59e0b',
  primaryGradient: ['#3b82f6', '#2563eb'] as const,
  tableHeaderBg: isDark ? '#1e3a8a' : '#eff6ff',
  categoryHeaderBg: isDark ? 'rgba(255,255,255,0.08)' : '#f1f5f9',
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
const CompactPicker = ({ items, selectedValue, onValueChange, placeholder, theme }: any) => {
  const [showModal, setShowModal] = useState(false);
  if (Platform.OS === 'android') {
    return (
      <View style={[styles.pickerContainer, { borderColor: theme.border, backgroundColor: theme.cardBg }]}>
        <Picker selectedValue={selectedValue} onValueChange={onValueChange} style={[styles.picker, { color: theme.text }]} dropdownIconColor={theme.text}>
          {items.map((item: any) => <Picker.Item key={item.value} label={item.label} value={item.value} style={{ fontSize: 13, color: '#000' }} />)}
        </Picker>
      </View>
    );
  }
  const selectedLabel = items.find((i: any) => i.value === selectedValue)?.label || placeholder || items[0]?.label;
  return (
    <>
      <TouchableOpacity onPress={() => setShowModal(true)} style={[styles.pickerContainer, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, borderColor: theme.border, backgroundColor: theme.cardBg }]}>
        <Text style={{ color: theme.text, fontSize: 12, fontWeight: '500' }} numberOfLines={1}>{selectedLabel}</Text>
        <Ionicons name="chevron-down" size={16} color={theme.textMuted} />
      </TouchableOpacity>
      <Modal animationType="slide" transparent={true} visible={showModal} onRequestClose={() => setShowModal(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{ backgroundColor: theme.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 34 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: theme.border }}>
              <TouchableOpacity onPress={() => setShowModal(false)}><Text style={{ color: theme.textMuted, fontSize: 16 }}>Cancelar</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setShowModal(false)}><Text style={{ color: theme.primary, fontWeight: '700', fontSize: 16 }}>Confirmar</Text></TouchableOpacity>
            </View>
            <Picker selectedValue={selectedValue} onValueChange={onValueChange} style={{ height: 216 }} itemStyle={{ color: theme.text, fontSize: 18 }}>
              {items.map((item: any) => <Picker.Item key={item.value} label={item.label} value={item.value} />)}
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
  const [darkMode, setDarkMode] = useState(false);
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

  useEffect(() => { loadData(); }, [id_curso]);

  const loadData = async () => {
    try {
      setLoading(true);
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
      setLoading(false);
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
    const sorted = [...tareasVisibles].sort((a, b) => {
      const catA = a.categoria_nombre || 'Sin Categoría';
      const catB = b.categoria_nombre || 'Sin Categoría';
      if (catA === catB) return a.id_tarea - b.id_tarea;
      return catA.localeCompare(catB);
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
        <LinearGradient colors={theme.primaryGradient} style={styles.header}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}><Ionicons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.headerTitle} numberOfLines={1}>Calificaciones</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>{cursoNombre}</Text>
            </View>
            <View style={styles.headerIcon}>
              <Ionicons name="school-outline" size={22} color="#fff" />
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      {loading ? <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} /> : (
        <View style={styles.content}>
          {/* Filtros */}
          <View style={[styles.filtersCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
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
              <View style={{ width: 130 }}>
                <Text style={[styles.label, { color: theme.textMuted }]}>Estado</Text>
                <CompactPicker
                  items={[{ label: "Todos", value: "todos" }, { label: "Aprobados", value: "aprobados" }, { label: "Reprobados", value: "reprobados" }]}
                  selectedValue={filtroEstado} onValueChange={setFiltroEstado} theme={theme}
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
                    <Text style={[styles.headText, { color: theme.primary, textAlign: 'left', paddingLeft: 12 }]}>Estudiante</Text>
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
                        <Text style={[styles.headText, { color: theme.text }]} numberOfLines={2}>{m}</Text>
                      </View>
                    ))}
                    <View style={[styles.colGrade, { borderColor: theme.border }]}>
                      <Text style={[styles.headText, { color: theme.primary, fontWeight: '800' }]}>Global</Text>
                    </View>
                  </>
                ) : moduloActivo === 'resumen_global' ? (
                  <View style={[styles.colGrade, { borderColor: theme.border, width: 110 }]}>
                    <Text style={[styles.headText, { color: theme.primary, fontWeight: '800', fontSize: 11 }]}>Global</Text>
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
                            {group.category} <Text style={{ fontWeight: '400', fontSize: 9 }}>({group.weight}%)</Text>
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
                      <Text style={[styles.headText, { color: theme.warning, fontWeight: '800' }]}>Promedio {moduloActivo}</Text>
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
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={{ alignItems: 'center', paddingLeft: 12, paddingRight: 8 }}
                        >
                          <Text style={{ fontSize: 13, fontWeight: '600', color: theme.text }}>
                            {est.apellido}, {est.nombre}
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
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: Platform.OS === 'ios' ? 60 : 50, paddingBottom: 20, paddingHorizontal: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerContent: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  headerIcon: { backgroundColor: 'rgba(255,255,255,0.2)', padding: 8, borderRadius: 12 },
  backButton: { padding: 4 },

  content: { flex: 1, padding: 16 },
  filtersCard: { borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 2 },
  label: { fontSize: 11, fontWeight: '600', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  pickerContainer: { borderRadius: 10, borderWidth: 1, height: 42, justifyContent: 'center' },
  picker: { height: 42, width: '100%' },

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
