import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  RefreshControl,
  Alert,
  Dimensions,
  SafeAreaView,
  ScrollView,
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import CompactPicker from './components/CompactPicker';
import Pagination from './components/Pagination';
import { API_URL } from '../../../constants/config';
import { getToken, getDarkMode } from '../../../services/storage';
import { eventEmitter } from '../../../services/eventEmitter';

const { width } = Dimensions.get('window');

interface Auditoria {
  id_auditoria: number;
  tabla_afectada: string;
  operacion: 'INSERT' | 'UPDATE' | 'DELETE';
  descripcion: string;
  detalles: string | any;
  usuario: {
    id: number;
    nombre: string;
    apellido: string;
    username: string;
    email: string;
    cedula: string;
    rol: string;
  };
  fecha_operacion: string;
  ip_address: string | null;
  user_agent: string | null;
}

interface Stats {
  total: number;
  hoy: number;
  porTabla: { tabla: string; cantidad: number }[];
  porUsuario: { usuario_id: number; nombre: string; apellido: string; cantidad: number }[];
}

export default function AuditoriaScreen() {
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Datos
  const [auditorias, setAuditorias] = useState<Auditoria[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    hoy: 0,
    porTabla: [],
    porUsuario: [],
  });

  // Filtros
  const [filtros, setFiltros] = useState({
    busqueda: '',
    tabla: '',
    operacion: '',
    rol: '',
    fecha_inicio: '',
    fecha_fin: '',
  });

  // Paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const limite = 15;

  // Modal
  const [modalDetalle, setModalDetalle] = useState<Auditoria | null>(null);

  // Date Pickers
  const [showDatePickerInicio, setShowDatePickerInicio] = useState(false);
  const [showDatePickerFin, setShowDatePickerFin] = useState(false);

  const theme = darkMode ? {
    bg: '#0a0a0a',
    cardBg: '#141414',
    text: '#ffffff',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',
    border: '#27272a',
    primary: '#ef4444',
    inputBg: '#1a1a1a',
    success: '#10b981',
    danger: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
    purple: '#a855f7',
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
    danger: '#ef4444',
    warning: '#d97706',
    info: '#3b82f6',
    purple: '#a855f7',
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [paginaActual, filtros])
  );

  useEffect(() => {
    const themeHandler = (isDark: boolean) => setDarkMode(isDark);
    eventEmitter.on('themeChanged', themeHandler);
    getDarkMode().then(setDarkMode);
    return () => { eventEmitter.off('themeChanged', themeHandler); };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (!token) return;

      const params = new URLSearchParams({
        pagina: paginaActual.toString(),
        limite: limite.toString(),
      });

      if (filtros.busqueda) params.append('busqueda', filtros.busqueda);
      if (filtros.tabla) params.append('tabla', filtros.tabla);
      if (filtros.operacion) params.append('operacion', filtros.operacion);
      if (filtros.rol) params.append('rol', filtros.rol);
      if (filtros.fecha_inicio) params.append('fecha_inicio', filtros.fecha_inicio);
      if (filtros.fecha_fin) params.append('fecha_fin', filtros.fecha_fin);

      const response = await fetch(
        `${API_URL}/auditoria/historial-completo?${params}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Error al cargar el historial');
      }

      const data = await response.json();

      if (data.success) {
        setAuditorias(data.data.auditorias);
        setStats({
          total: data.data.total,
          hoy: data.data.hoy || 0,
          porTabla: data.data.porTabla || [],
          porUsuario: data.data.porUsuario || [],
        });
        setTotalPaginas(data.data.totalPaginas);
      }
    } catch (err: unknown) {
      console.error('Error al cargar auditorías:', err);
      Alert.alert('Error', 'No se pudo cargar el historial de auditoría');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatearFecha = (fecha: string) => {
    return new Date(fecha).toLocaleString('es-EC', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTablaIcon = (tabla: string) => {
    switch (tabla) {
      case 'usuarios': return 'people';
      case 'docentes': return 'school';
      case 'estudiantes': return 'happy';
      case 'cursos': return 'book';
      case 'matriculas': return 'card';
      case 'pagos': return 'cash';
      case 'asistencia': return 'calendar';
      case 'notas': return 'document-text';
      case 'configuracion': return 'settings';
      default: return 'cube';
    }
  };

  const cleanDescription = (text: string) => {
    if (!text) return '';
    return text.replace(' - Resultado: N/A', '').replace('Resultado: N/A', '');
  };

  const getOperacionBadge = (operacion: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      INSERT: {
        bg: darkMode ? 'rgba(34, 197, 94, 0.2)' : '#d1fae5',
        text: darkMode ? '#4ade80' : '#047857',
        label: 'CREACIÓN'
      },
      UPDATE: {
        bg: darkMode ? 'rgba(59, 130, 246, 0.2)' : '#dbeafe',
        text: darkMode ? '#60a5fa' : '#1d4ed8',
        label: 'MODIFICACIÓN'
      },
      DELETE: {
        bg: darkMode ? 'rgba(239, 68, 68, 0.25)' : '#fee2e2',
        text: darkMode ? '#f87171' : '#b91c1c',
        label: 'ELIMINACIÓN'
      },
    };
    return badges[operacion] || {
      bg: darkMode ? 'rgba(255, 255, 255, 0.1)' : '#f3f4f6',
      text: darkMode ? 'rgba(255, 255, 255, 0.7)' : '#6b7280',
      label: operacion
    };
  };

  const limpiarFiltros = () => {
    setFiltros({
      busqueda: '',
      tabla: '',
      operacion: '',
      rol: '',
      fecha_inicio: '',
      fecha_fin: '',
    });
    setPaginaActual(1);
  };

  const onDateChangeInicio = (event: any, selectedDate?: Date) => {
    setShowDatePickerInicio(Platform.OS === 'ios');
    if (selectedDate) {
      setFiltros({ ...filtros, fecha_inicio: selectedDate.toISOString().split('T')[0] });
      if (Platform.OS !== 'ios') setShowDatePickerInicio(false);
    } else {
      setShowDatePickerInicio(false);
    }
  };

  const onDateChangeFin = (event: any, selectedDate?: Date) => {
    setShowDatePickerFin(Platform.OS === 'ios');
    if (selectedDate) {
      setFiltros({ ...filtros, fecha_fin: selectedDate.toISOString().split('T')[0] });
      if (Platform.OS !== 'ios') setShowDatePickerFin(false);
    } else {
      setShowDatePickerFin(false);
    }
  };

  const renderStatCard = (
    title: string,
    value: string | number,
    icon: keyof typeof Ionicons.glyphMap,
    color: string
  ) => (
    <View style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
      <View style={[styles.statIconContainer, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <View style={{ alignItems: 'center' }}>
        <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
        <Text style={[styles.statLabel, { color: theme.textSecondary }]} numberOfLines={1}>{title}</Text>
      </View>
    </View>
  );

  const getLogColor = (level: string) => {
    switch (level) {
      case 'error': return '#ef4444';
      case 'warn': return '#f59e0b';
      default: return '#22c55e';
    }
  };

  const getRoleLabel = (rol: string) => {
    if (!rol) return '';
    const roles: Record<string, string> = {
      admin: 'Administrativo',
      administrativo: 'Administrativo',
      superadmin: 'Super Admin',
      docente: 'Docente',
      estudiante: 'Estudiante',
    };
    return roles[rol.toLowerCase()] || rol.charAt(0).toUpperCase() + rol.slice(1).toLowerCase();
  };

  const renderAuditoriaCard = ({ item }: { item: Auditoria }) => {
    const badge = getOperacionBadge(item.operacion);

    return (
      <TouchableOpacity
        style={[styles.auditoriaCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
        onPress={() => setModalDetalle(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
            <View style={[styles.statIconContainer, { backgroundColor: `${theme.primary}15`, width: 36, height: 36, borderRadius: 10, marginBottom: 0 }]}>
              <Ionicons name={getTablaIcon(item.tabla_afectada) as any} size={18} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.tablaText, { color: theme.text, marginBottom: 2 }]}>{item.tabla_afectada}</Text>
              <Text style={[styles.fechaText, { color: theme.textMuted }]}>
                {formatearFecha(item.fecha_operacion)}
              </Text>
            </View>
          </View>
          <View style={[styles.operacionBadge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.operacionText, { color: badge.text }]}>{badge.label}</Text>
          </View>
        </View>

        <Text style={[styles.descripcionText, { color: theme.textSecondary }]} numberOfLines={2}>
          {cleanDescription(item.descripcion)}
        </Text>

        <View style={[styles.cardFooter, { borderTopColor: theme.border }]}>
          <View style={styles.userRow}>
            <Ionicons name="person-circle-outline" size={16} color={theme.textMuted} />
            <Text style={[styles.userName, { color: theme.textMuted }]}>
              {item.usuario.nombre.split(' ')[0]} {item.usuario.apellido.split(' ')[0]}
            </Text>
            <Text style={[styles.userRol, { color: theme.textMuted }]}>
              • {getRoleLabel(item.usuario.rol)}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Text style={[styles.verMasText, { color: theme.primary, fontSize: 12 }]}>Detalles</Text>
            <Ionicons name="chevron-forward" size={12} color={theme.primary} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderDetallesModal = () => {
    if (!modalDetalle) return null;

    let detallesObj = modalDetalle.detalles;
    if (typeof detallesObj === 'string') {
      try {
        detallesObj = JSON.parse(detallesObj);
      } catch (e) {
        detallesObj = {};
      }
    }

    const camposIgnorados = ['id', 'id_curso', 'id_estudiante', 'id_docente', 'password', 'token'];
    const detallesFiltrados = Object.entries(detallesObj || {}).filter(([key]) => {
      if (camposIgnorados.includes(key)) return false;
      if (key.startsWith('id_')) return false;
      return true;
    });

    const formatearNombreCampo = (campo: string) => {
      return campo
        .replace(/_/g, ' ')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    };

    const formatearValor = (valor: any) => {
      if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
      if (typeof valor === 'number') return valor.toString();
      if (valor === null || valor === undefined) return 'N/A';
      if (typeof valor === 'string') {
        if (/^\d{4}-\d{2}-\d{2}/.test(valor)) {
          try {
            return new Date(valor).toLocaleDateString('es-EC', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });
          } catch {
            return valor;
          }
        }
        return valor.charAt(0).toUpperCase() + valor.slice(1);
      }
      return String(valor);
    };

    const badge = getOperacionBadge(modalDetalle.operacion);

    return (
      <Modal visible={true} animationType="slide" onRequestClose={() => setModalDetalle(null)}>
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.bg }]}>
          <View
            style={[
              styles.modalHeader,
              {
                backgroundColor: theme.cardBg,
                borderBottomColor: theme.border,
                borderBottomWidth: 1,
              }
            ]}
          >
            <View style={styles.modalHeaderContent}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Detalle de Auditoría</Text>
              <TouchableOpacity onPress={() => setModalDetalle(null)}>
                <Ionicons name="close-circle" size={32} color={theme.text} />
              </TouchableOpacity>
            </View>
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
              {/* Operación Badge */}
              <View style={[styles.operacionBadgeLarge, { backgroundColor: badge.bg }]}>
                <Text style={[styles.operacionTextLarge, { color: badge.text }]}>{badge.label}</Text>
              </View>

              {/* Información Principal */}
              <View style={[styles.infoSection, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Tabla Afectada:</Text>
                  <Text style={[styles.infoValue, { color: theme.text }]}>{modalDetalle.tabla_afectada}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Fecha:</Text>
                  <Text style={[styles.infoValue, { color: theme.text }]}>{formatearFecha(modalDetalle.fecha_operacion)}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Descripción:</Text>
                  <Text style={[styles.infoValue, { color: theme.text }]}>{cleanDescription(modalDetalle.descripcion)}</Text>
                </View>
              </View>

              {/* Usuario */}
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Usuario</Text>
              <View style={[styles.infoSection, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Nombre:</Text>
                  <Text style={[styles.infoValue, { color: theme.text }]}>
                    {modalDetalle.usuario.nombre} {modalDetalle.usuario.apellido}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Email:</Text>
                  <Text style={[styles.infoValue, { color: theme.text }]}>{modalDetalle.usuario.email.toLowerCase()}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Rol:</Text>
                  <Text style={[styles.infoValue, { color: theme.text }]}>{getRoleLabel(modalDetalle.usuario.rol)}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Cédula:</Text>
                  <Text style={[styles.infoValue, { color: theme.text }]}>{modalDetalle.usuario.cedula}</Text>
                </View>
              </View>

              {/* Detalles */}
              {detallesFiltrados.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Información Detallada</Text>
                  <View style={[styles.infoSection, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                    {detallesFiltrados.filter(([_, value]) => value !== null && value !== 'NULL' && value !== 'null').map(([key, value], index) => (
                      <View
                        key={key}
                        style={[
                          styles.infoRow,
                          index < detallesFiltrados.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border, paddingBottom: 12, marginBottom: 12 }
                        ]}
                      >
                        <Text style={[styles.infoLabel, { color: theme.textMuted }]}>{formatearNombreCampo(key)}:</Text>
                        <Text style={[styles.infoValue, { color: theme.text }]}>
                          {key.toLowerCase().includes('email') && typeof value === 'string'
                            ? value.toLowerCase()
                            : formatearValor(value)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              )}

              <View style={{ height: 40 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Standardized Header */}
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
        <Text style={[styles.headerTitle, { color: theme.text }]}>Historial de Auditoría</Text>
        <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Seguimiento completo de operaciones del sistema</Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsGrid}>
        {renderStatCard('Total', stats.total.toLocaleString(), 'shield-checkmark', theme.primary)}
        {renderStatCard('Hoy', stats.hoy.toLocaleString(), 'trending-up', theme.success)}
        {renderStatCard('Tablas', stats.porTabla.length, 'server', theme.info)}
        {renderStatCard('Usuarios', stats.porUsuario.length, 'people', theme.purple)}
      </View>

      {/* Filters - Compact */}
      <View style={styles.filtersSection}>
        <View style={styles.filtersHeader}>
          <Text style={[styles.filtersTitle, { color: theme.text }]}>Filtros</Text>
          <TouchableOpacity onPress={limpiarFiltros}>
            <Text style={[styles.clearButton, { color: theme.primary }]}>Limpiar</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.searchContainer, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
          <Ionicons name="search" size={18} color={theme.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Buscar..."
            placeholderTextColor={theme.textMuted}
            value={filtros.busqueda}
            onChangeText={(text) => { setFiltros({ ...filtros, busqueda: text }); setPaginaActual(1); }}
          />
        </View>

        <View style={styles.filtersRow}>
          <View style={{ flex: 1 }}>
            <CompactPicker
              items={[
                { label: 'Todas', value: '' },
                { label: 'Creación', value: 'INSERT' },
                { label: 'Modificación', value: 'UPDATE' },
                { label: 'Eliminación', value: 'DELETE' },
              ]}
              selectedValue={filtros.operacion}
              onValueChange={(val) => { setFiltros({ ...filtros, operacion: val }); setPaginaActual(1); }}
              theme={theme}
              placeholder="Operación"
            />
          </View>
          <View style={{ flex: 1 }}>
            <CompactPicker
              items={[
                { label: 'Todos', value: '' },
                { label: 'Superadmin', value: 'superadmin' },
                { label: 'Administrativo', value: 'administrativo' },
                { label: 'Docente', value: 'docente' },
                { label: 'Estudiante', value: 'estudiante' },
              ]}
              selectedValue={filtros.rol}
              onValueChange={(val) => { setFiltros({ ...filtros, rol: val }); setPaginaActual(1); }}
              theme={theme}
              placeholder="Rol"
            />
          </View>
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : auditorias.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={64} color={theme.textMuted} />
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>No se encontraron registros</Text>
        </View>
      ) : (
        <FlatList
          data={auditorias}
          renderItem={renderAuditoriaCard}
          keyExtractor={item => item.id_auditoria.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={theme.primary} />
          }
          ListFooterComponent={
            <Pagination
              currentPage={paginaActual}
              totalPages={totalPaginas}
              totalItems={stats.total}
              onPageChange={setPaginaActual}
              theme={theme}
              itemLabel="registros"
            />
          }
        />
      )}

      {/* Modal Detalle */}
      {renderDetallesModal()}
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
    marginTop: 20,
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

  // Filters - Compact
  filtersSection: { padding: 16, paddingTop: 16 },
  filtersHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  filtersTitle: { fontSize: 16, fontWeight: '700' },
  clearButton: { fontSize: 13, fontWeight: '600' },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, height: 42, gap: 6, marginBottom: 8
  },
  searchInput: { flex: 1, fontSize: 13 },
  filtersRow: { flexDirection: 'row', gap: 8 },
  filterLabel: { fontSize: 11, marginBottom: 4, fontWeight: '600' },

  // List
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { marginTop: 12, fontSize: 14 },
  listContent: { padding: 16, paddingTop: 0 },

  // Auditoria Card
  auditoriaCard: {
    borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  operacionBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  operacionText: { fontSize: 9, fontWeight: '700' },
  fechaText: { fontSize: 11 },
  tablaText: { fontSize: 14, fontWeight: '700' },
  descripcionText: { fontSize: 13, marginBottom: 16, lineHeight: 18 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  userName: { fontSize: 12, fontWeight: '500' },
  userRol: { fontSize: 12 },
  verMasText: { fontSize: 12, fontWeight: '600' },

  // Modal
  modalContainer: { flex: 1 },
  modalHeader: { paddingTop: 20, paddingBottom: 20, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.1)' },
  modalHeaderContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  modalContent: { padding: 20 },
  operacionBadgeLarge: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, alignSelf: 'flex-start', marginBottom: 20 },
  operacionTextLarge: { fontSize: 14, fontWeight: '700' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 20, marginBottom: 12 },
  infoSection: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 12 },
  infoRow: { marginBottom: 8 },
  infoLabel: { fontSize: 12, marginBottom: 4 },
  infoValue: { fontSize: 14, fontWeight: '600' },
});
