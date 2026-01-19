import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput, Alert, StyleSheet, RefreshControl, Platform, StatusBar, Dimensions, KeyboardAvoidingView } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { API_URL } from '../../../constants/config';
import { getToken, storage, getUserData } from '../../../services/storage';
import { eventEmitter } from '../../../services/eventEmitter';
import { useSocket } from '../../../hooks/useSocket';

const { width } = Dimensions.get('window');

interface CursoConPagos {
  id_matricula: number;
  codigo_matricula: string;
  curso_nombre: string;
  codigo_curso: string;
  tipo_curso_nombre: string;
  total_cuotas: number;
  cuotas_pendientes: number;
  cuotas_vencidas: number;
  proxima_fecha_vencimiento: string;
  monto_pendiente: number;
  monto_matricula: number;
  es_curso_promocional: boolean;
  id_promocion?: number;
  nombre_promocion?: string;
  meses_gratis?: number;
  fecha_inicio_cobro?: string;
  decision_estudiante?: 'pendiente' | 'continuar' | 'rechazar';
  fecha_decision?: string | null;
  estado_pago?: 'pendiente' | 'al-dia';
}

interface Cuota {
  id_pago: number;
  numero_cuota: number;
  monto: number;
  fecha_vencimiento: string;
  fecha_pago: string | null;
  numero_comprobante: string | null;
  estado: 'pendiente' | 'pagado' | 'verificado' | 'vencido';
  observaciones: string | null;
  curso_nombre: string;
  tipo_curso_nombre: string;
  modalidad_pago?: 'mensual' | 'clases';
  meses_duracion?: number;
  numero_clases?: number;
  precio_por_clase?: number;
}

interface ResumenPagos {
  total_cuotas: number;
  cuotas_pagadas: number;
  cuotas_pendientes: number;
  cuotas_vencidas: number;
  cuotas_verificadas: number;
  monto_total: number;
  monto_pagado: number;
  monto_pendiente: number;
}

export default function PagosMensuales() {
  const [darkMode, setDarkMode] = useState(false);
  const [cursosConPagos, setCursosConPagos] = useState<CursoConPagos[]>([]);
  const [cursosHistoricos, setCursosHistoricos] = useState<CursoConPagos[]>([]);
  const [resumenPagos, setResumenPagos] = useState<ResumenPagos | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cursoExpandido, setCursoExpandido] = useState<number | null>(null);
  const [cuotasPorCurso, setCuotasPorCurso] = useState<{ [key: number]: Cuota[] }>({});
  const [loadingCuotas, setLoadingCuotas] = useState<{ [key: number]: boolean }>({});
  const [showPagoModal, setShowPagoModal] = useState(false);
  const [selectedCuota, setSelectedCuota] = useState<Cuota | null>(null);
  const [selectedCurso, setSelectedCurso] = useState<CursoConPagos | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [tooltipsVisible, setTooltipsVisible] = useState<{ [key: number]: boolean }>({});

  useEffect(() => {
    const loadDarkMode = async () => {
      const savedMode = await storage.getItem('dark_mode');
      if (savedMode !== null) {
        setDarkMode(savedMode === 'true');
      }
    };

    const loadUserData = async () => {
      const user = await getUserData();
      setUserData(user);
    };

    const loadHistorico = async () => {
      try {
        const stored = await storage.getItem('pagos-cursos-historicos');
        if (stored) {
          setCursosHistoricos(JSON.parse(stored));
        }
      } catch (error) {
        console.warn('Error loading historico:', error);
      }
    };

    loadDarkMode();
    loadUserData();
    loadHistorico();
    fetchData();

    eventEmitter.on('themeChanged', (isDark: boolean) => {
      setDarkMode(isDark);
    });
  }, []);

  const theme = darkMode
    ? {
      bg: '#0a0a0a',
      cardBg: '#141414',
      text: '#ffffff',
      textSecondary: '#a1a1aa',
      textMuted: '#71717a',
      border: '#27272a',
      accent: '#f59e0b',
      accentGradient: ['#f59e0b', '#d97706'] as const,
      success: '#10b981',
      danger: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6',
      inputBg: '#1e1e1e',
    }
    : {
      bg: '#f8fafc',
      cardBg: '#ffffff',
      text: '#0f172a',
      textSecondary: '#475569',
      textMuted: '#64748b',
      border: '#e2e8f0',
      accent: '#f59e0b',
      accentGradient: ['#fbbf24', '#f59e0b'] as const,
      success: '#059669',
      danger: '#dc2626',
      warning: '#d97706',
      info: '#2563eb',
      inputBg: '#f8fafc',
    };

  const socketEvents = {
    'pago_verificado_estudiante': (data: any) => {
      console.log('Pago verificado:', data.numero_cuota);
      fetchData();
    },
    'pago_rechazado': (data: any) => {
      console.log('Pago rechazado:', data.numero_cuota);
      fetchData();
    }
  };

  useSocket(socketEvents, userData?.id_usuario);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = await getToken();

      const resCursos = await fetch(`${API_URL}/pagos-mensuales/cursos-pendientes`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (resCursos.ok) {
        const cursos = await resCursos.json();
        setCursosConPagos(cursos);
        actualizarHistorialCursos(cursos);

        // Limpiar cache de matrículas inválidas (Paridad Web)
        const matriculasValidas = new Set(cursos.map((c: CursoConPagos) => c.id_matricula));
        setCursosHistoricos(prev => {
          // Filtrar cursos que sean válidos o que ya estén pagados (al día)
          // Esto replica la lógica exacta de la web para eliminar cursos "fantasma" del historial
          const filtrados = prev.filter(curso => matriculasValidas.has(curso.id_matricula) || curso.estado_pago === 'al-dia');

          if (filtrados.length !== prev.length) {
            storage.setItem('pagos-cursos-historicos', JSON.stringify(filtrados)).catch(e => console.warn(e));
          }
          return filtrados;
        });
      }

      const resResumen = await fetch(`${API_URL}/pagos-mensuales/resumen`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (resResumen.ok) {
        const resumen = await resResumen.json();
        setResumenPagos(resumen);
      }

    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'Error al cargar datos de pagos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadCuotasMatricula = async (id_matricula: number) => {
    try {
      setLoadingCuotas(prev => ({ ...prev, [id_matricula]: true }));
      const token = await getToken();

      const response = await fetch(`${API_URL}/pagos-mensuales/cuotas/${id_matricula}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const cuotas = await response.json();
        setCuotasPorCurso(prev => ({ ...prev, [id_matricula]: cuotas }));
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoadingCuotas(prev => ({ ...prev, [id_matricula]: false }));
    }
  };

  const handleToggleCuotas = async (curso: CursoConPagos) => {
    if (cursoExpandido === curso.id_matricula) {
      setCursoExpandido(null);
    } else {
      setCursoExpandido(curso.id_matricula);
      if (!cuotasPorCurso[curso.id_matricula]) {
        await loadCuotasMatricula(curso.id_matricula);
      }
    }
  };

  // Validar si una cuota puede ser pagada (todas las anteriores deben estar verificadas)
  const puedePagarCuota = (cuota: Cuota, todasLasCuotas: Cuota[]) => {
    // Si es la cuota #1, siempre se puede pagar
    if (cuota.numero_cuota === 1) {
      return { puede: true, mensaje: '' };
    }

    // Verificar que todas las cuotas anteriores estén verificadas
    const cuotasAnteriores = todasLasCuotas.filter(c => c.numero_cuota < cuota.numero_cuota);
    const cuotasNoVerificadas = cuotasAnteriores.filter(c => c.estado !== 'verificado');

    if (cuotasNoVerificadas.length > 0) {
      const numerosNoVerificados = cuotasNoVerificadas.map(c => `#${c.numero_cuota}`).join(', ');
      return {
        puede: false,
        mensaje: `Debes pagar y verificar ${cuotasNoVerificadas.length === 1 ? 'la cuota' : 'las cuotas'} ${numerosNoVerificados} antes de pagar esta cuota`
      };
    }

    return { puede: true, mensaje: '' };
  };

  const handlePagarCuota = (cuota: Cuota, curso: CursoConPagos) => {
    setSelectedCuota(cuota);
    setSelectedCurso(curso);
    setShowPagoModal(true);
  };

  const handleDecisionPromocion = async (curso: CursoConPagos, decision: 'continuar' | 'rechazar') => {
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/pagos-mensuales/cursos-promocionales/${curso.id_matricula}/decision`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ decision })
      });

      const data = await response.json();
      if (response.ok) {
        setCursosConPagos(prev => prev.map(item =>
          item.id_matricula === curso.id_matricula
            ? { ...item, decision_estudiante: data.decision, fecha_decision: data.fecha_decision }
            : item
        ));
        const mensaje = decision === 'continuar'
          ? 'Deberás pagar las mensualidades cuando termine tu beneficio'
          : 'El curso se detendrá cuando finalice el período gratuito';
        Alert.alert('Éxito', mensaje);
      } else {
        Alert.alert('Error', data.error || 'No se pudo registrar tu decisión');
      }
    } catch (error) {
      Alert.alert('Error', 'Error al guardar tu decisión');
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const formatearMonto = (monto: any) => {
    const numero = parseFloat(monto);
    if (isNaN(numero)) return '0.00';
    return numero.toFixed(2);
  };

  const formatearFecha = (fechaString: string) => {
    const fecha = new Date(fechaString);
    return fecha.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const getEstadoColor = (estado: string) => {
    switch (estado) {
      case 'pagado': return theme.success;
      case 'verificado': return theme.info;
      case 'vencido': return theme.danger;
      default: return theme.warning;
    }
  };

  const getEstadoTexto = (estado: string) => {
    switch (estado) {
      case 'pagado': return 'En Verificación';
      case 'verificado': return 'Verificado';
      case 'vencido': return 'Vencido';
      default: return 'Pendiente';
    }
  };

  const actualizarHistorialCursos = (cursosPendientes: CursoConPagos[]) => {
    setCursosHistoricos(prev => {
      const map = new Map<number, CursoConPagos>();
      prev.forEach(curso => map.set(curso.id_matricula, curso));
      cursosPendientes.forEach(curso => {
        map.set(curso.id_matricula, { ...curso, estado_pago: 'pendiente' });
      });
      map.forEach((curso, id) => {
        if (!cursosPendientes.some(c => c.id_matricula === id)) {
          map.set(id, {
            ...curso,
            estado_pago: 'al-dia',
            cuotas_pendientes: 0,
            cuotas_vencidas: 0,
            monto_pendiente: 0
          });
        }
      });
      const updated = Array.from(map.values());
      storage.setItem('pagos-cursos-historicos', JSON.stringify(updated)).catch(e => console.warn(e));
      return updated;
    });
  };

  const cursosAlDia = cursosHistoricos.filter(
    curso => curso.estado_pago === 'al-dia' && !cursosConPagos.some(c => c.id_matricula === curso.id_matricula)
  );

  const obtenerMontoTotalPagado = (curso: CursoConPagos) => {
    const cuotas = cuotasPorCurso[curso.id_matricula] || [];
    return cuotas.reduce((total, cuota) => total + (Number(cuota.monto) || 0), 0);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={darkMode ? 'light-content' : 'dark-content'} />

      {/* Premium Header */}
      <View style={[styles.headerContainer, { marginBottom: 0 }]}>
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
              <Text style={[styles.headerTitle, { color: theme.text }]}>Gestión de Pagos</Text>
              <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Tus finanzas al día</Text>
            </View>
            <View style={[styles.headerIconContainer, { backgroundColor: theme.accent + '15' }]}>
              <Ionicons name="card" size={24} color={theme.accent} />
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Horizontal Dashboard (Fintech Style) */}
        {resumenPagos && (
          <View style={{ flexDirection: 'row', paddingHorizontal: 10, gap: 6, marginBottom: 20, marginTop: 20 }}>
            <View style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <View style={[styles.statIconBadge, { backgroundColor: '#3b82f620' }]}>
                <Ionicons name="list" size={16} color="#3b82f6" />
              </View>
              <Text style={[styles.statValue, { color: theme.text }]}>{resumenPagos.total_cuotas}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Total{'\n'}Cuotas</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <View style={[styles.statIconBadge, { backgroundColor: '#10b98120' }]}>
                <Ionicons name="checkmark-done" size={16} color="#10b981" />
              </View>
              <Text style={[styles.statValue, { color: theme.text }]}>{resumenPagos.cuotas_verificadas}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Verificadas</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <View style={[styles.statIconBadge, { backgroundColor: '#f59e0b20' }]}>
                <Ionicons name="time" size={16} color="#f59e0b" />
              </View>
              <Text style={[styles.statValue, { color: theme.text }]}>{resumenPagos.cuotas_pendientes}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Pendientes</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <View style={[styles.statIconBadge, { backgroundColor: '#ef444420' }]}>
                <Ionicons name="alert-circle" size={16} color="#ef4444" />
              </View>
              <Text style={[styles.statValue, { color: theme.text }]}>${formatearMonto(resumenPagos.monto_pendiente)}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>Por Pagar</Text>
            </View>
          </View>
        )}

        {/* Cursos Pendientes Section */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>PENDIENTES DE PAGO</Text>
        </View>

        {loading ? (
          <View style={{ padding: 20, alignItems: 'center' }}><Text style={{ color: theme.textSecondary }}>Cargando información...</Text></View>
        ) : cursosConPagos.length === 0 ? (
          <View style={[styles.emptyStateCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <Ionicons name="shield-checkmark" size={48} color={theme.success} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>¡Todo al día!</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>No tienes deudas pendientes.</Text>
          </View>
        ) : (
          cursosConPagos
            .map((curso, index) => {
              const fechaInicioCobro = curso.fecha_inicio_cobro ? new Date(curso.fecha_inicio_cobro) : null;
              const decisionTomada = Boolean(curso.es_curso_promocional && curso.decision_estudiante && curso.decision_estudiante !== 'pendiente');

              return (
                <Animated.View
                  key={curso.id_matricula}
                  entering={FadeInDown.delay(index * 100).springify()}
                  style={[styles.courseCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
                >
                  {/* Course Header - Clean Nike */}
                  <View style={styles.courseHeaderGradient}>
                    <View style={styles.courseHeaderContent}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.courseTitle, { color: theme.text }]}>{curso.curso_nombre}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          <View style={{ backgroundColor: theme.accent + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                            <Text style={[styles.courseCode, { color: theme.accent }]}>{curso.codigo_curso}</Text>
                          </View>
                          {!!curso.es_curso_promocional && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.success + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                              <Ionicons name="gift" size={10} color={theme.success} />
                              <Text style={[styles.courseCode, { color: theme.success }]}>PROMOCIONAL</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleToggleCuotas(curso)}
                        style={[styles.expandButton, { backgroundColor: theme.accent + '15' }]}
                      >
                        <Ionicons name={cursoExpandido === curso.id_matricula ? 'chevron-up' : 'chevron-down'} size={20} color={theme.accent} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Course Body */}
                  <View style={styles.courseBody}>
                    <View style={styles.infoRow}>
                      <View style={styles.infoItem}>
                        <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Tipo</Text>
                        <Text style={[styles.infoValue, { color: theme.text }]}>{curso.tipo_curso_nombre}</Text>
                      </View>
                      <View style={styles.infoItem}>
                        <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Vencidas</Text>
                        <Text style={[styles.infoValue, { color: theme.danger, fontWeight: '700' }]}>{curso.cuotas_vencidas}</Text>
                      </View>
                      <View style={styles.infoItem}>
                        <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>Pendientes</Text>
                        <Text style={[styles.infoValue, { color: theme.warning, fontWeight: '700' }]}>{curso.cuotas_pendientes}</Text>
                      </View>
                    </View>

                    {/* Promocion Panel */}
                    {!!curso.es_curso_promocional && (
                      <View style={[styles.promoPanel, { backgroundColor: darkMode ? 'rgba(16, 185, 129, 0.1)' : '#ecfdf5', borderColor: theme.success }]}>
                        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                          <Ionicons name="gift-outline" size={16} color={theme.success} />
                          <Text style={[styles.promoTitle, { color: theme.success }]}>Beneficio Activo</Text>
                        </View>
                        <Text style={[styles.promoText, { color: theme.textSecondary }]}>
                          Tienes {curso.meses_gratis} meses GRATIS.
                          {fechaInicioCobro && ` Inicio de cobro: ${fechaInicioCobro.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`}
                        </Text>

                        {!decisionTomada && (
                          <View style={styles.decisionButtons}>
                            <TouchableOpacity
                              style={[styles.btnDecision, { backgroundColor: theme.success }]}
                              onPress={() => handleDecisionPromocion(curso, 'continuar')}
                            >
                              <Text style={styles.btnDecisionText}>Continuar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.btnDecision, { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.danger }]}
                              onPress={() => Alert.alert('Confirmar', '¿Seguro?', [{ text: 'Sí', onPress: () => handleDecisionPromocion(curso, 'rechazar') }, { text: 'No' }])}
                            >
                              <Text style={[styles.btnDecisionText, { color: theme.danger }]}>Rechazar</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    )}

                    {/* Expanded Quotas */}
                    {cursoExpandido === curso.id_matricula && (
                      <Animated.View entering={FadeInDown} style={styles.quotasContainer}>
                        <View style={[styles.divider, { backgroundColor: theme.border }]} />
                        <Text style={[styles.quotasTitle, { color: theme.textSecondary }]}>Selecciona una cuota para pagar:</Text>

                        {loadingCuotas[curso.id_matricula] ? (
                          <Text style={{ textAlign: 'center', margin: 20, color: theme.textSecondary }}>Cargando...</Text>
                        ) : (cuotasPorCurso[curso.id_matricula] || []).map((cuota) => {
                          const todasLasCuotas = cuotasPorCurso[curso.id_matricula] || [];
                          const validacion = puedePagarCuota(cuota, todasLasCuotas);
                          const puedeInteractuar = cuota.estado === 'pendiente' && validacion.puede;

                          return (
                            <TouchableOpacity
                              key={cuota.id_pago}
                              style={[
                                styles.quotaItem,
                                {
                                  backgroundColor: theme.bg,
                                  borderColor: !validacion.puede && cuota.estado === 'pendiente' ? '#9ca3af' : theme.border,
                                  opacity: !validacion.puede && cuota.estado === 'pendiente' ? 0.6 : 1
                                }
                              ]}
                              onPress={() => puedeInteractuar && handlePagarCuota(cuota, curso)}
                              onLongPress={() => {
                                if (!validacion.puede && cuota.estado === 'pendiente') {
                                  Alert.alert('Cuota Bloqueada', validacion.mensaje);
                                }
                              }}
                              disabled={!puedeInteractuar}
                            >
                              <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  <Text style={[styles.quotaName, { color: theme.text }]}>Cuota #{cuota.numero_cuota}</Text>
                                  {!validacion.puede && cuota.estado === 'pendiente' && (
                                    <Ionicons name="lock-closed" size={14} color="#9ca3af" />
                                  )}
                                </View>
                                <Text style={[styles.quotaDate, { color: theme.textSecondary }]}>Vence: {formatearFecha(cuota.fecha_vencimiento)}</Text>
                                {!validacion.puede && cuota.estado === 'pendiente' && (
                                  <Text style={[styles.quotaDate, { color: '#9ca3af', fontSize: 10, marginTop: 4 }]}>Mantén presionado para más info</Text>
                                )}
                              </View>
                              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                                <Text style={[styles.quotaAmount, { color: theme.text }]}>${formatearMonto(cuota.monto)}</Text>
                                <View style={[
                                  styles.statusBadge,
                                  {
                                    backgroundColor: !validacion.puede && cuota.estado === 'pendiente'
                                      ? '#9ca3af20'
                                      : getEstadoColor(cuota.estado) + '20'
                                  }
                                ]}>
                                  <Text style={[
                                    styles.statusText,
                                    {
                                      color: !validacion.puede && cuota.estado === 'pendiente'
                                        ? '#9ca3af'
                                        : getEstadoColor(cuota.estado)
                                    }
                                  ]}>
                                    {!validacion.puede && cuota.estado === 'pendiente' ? 'Bloqueado' : getEstadoTexto(cuota.estado)}
                                  </Text>
                                </View>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </Animated.View>
                    )}
                  </View>
                </Animated.View>
              );
            })
        )}

        {/* Cursos al Dia Section */}
        {cursosAlDia.length > 0 && (
          <View style={{ marginTop: 24 }}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>HISTORIAL COMPLETO</Text>
            </View>
            {cursosAlDia.map((curso) => (
              <View key={`hist-${curso.id_matricula}`} style={[styles.courseCard, { backgroundColor: theme.cardBg, borderColor: theme.border, opacity: 0.8 }]}>
                <View style={[styles.courseHeaderGradient, { backgroundColor: darkMode ? '#0f172a' : '#f1f5f9', paddingVertical: 12 }]}>
                  <View style={styles.courseHeaderContent}>
                    <Text style={[styles.courseTitle, { color: theme.textSecondary }]}>{curso.curso_nombre}</Text>
                    <Ionicons name="checkmark-circle" size={20} color={theme.success} />
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

      </ScrollView>

      {/* Payment Modal */}
      <ModalPago
        visible={showPagoModal}
        cuota={selectedCuota}
        curso={selectedCurso}
        onClose={() => { setShowPagoModal(false); setSelectedCuota(null); setSelectedCurso(null); }}
        onSuccess={() => { fetchData(); if (cursoExpandido) loadCuotasMatricula(cursoExpandido); }}
        darkMode={darkMode}
        theme={theme}
      />
    </View>
  );
}

// === Payment Modal Component ===
interface ModalPagoProps {
  visible: boolean;
  cuota: Cuota | null;
  curso: CursoConPagos | null;
  onClose: () => void;
  onSuccess: () => void;
  darkMode: boolean;
  theme: any;
}

function ModalPago({ visible, cuota, curso, onClose, onSuccess, darkMode, theme }: ModalPagoProps) {
  const [metodoPago, setMetodoPago] = useState<'transferencia' | 'efectivo'>('transferencia');
  const [montoPagar, setMontoPagar] = useState('');
  const [numeroComprobante, setNumeroComprobante] = useState('');
  const [bancoComprobante, setBancoComprobante] = useState('');
  const [recibidoPor, setRecibidoPor] = useState('');
  const [archivoComprobante, setArchivoComprobante] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const bancos = [
    'Banco Pichincha', 'Banco del Pacífico', 'Produbanco'
  ];

  const getFechaEcuador = () => {
    const now = new Date();
    const ecuadorOffset = -5 * 60;
    const localOffset = now.getTimezoneOffset();
    const ecuadorTime = new Date(now.getTime() + (localOffset + ecuadorOffset) * 60000);
    return ecuadorTime.toISOString().split('T')[0];
  };

  const montoPorClase = Number(cuota?.monto || 0);
  const pasoClases = !isNaN(montoPorClase) && montoPorClase > 0 ? montoPorClase : 0.01;

  useEffect(() => {
    if (cuota && visible) {
      setMontoPagar(cuota.monto.toString());
      setMetodoPago('transferencia');
      setNumeroComprobante('');
      setBancoComprobante('');
      setRecibidoPor('');
      setArchivoComprobante(null);
    }
  }, [cuota, visible]);

  if (!cuota) return null;

  const esMultiploDe = (valor: number, base: number) => {
    if (!base) return false;
    const ratio = valor / base;
    return Math.abs(ratio - Math.round(ratio)) < 0.0001;
  };

  const handleIncrement = () => {
    const actual = parseFloat(montoPagar) || 0;
    const paso = cuota.modalidad_pago === 'mensual' ? 90 : (cuota.modalidad_pago === 'clases' ? pasoClases : 0.01);
    let nuevo = actual + paso;

    // Calcular el máximo permitido
    let maximo = Infinity;

    // Límite por deuda restante del curso
    if (curso && curso.monto_pendiente) {
      maximo = Math.min(maximo, curso.monto_pendiente);
    }

    // Límite por meses restantes (solo para cursos mensuales)
    if (cuota.modalidad_pago === 'mensual') {
      const duracionCurso = cuota.meses_duracion || 12;
      const mesesRestantes = duracionCurso - cuota.numero_cuota + 1;
      const montoTotalCurso = 90 * mesesRestantes;
      maximo = Math.min(maximo, montoTotalCurso);
    }

    // No permitir exceder el máximo
    if (nuevo > maximo) {
      nuevo = maximo;
      // Mostrar mensaje cuando se alcanza el máximo
      Alert.alert(
        'Límite alcanzado',
        `El monto máximo es $${maximo.toFixed(2)}`,
        [{ text: 'Entendido' }]
      );
    }

    setMontoPagar(nuevo.toFixed(2));
  };

  const handleDecrement = () => {
    const actual = parseFloat(montoPagar) || 0;
    const paso = cuota.modalidad_pago === 'mensual' ? 90 : (cuota.modalidad_pago === 'clases' ? pasoClases : 0.01);
    const nuevo = Math.max(paso, actual - paso);
    setMontoPagar(nuevo.toFixed(2));
  };

  const handleFileSelect = () => {
    Alert.alert('Subir Comprobante', 'Elige una opción', [
      {
        text: '📷 Cámara', onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') return Alert.alert('Permiso denegado');
          const { assets } = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: false });
          if (assets?.[0]) setArchivoComprobante(assets[0]);
        }
      },
      {
        text: '🖼️ Galería', onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') return Alert.alert('Permiso denegado');
          const { assets } = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
          if (assets?.[0]) setArchivoComprobante(assets[0]);
        }
      },
      { text: 'Cancelar', style: 'cancel' }
    ]);
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const montoNumerico = parseFloat(montoPagar);

      // --- Validaciones (Web Parity) ---
      if (isNaN(montoNumerico) || montoNumerico <= 0) throw new Error('El monto debe ser mayor a 0');
      if (montoNumerico < cuota.monto) throw new Error(`El monto mínimo es $${cuota.monto.toFixed(2)}`);

      // Validación: No se puede pagar más que la deuda restante del curso
      if (curso && montoNumerico > curso.monto_pendiente) {
        throw new Error(`El monto excede la deuda restante ($${curso.monto_pendiente.toFixed(2)})`);
      }

      if (cuota.modalidad_pago === 'mensual') {
        const MONTO_BASE = 90;

        // Verificar que sea múltiplo de 90
        if (montoNumerico % MONTO_BASE !== 0) {
          const mesesPagados = Math.floor(montoNumerico / MONTO_BASE);
          const montoSugerido = mesesPagados * MONTO_BASE;
          const montoSiguiente = (mesesPagados + 1) * MONTO_BASE;

          throw new Error(
            `Para cursos mensuales solo se permiten múltiplos de $${MONTO_BASE}.\n` +
            `Puedes pagar: $${montoSugerido} (${mesesPagados} ${mesesPagados === 1 ? 'mes' : 'meses'}) ` +
            `o $${montoSiguiente} (${mesesPagados + 1} meses)`
          );
        }

        // Verificar que no sea menor a 90
        if (montoNumerico < MONTO_BASE) {
          throw new Error(`El monto mínimo para cursos mensuales es $${MONTO_BASE} (1 mes)`);
        }

        // Verificar que no exceda el monto total del curso
        // Calcular meses restantes desde la cuota actual
        const duracionCurso = cuota.meses_duracion || 12;
        const mesesRestantes = duracionCurso - cuota.numero_cuota + 1;
        const montoTotalCurso = MONTO_BASE * mesesRestantes;

        if (montoNumerico > montoTotalCurso) {
          throw new Error(
            `El monto máximo para este curso es $${montoTotalCurso} (${mesesRestantes} ${mesesRestantes === 1 ? 'mes restante' : 'meses restantes'}).\n` +
            `Estás en la cuota ${cuota.numero_cuota} de ${duracionCurso}.`
          );
        }
      } else if (cuota.modalidad_pago === 'clases') {
        if (!esMultiploDe(montoNumerico, montoPorClase)) throw new Error(`Solo múltiplos de $${montoPorClase.toFixed(2)}`);
      }

      if (metodoPago === 'transferencia') {
        if (!numeroComprobante) throw new Error('Falta el número de comprobante');
        if (!bancoComprobante) throw new Error('Selecciona el banco');
      } else {
        // Efectivo
        if (!numeroComprobante) throw new Error('Falta el número de factura');
        if (!recibidoPor) throw new Error('Indica quién recibió el pago');
      }

      if (!archivoComprobante) throw new Error('Debes subir la evidencia (foto/pdf)');

      const formData = new FormData();
      formData.append('metodo_pago', metodoPago);
      formData.append('monto_pagado', montoNumerico.toFixed(2));
      formData.append('numero_comprobante', numeroComprobante);

      if (metodoPago === 'transferencia') {
        formData.append('banco_comprobante', bancoComprobante);
        formData.append('fecha_transferencia', getFechaEcuador());
      } else {
        formData.append('banco_comprobante', 'N/A');
        formData.append('fecha_transferencia', getFechaEcuador());
        formData.append('recibido_por', recibidoPor);
      }

      const file: any = {
        uri: archivoComprobante.uri,
        type: archivoComprobante.mimeType || 'image/jpeg',
        name: archivoComprobante.fileName || `comprobante_${Date.now()}.jpg`,
      };
      formData.append('comprobante', file);

      const token = await getToken();
      const res = await fetch(`${API_URL}/pagos-mensuales/pagar/${cuota.id_pago}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al procesar pago');

      Alert.alert('¡Pago Enviado!', 'Tu pago ha sido registrado y está en proceso de verificación.');
      onSuccess();
      onClose();
    } catch (e: any) {
      Alert.alert('Atención', e.message || 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
      >
        <View style={[styles.modalContent, { backgroundColor: theme.cardBg }]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ backgroundColor: theme.accent, padding: 8, borderRadius: 8 }}>
                <Ionicons name="card" size={20} color="#fff" />
              </View>
              <View>
                <Text style={[styles.modalTitle, { color: theme.text, fontSize: 18 }]}>Registrar Pago</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{cuota.curso_nombre}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={theme.textSecondary} /></TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>

            {/* Amount Control */}
            <View style={[styles.modalInfoBox, { flexDirection: 'column', gap: 10, alignItems: 'stretch' }]}>
              <Text style={{ color: theme.textSecondary, fontSize: 12, textAlign: 'center', fontWeight: '700', textTransform: 'uppercase' }}>Monto a Pagar</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <TouchableOpacity onPress={handleDecrement} style={[styles.stepBtn, { borderColor: theme.success }]}>
                  <Text style={{ fontSize: 24, color: theme.success, lineHeight: 24 }}>-</Text>
                </TouchableOpacity>
                <Text style={{ color: theme.text, fontSize: 26, fontWeight: '800' }}>${parseFloat(montoPagar || '0').toFixed(2)}</Text>
                <TouchableOpacity onPress={handleIncrement} style={[styles.stepBtn, { backgroundColor: 'rgba(16,185,129,0.1)', borderColor: theme.success }]}>
                  <Text style={{ fontSize: 24, color: theme.success, lineHeight: 24 }}>+</Text>
                </TouchableOpacity>
              </View>
              <Text style={{ textAlign: 'center', fontSize: 10, color: theme.textMuted }}>
                {cuota.modalidad_pago === 'mensual' ? 'Múltiplos de $90.00' : `Múltiplos de $${montoPorClase.toFixed(2)}`}
              </Text>
            </View>

            {/* Method Selector */}
            <Text style={[styles.label, { color: theme.textSecondary }]}>Método de Pago</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
              <TouchableOpacity
                onPress={() => setMetodoPago('transferencia')}
                style={[styles.methodBtn, metodoPago === 'transferencia' ? { backgroundColor: theme.success, borderColor: theme.success } : { borderColor: theme.border, backgroundColor: theme.inputBg }]}
              >
                <Ionicons name="business" size={18} color={metodoPago === 'transferencia' ? '#fff' : theme.textSecondary} />
                <Text style={[styles.methodText, { color: metodoPago === 'transferencia' ? '#fff' : theme.textSecondary }]}>Transferencia</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setMetodoPago('efectivo')}
                style={[styles.methodBtn, metodoPago === 'efectivo' ? { backgroundColor: theme.success, borderColor: theme.success } : { borderColor: theme.border, backgroundColor: theme.inputBg }]}
              >
                <Ionicons name="cash" size={18} color={metodoPago === 'efectivo' ? '#fff' : theme.textSecondary} />
                <Text style={[styles.methodText, { color: metodoPago === 'efectivo' ? '#fff' : theme.textSecondary }]}>Efectivo / Factura</Text>
              </TouchableOpacity>
            </View>

            {/* Dynamic Fields */}
            {metodoPago === 'transferencia' ? (
              <>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Banco de Origen</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 15, maxHeight: 40 }}>
                  {bancos.map(b => (
                    <TouchableOpacity
                      key={b}
                      onPress={() => setBancoComprobante(b)}
                      style={[styles.bankChip, bancoComprobante === b ? { backgroundColor: theme.info, borderColor: theme.info } : { borderColor: theme.border }]}
                    >
                      <Text style={{ color: bancoComprobante === b ? '#fff' : theme.textSecondary, fontSize: 12, fontWeight: '600' }}>{b}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={[styles.label, { color: theme.textSecondary }]}>Número de Comprobante</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                  placeholder="Ej: 09123456"
                  placeholderTextColor={theme.textMuted}
                  value={numeroComprobante}
                  onChangeText={(t) => /^\d*$/.test(t) && setNumeroComprobante(t)}
                  keyboardType="numeric"
                />
              </>
            ) : (
              <>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Número de Factura</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                  placeholder="Ej: 001-001-123456789"
                  placeholderTextColor={theme.textMuted}
                  value={numeroComprobante}
                  onChangeText={setNumeroComprobante}
                />

                <Text style={[styles.label, { color: theme.textSecondary }]}>Recibido Por (Nombre Personal)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                  placeholder="¿Quién recibió el dinero?"
                  placeholderTextColor={theme.textMuted}
                  value={recibidoPor}
                  onChangeText={setRecibidoPor}
                />
              </>
            )}

            <Text style={[styles.label, { color: theme.textSecondary, marginTop: 10 }]}>Evidencia del Pago</Text>
            <TouchableOpacity
              style={[styles.cameraButton, { borderColor: theme.border, backgroundColor: theme.inputBg }]}
              onPress={handleFileSelect}
            >
              {archivoComprobante ? (
                <View style={{ alignItems: 'center', gap: 5 }}>
                  <Ionicons name="checkmark-circle" size={36} color={theme.success} />
                  <Text style={{ color: theme.success, fontWeight: '700' }}>Archivo Cargado</Text>
                  <Text style={{ color: theme.textSecondary, fontSize: 10 }}>{archivoComprobante.fileName?.substring(0, 20)}...</Text>
                </View>
              ) : (
                <View style={{ alignItems: 'center', gap: 5 }}>
                  <Ionicons name="cloud-upload-outline" size={32} color={theme.textMuted} />
                  <Text style={{ color: theme.textMuted, fontWeight: '600' }}>Subir Foto o Captura</Text>
                </View>
              )}
            </TouchableOpacity>
          </ScrollView>

          <TouchableOpacity
            style={[styles.payButton, { backgroundColor: loading ? theme.textMuted : theme.success }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <Text style={styles.payButtonText}>Procesando...</Text>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="paper-plane" size={18} color="#fff" />
                <Text style={styles.payButtonText}>Confirmar Pago</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerContainer: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    marginBottom: 0,
    zIndex: 10
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 40 : 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  headerIconContainer: {
    width: 45,
    height: 45,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: { paddingBottom: 40 },

  dashboardContainer: {
    paddingVertical: 20,
    paddingLeft: 16,
  },
  statsCardWrapper: {
    marginRight: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  statsCard: {
    width: 140,
    height: 100,
    borderRadius: 16,
    padding: 16,
    justifyContent: 'space-between',
  },
  statsIconBg: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    padding: 6,
  },
  statsValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  statsLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '600',
  },

  // Estilos para tarjetas compactas 
  statCard: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '600',
    marginBottom: 2,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 12,
    fontWeight: '800',
  },

  sectionHeader: { paddingHorizontal: 20, marginTop: 10, marginBottom: 10 },
  sectionTitle: { fontSize: 13, fontWeight: '700', letterSpacing: 1 },

  emptyStateCard: {
    margin: 20,
    padding: 40,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 16 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', marginTop: 8 },

  courseCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  courseHeaderGradient: {
    padding: 16,
  },
  courseHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  courseTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  courseCode: {
    fontSize: 11,
    fontWeight: '700',
  },
  expandButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  courseBody: {
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoItem: { alignItems: 'center' },
  infoLabel: { fontSize: 11, marginBottom: 2 },
  infoValue: { fontSize: 14, fontWeight: '600' },

  promoPanel: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  promoTitle: { fontWeight: '700', fontSize: 13 },
  promoText: { fontSize: 12, marginBottom: 12, lineHeight: 18 },
  decisionButtons: { flexDirection: 'row', gap: 10 },
  btnDecision: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDecisionText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  quotasContainer: { marginTop: 8 },
  divider: { height: 1, width: '100%', marginBottom: 12 },
  quotasTitle: { fontSize: 12, marginBottom: 8 },
  quotaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  quotaName: { fontWeight: '700', fontSize: 13 },
  quotaDate: { fontSize: 11, marginTop: 2 },
  quotaAmount: { fontWeight: '700', fontSize: 14 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '700' },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  modalInfoBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(120,120,120,0.1)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 16 },
  input: {
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    borderWidth: 1,
  },
  cameraButton: {
    height: 100,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  payButton: {
    marginTop: 24,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  payButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  stepBtn: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 2, alignItems: 'center', justifyContent: 'center'
  },
  methodBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1
  },
  methodText: { fontWeight: '700', fontSize: 12 },
  bankChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
