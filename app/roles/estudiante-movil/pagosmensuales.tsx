
import { View, Text, ScrollView, TouchableOpacity, Modal, TextInput, Alert, StyleSheet, RefreshControl, Platform } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { API_URL } from '../../../constants/config';
import { getToken, storage, getUserData } from '../../../services/storage';
import { eventEmitter } from '../../../services/eventEmitter';
import { useSocket } from '../../../hooks/useSocket';

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
  const [userData, setUserData] = useState<any>(null);

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
    
    loadDarkMode();
    loadUserData();
    fetchData();
    
    eventEmitter.on('themeChanged', (isDark: boolean) => {
      setDarkMode(isDark);
    });
  }, []);

  // Configurar eventos de WebSocket para actualizaciones en tiempo real
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

      // Cargar cursos con pagos pendientes
      const resCursos = await fetch(`${API_URL}/pagos-mensuales/cursos-pendientes`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (resCursos.ok) {
        const cursos = await resCursos.json();
        setCursosConPagos(cursos);
        
        // Actualizar historial de cursos
        actualizarHistorialCursos(cursos);
      }

      // Cargar resumen de pagos
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

  const handlePagarCuota = (cuota: Cuota) => {
    setSelectedCuota(cuota);
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
      case 'pagado': return '#10b981';
      case 'verificado': return '#3b82f6';
      case 'vencido': return '#ef4444';
      default: return '#f59e0b';
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
      return Array.from(map.values());
    });
  };

  const cursosAlDia = cursosHistoricos.filter(
    curso => curso.estado_pago === 'al-dia' && !cursosConPagos.some(c => c.id_matricula === curso.id_matricula)
  );

  const obtenerMontoTotalPagado = (curso: CursoConPagos) => {
    const cuotas = cuotasPorCurso[curso.id_matricula] || [];
    return cuotas.reduce((total, cuota) => total + (Number(cuota.monto) || 0), 0);
  };

  const colors = {
    background: darkMode ? '#000000' : '#f8fafc',
    card: darkMode ? '#1a1a1a' : '#ffffff',
    text: darkMode ? '#ffffff' : '#1e293b',
    textSecondary: darkMode ? 'rgba(255,255,255,0.7)' : 'rgba(30,41,59,0.7)',
    textMuted: darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(30,41,59,0.5)',
    border: darkMode ? 'rgba(251, 191, 36, 0.2)' : 'rgba(251, 191, 36, 0.3)',
    accent: '#fbbf24',
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Gestión de Pagos</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Gestiona las mensualidades de tus cursos
          </Text>
        </View>

        {/* Resumen */}
        {resumenPagos && (
          <View style={styles.resumenContainer}>
            <View style={[styles.resumenCard, { backgroundColor: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.3)' }]}>
              <Text style={[styles.resumenValue, { color: '#3b82f6' }]}>{resumenPagos.total_cuotas}</Text>
              <Text style={[styles.resumenLabel, { color: colors.textSecondary }]}>Total</Text>
            </View>
            <View style={[styles.resumenCard, { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)' }]}>
              <Text style={[styles.resumenValue, { color: '#10b981' }]}>{resumenPagos.cuotas_verificadas}</Text>
              <Text style={[styles.resumenLabel, { color: colors.textSecondary }]}>Verificadas</Text>
            </View>
            <View style={[styles.resumenCard, { backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.3)' }]}>
              <Text style={[styles.resumenValue, { color: '#f59e0b' }]}>{resumenPagos.cuotas_pendientes}</Text>
              <Text style={[styles.resumenLabel, { color: colors.textSecondary }]}>Pendientes</Text>
            </View>
            <View style={[styles.resumenCard, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
              <Text style={[styles.resumenValue, { color: '#ef4444' }]}>${formatearMonto(resumenPagos.monto_pendiente)}</Text>
              <Text style={[styles.resumenLabel, { color: colors.textSecondary }]}>Monto</Text>
            </View>
          </View>
        )}

        {/* Cursos con pagos pendientes */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Cursos con Pagos Pendientes</Text>

          {loading ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Cargando...</Text>
            </View>
          ) : cursosConPagos.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="checkmark-circle" size={40} color="#10b981" />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>¡Excelente!</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No tienes pagos pendientes
              </Text>
            </View>
          ) : (
            cursosConPagos.map((curso) => {
              const fechaInicioCobro = curso.fecha_inicio_cobro ? new Date(curso.fecha_inicio_cobro) : null;
              const promocionTerminada = Boolean(fechaInicioCobro && fechaInicioCobro.getTime() <= Date.now());
              const decisionTomada = Boolean(curso.es_curso_promocional && curso.decision_estudiante && curso.decision_estudiante !== 'pendiente');

              return (
                <View key={curso.id_matricula} style={[styles.cursoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.cursoHeader}>
                    <View style={styles.cursoInfo}>
                      <Text style={[styles.cursoNombre, { color: colors.text }]} numberOfLines={2}>
                        {curso.curso_nombre}
                      </Text>
                      {!!curso.es_curso_promocional && (
                        <View style={styles.promocionalBadge}>
                          <Ionicons name="gift" size={10} color="#fff" />
                          <Text style={styles.promocionalText}>PROMOCIONAL</Text>
                        </View>
                      )}
                      <Text style={[styles.cursoTipo, { color: colors.textSecondary }]}>
                        {curso.tipo_curso_nombre}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.verCuotasButton, { backgroundColor: cursoExpandido === curso.id_matricula ? '#ef4444' : colors.accent }]}
                      onPress={() => handleToggleCuotas(curso)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name={cursoExpandido === curso.id_matricula ? 'close' : 'eye'} size={14} color="#fff" />
                      <Text style={styles.verCuotasText}>
                        {cursoExpandido === curso.id_matricula ? 'Ocultar' : 'Ver'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Estadísticas */}
                  <View style={styles.statsContainer}>
                    <View style={[styles.statBox, { backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.3)' }]}>
                      <Ionicons name="time" size={10} color="#f59e0b" />
                      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Pendientes</Text>
                      <Text style={[styles.statValue, { color: '#f59e0b' }]}>{curso.cuotas_pendientes}</Text>
                    </View>
                    <View style={[styles.statBox, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
                      <Ionicons name="alert-circle" size={10} color="#ef4444" />
                      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Vencidas</Text>
                      <Text style={[styles.statValue, { color: '#ef4444' }]}>{curso.cuotas_vencidas}</Text>
                    </View>
                  </View>

                  {!!curso.es_curso_promocional && (
                    <View style={[styles.promocionInfo, { backgroundColor: darkMode ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)' }]}>
                      <View style={styles.promocionHeader}>
                        <Ionicons name="gift" size={14} color="#10b981" />
                        <Text style={[styles.promocionTitle, { color: darkMode ? '#d1fae5' : '#065f46' }]}>Beneficio Promocional</Text>
                      </View>
                      <Text style={[styles.promocionText, { color: darkMode ? 'rgba(209, 250, 229, 0.9)' : '#047857' }]}>
                        {curso.meses_gratis} {curso.meses_gratis === 1 ? 'mes' : 'meses'} GRATIS
                      </Text>
                      {fechaInicioCobro ? (
                        <Text style={[styles.promocionText, { color: darkMode ? 'rgba(209, 250, 229, 0.9)' : '#047857' }]}>
                          Inicio de cobros: {fechaInicioCobro.toLocaleDateString('es-ES', { year: 'numeric', month: 'long' })}
                        </Text>
                      ) : null}
                      {!decisionTomada ? (
                        <View style={styles.decisionButtons}>
                          <TouchableOpacity
                            style={[styles.decisionButton, { backgroundColor: '#10b981' }]}
                            onPress={() => handleDecisionPromocion(curso, 'continuar')}
                            activeOpacity={0.8}>
                            <Ionicons name="checkmark-circle" size={14} color="#fff" />
                            <Text style={styles.decisionButtonText}>Continuar</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.decisionButton, { backgroundColor: darkMode ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2', borderWidth: 1, borderColor: '#ef4444' }]}
                            onPress={() => {
                              Alert.alert('Confirmar', '¿Seguro que no deseas continuar después del período gratuito?', [
                                { text: 'Cancelar', style: 'cancel' },
                                { text: 'Confirmar', onPress: () => handleDecisionPromocion(curso, 'rechazar') }
                              ]);
                            }}
                            activeOpacity={0.8}>
                            <Ionicons name="close-circle" size={14} color="#ef4444" />
                            <Text style={[styles.decisionButtonText, { color: '#ef4444' }]}>No Continuar</Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}
                    </View>
                  )}

                  {/* Cuotas expandidas */}
                  {cursoExpandido === curso.id_matricula && (
                    <View style={styles.cuotasContainer}>
                      {loadingCuotas[curso.id_matricula] ? (
                        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Cargando cuotas...</Text>
                      ) : !cuotasPorCurso[curso.id_matricula] || cuotasPorCurso[curso.id_matricula]?.length === 0 ? (
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No hay cuotas</Text>
                      ) : (
                        (cuotasPorCurso[curso.id_matricula] || []).map((cuota) => (
                          <View key={cuota.id_pago} style={[styles.cuotaCard, { backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)', borderColor: colors.border }]}>
                            <View style={styles.cuotaHeader}>
                              <View style={styles.cuotaInfo}>
                                <Text style={[styles.cuotaNumero, { color: colors.text }]}>
                                  {`Cuota #${cuota.numero_cuota}`}
                                </Text>
                                <Text style={[styles.cuotaFecha, { color: colors.textSecondary }]}>
                                  {`Vence: ${formatearFecha(cuota.fecha_vencimiento)}`}
                                </Text>
                              </View>
                              <Text style={[styles.cuotaMonto, { color: colors.text }]}>
                                {`$${formatearMonto(cuota.monto)}`}
                              </Text>
                            </View>

                            <View style={styles.cuotaFooter}>
                              <View style={[styles.estadoBadge, { backgroundColor: `${getEstadoColor(cuota.estado)}20` }]}>
                                <Text style={[styles.estadoText, { color: getEstadoColor(cuota.estado) }]}>
                                  {getEstadoTexto(cuota.estado)}
                                </Text>
                              </View>

                              {cuota.estado === 'pendiente' && (
                                <TouchableOpacity
                                  style={[styles.pagarButton, { backgroundColor: '#10b981' }]}
                                  onPress={() => handlePagarCuota(cuota)}
                                  activeOpacity={0.8}
                                >
                                  <Ionicons name="card" size={12} color="#fff" />
                                  <Text style={styles.pagarButtonText}>Pagar</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                        ))
                      )}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* Cursos al Día */}
        {cursosAlDia.length > 0 && (
          <View style={[styles.section, { marginTop: 16 }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Cursos al Día</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary, marginBottom: 12 }]}>
              Estos cursos ya no tienen cuotas pendientes. Puedes consultar su historial de pagos.
            </Text>

            {cursosAlDia.map((curso) => (
              <View
                key={`al-dia-${curso.id_matricula}`}
                style={[styles.cursoCard, { backgroundColor: darkMode ? 'rgba(16, 185, 129, 0.08)' : '#ecfdf5', borderColor: darkMode ? 'rgba(16, 185, 129, 0.4)' : '#a7f3d0' }]}
              >
                <View style={styles.cursoHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={[styles.cursoNombre, { color: darkMode ? '#d1fae5' : '#065f46' }]}>
                        {curso.curso_nombre}
                      </Text>
                      <View style={[styles.badge, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                        <Ionicons name="checkmark-circle" size={10} color="#059669" />
                        <Text style={[styles.badgeText, { color: '#059669' }]}>Pagos completados</Text>
                      </View>
                    </View>
                    <Text style={[styles.cursoTipo, { color: darkMode ? 'rgba(209, 250, 229, 0.85)' : '#047857' }]}>
                      {curso.tipo_curso_nombre}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.verHistorialButton, { backgroundColor: cursoExpandido === curso.id_matricula ? '#047857' : '#10b981' }]}
                    onPress={() => handleToggleCuotas(curso)}
                  >
                    <Ionicons name={cursoExpandido === curso.id_matricula ? 'eye-off' : 'eye'} size={14} color="#fff" />
                    <Text style={styles.verHistorialText}>
                      {cursoExpandido === curso.id_matricula ? 'Ocultar' : 'Ver'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.statsRow}>
                  <View style={[styles.statBox, { backgroundColor: darkMode ? 'rgba(16, 185, 129, 0.12)' : '#d1fae5', borderColor: darkMode ? 'rgba(16,185,129,0.3)' : '#a7f3d0' }]}>
                    <Ionicons name="checkmark-circle" size={10} color="#059669" />
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Cuotas pagadas</Text>
                    <Text style={[styles.statValue, { color: '#059669' }]}>{curso.total_cuotas}</Text>
                  </View>
                  <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.statLabel, { color: darkMode ? 'rgba(209,250,229,0.9)' : '#047857' }]}>Monto total</Text>
                    <Text style={[styles.statValue, { color: darkMode ? '#d1fae5' : '#047857' }]}>
                      ${formatearMonto(obtenerMontoTotalPagado(curso))}
                    </Text>
                  </View>
                </View>

                {cursoExpandido === curso.id_matricula && (
                  <View style={styles.cuotasContainer}>
                    {loadingCuotas[curso.id_matricula] ? (
                      <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Cargando historial...</Text>
                    ) : (
                      cuotasPorCurso[curso.id_matricula]?.map((cuota) => (
                        <View key={cuota.id_pago} style={[styles.cuotaItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                          <View style={styles.cuotaInfo}>
                            <Text style={[styles.cuotaNumero, { color: colors.text }]}>Cuota #{cuota.numero_cuota}</Text>
                            <Text style={[styles.cuotaMonto, { color: colors.textSecondary }]}>${formatearMonto(cuota.monto)}</Text>
                          </View>
                          <View style={[styles.estadoBadge, { backgroundColor: `${getEstadoColor(cuota.estado)}20`, borderColor: `${getEstadoColor(cuota.estado)}40` }]}>
                            <Text style={[styles.estadoText, { color: getEstadoColor(cuota.estado) }]}>
                              {getEstadoTexto(cuota.estado)}
                            </Text>
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Modal de pago */}
      <ModalPago
        visible={showPagoModal}
        cuota={selectedCuota}
        onClose={() => {
          setShowPagoModal(false);
          setSelectedCuota(null);
        }}
        onSuccess={() => {
          fetchData();
          if (cursoExpandido) {
            loadCuotasMatricula(cursoExpandido);
          }
        }}
        darkMode={darkMode}
      />
    </View>
  );
}

// Modal de Pago
interface ModalPagoProps {
  visible: boolean;
  cuota: Cuota | null;
  onClose: () => void;
  onSuccess: () => void;
  darkMode: boolean;
}

function ModalPago({ visible, cuota, onClose, onSuccess, darkMode }: ModalPagoProps) {
  const [metodoPago, setMetodoPago] = useState<'transferencia' | 'efectivo'>('transferencia');
  const [montoPagar, setMontoPagar] = useState('');
  const [numeroComprobante, setNumeroComprobante] = useState('');
  const [bancoComprobante, setBancoComprobante] = useState('');
  const [fechaTransferencia, setFechaTransferencia] = useState('');
  const [recibidoPor, setRecibidoPor] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [archivoComprobante, setArchivoComprobante] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showBancoPicker, setShowBancoPicker] = useState(false);

  const colors = {
    card: darkMode ? '#1a1a1a' : '#ffffff',
    text: darkMode ? '#ffffff' : '#1e293b',
    textSecondary: darkMode ? 'rgba(255,255,255,0.7)' : 'rgba(30,41,59,0.7)',
    border: darkMode ? 'rgba(251, 191, 36, 0.2)' : 'rgba(251, 191, 36, 0.3)',
    input: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
  };

  const bancos = [
    'Banco Pichincha',
    'Banco del Guayaquil',
    'Banco del Pacífico',
    'Produbanco',
    'Banco Internacional',
    'Banco Bolivariano',
    'Banco de Machala',
    'Banco ProCredit',
    'Banco Solidario',
    'Banco Capital',
    'Banco Comercial de Manabí',
    'Banco Coopnacional',
    'Banco D-MIRO',
    'Banco Finca',
    'Banco General Rumiñahui',
    'Banco Loja',
    'Banco VisionFund Ecuador'
  ];

  // Función para obtener fecha de Ecuador (UTC-5)
  const getFechaEcuador = () => {
    const now = new Date();
    const ecuadorOffset = -5 * 60;
    const localOffset = now.getTimezoneOffset();
    const ecuadorTime = new Date(now.getTime() + (localOffset + ecuadorOffset) * 60000);
    return ecuadorTime.toISOString().split('T')[0];
  };

  // Función para verificar si un valor es múltiplo de una base
  const esMultiploDe = (valor: number, base: number) => {
    if (!base) return false;
    const ratio = valor / base;
    return Math.abs(ratio - Math.round(ratio)) < 0.0001;
  };

  const montoPorClase = Number(cuota?.monto || 0);

  useEffect(() => {
    if (cuota && visible) {
      setMontoPagar(cuota.monto.toString());
      setFechaTransferencia(getFechaEcuador());
    }
  }, [cuota, visible]);

  if (!cuota) return null;

  const handleFileSelect = async () => {
    Alert.alert(
      'Seleccionar comprobante',
      'Elige una opción',
      [
        { text: 'Cámara', onPress: selectFromCamera },
        { text: 'Galería', onPress: selectFromGallery },
        { text: 'Cancelar', style: 'cancel' }
      ]
    );
  };

  const selectFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Error', 'Se necesita permiso para la cámara');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setArchivoComprobante(result.assets[0]);
    }
  };

  const selectFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setArchivoComprobante(result.assets[0]);
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);

      const montoNumerico = parseFloat(montoPagar);
      if (isNaN(montoNumerico) || montoNumerico <= 0) {
        Alert.alert('Error', 'El monto debe ser mayor a 0');
        return;
      }

      if (montoNumerico < cuota.monto) {
        Alert.alert('Error', `El monto mínimo es ${cuota.monto.toFixed(2)}`);
        return;
      }

      if (cuota.modalidad_pago === 'mensual' && montoNumerico % 90 !== 0) {
        Alert.alert('Error', 'Solo se permiten múltiplos de $90');
        return;
      }

      if (cuota.modalidad_pago === 'clases' && !esMultiploDe(montoNumerico, montoPorClase)) {
        Alert.alert('Error', `Solo se permiten múltiplos de ${montoPorClase.toFixed(2)} (por clase)`);
        return;
      }

      if (metodoPago === 'transferencia' && (!numeroComprobante || !bancoComprobante || !fechaTransferencia)) {
        Alert.alert('Error', 'Completa todos los campos de transferencia');
        return;
      }

      if (metodoPago === 'efectivo' && (!numeroComprobante || !recibidoPor)) {
        Alert.alert('Error', 'Completa todos los campos');
        return;
      }

      if (!archivoComprobante) {
        Alert.alert('Error', 'Debes subir el comprobante');
        return;
      }

      const formData = new FormData();
      formData.append('metodo_pago', metodoPago);
      formData.append('monto_pagado', montoNumerico.toFixed(2));
      formData.append('numero_comprobante', numeroComprobante);

      if (metodoPago === 'transferencia') {
        formData.append('banco_comprobante', bancoComprobante);
        formData.append('fecha_transferencia', fechaTransferencia);
      } else {
        formData.append('banco_comprobante', 'N/A');
        formData.append('fecha_transferencia', getFechaEcuador());
        formData.append('recibido_por', recibidoPor);
      }

      formData.append('observaciones', observaciones);

      const file: any = {
        uri: archivoComprobante.uri,
        type: archivoComprobante.mimeType || 'image/jpeg',
        name: archivoComprobante.fileName || 'comprobante.jpg',
      };
      formData.append('comprobante', file);

      const token = await getToken();
      const response = await fetch(`${API_URL}/pagos-mensuales/pagar/${cuota.id_pago}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al procesar el pago');
      }

      Alert.alert('Éxito', 'Pago registrado. Pendiente de verificación');
      onSuccess();
      onClose();
      resetForm();

    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Error al procesar');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setMetodoPago('transferencia');
    setMontoPagar('');
    setNumeroComprobante('');
    setBancoComprobante('');
    setFechaTransferencia('');
    setRecibidoPor('');
    setObservaciones('');
    setArchivoComprobante(null);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{`Pagar Cuota #${cuota.numero_cuota}`}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Monto */}
            <View style={styles.modalField}>
              <Text style={[styles.modalLabel, { color: colors.text }]}>Monto a Pagar</Text>
              <View style={styles.montoContainer}>
                {/* Botón decrementar */}
                <TouchableOpacity
                  style={[styles.montoButton, { backgroundColor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.35)' }]}
                  onPress={() => {
                    const montoActual = parseFloat(montoPagar) || 0;
                    const paso = cuota.modalidad_pago === 'mensual' ? 90 : (cuota.modalidad_pago === 'clases' ? montoPorClase : 0.01);
                    const nuevoMonto = Math.max(paso, montoActual - paso);
                    setMontoPagar(nuevoMonto.toFixed(2));
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.montoButtonText}>−</Text>
                </TouchableOpacity>

                {/* Input de monto */}
                <TextInput
                  style={[styles.modalInput, styles.montoInput, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
                  value={montoPagar}
                  onChangeText={(valor) => {
                    const numero = parseFloat(valor);

                    if (valor === '' || numero === 0) {
                      setMontoPagar(valor);
                      return;
                    }

                    if (cuota.modalidad_pago === 'mensual') {
                      if (numero % 90 === 0 && numero >= 90) {
                        setMontoPagar(valor);
                      } else {
                        Alert.alert('Aviso', 'Solo se permiten múltiplos de $90 (90, 180, 270, 360...)');
                      }
                      return;
                    }

                    if (cuota.modalidad_pago === 'clases') {
                      if (numero >= montoPorClase && esMultiploDe(numero, montoPorClase)) {
                        setMontoPagar(valor);
                      } else {
                        Alert.alert('Aviso', `Solo se permiten múltiplos de ${montoPorClase.toFixed(2)} (por clase)`);
                      }
                      return;
                    }

                    setMontoPagar(valor);
                  }}
                  onBlur={() => {
                    // Al perder el foco, validar y restaurar si es inválido
                    if (cuota.modalidad_pago === 'mensual') {
                      const numero = parseFloat(montoPagar);
                      if (!numero || numero < 90 || numero % 90 !== 0) {
                        setMontoPagar(cuota.monto.toString());
                        Alert.alert('Error', 'Monto inválido. Se restauró al valor de la cuota.');
                      }
                      return;
                    }

                    if (cuota.modalidad_pago === 'clases') {
                      const numero = parseFloat(montoPagar);
                      if (!numero || numero < montoPorClase || !esMultiploDe(numero, montoPorClase)) {
                        setMontoPagar(cuota.monto.toString());
                        Alert.alert('Error', `Monto inválido. Solo múltiplos de ${montoPorClase.toFixed(2)}.`);
                      }
                      return;
                    }
                  }}
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor={colors.textSecondary}
                />

                {/* Botón incrementar */}
                <TouchableOpacity
                  style={[styles.montoButton, { backgroundColor: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.35)' }]}
                  onPress={() => {
                    const montoActual = parseFloat(montoPagar) || 0;
                    const paso = cuota.modalidad_pago === 'mensual' ? 90 : (cuota.modalidad_pago === 'clases' ? montoPorClase : 0.01);
                    const maxMonto = cuota.modalidad_pago === 'mensual' ? (90 * (cuota.meses_duracion || 12)) : undefined;
                    const nuevoMonto = montoActual + paso;

                    if (maxMonto && nuevoMonto > maxMonto) {
                      Alert.alert('Aviso', `El monto máximo es ${maxMonto.toFixed(2)}`);
                      return;
                    }

                    setMontoPagar(nuevoMonto.toFixed(2));
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.montoButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Método de pago */}
            <View style={styles.modalField}>
              <Text style={[styles.modalLabel, { color: colors.text }]}>Método de Pago</Text>
              <View style={styles.metodoPagoButtons}>
                <TouchableOpacity
                  style={[styles.metodoPagoButton, { backgroundColor: metodoPago === 'transferencia' ? '#10b981' : colors.input, borderColor: colors.border }]}
                  onPress={() => setMetodoPago('transferencia')}
                >
                  <Text style={[styles.metodoPagoText, { color: metodoPago === 'transferencia' ? '#fff' : colors.text }]}>
                    {'Transferencia'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.metodoPagoButton, { backgroundColor: metodoPago === 'efectivo' ? '#10b981' : colors.input, borderColor: colors.border }]}
                  onPress={() => setMetodoPago('efectivo')}
                >
                  <Text style={[styles.metodoPagoText, { color: metodoPago === 'efectivo' ? '#fff' : colors.text }]}>
                    {'Efectivo'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Número de comprobante */}
            <View style={styles.modalField}>
              <Text style={[styles.modalLabel, { color: colors.text }]}>Número de Comprobante</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
                value={numeroComprobante}
                onChangeText={setNumeroComprobante}
                keyboardType="numeric"
                placeholder="123456"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            {/* Campos específicos */}
            {metodoPago === 'transferencia' ? (
              <>
                <View style={styles.modalField}>
                  <Text style={[styles.modalLabel, { color: colors.text }]}>Banco *</Text>
                  <TouchableOpacity
                    style={[styles.modalInput, { backgroundColor: colors.input, borderColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
                    onPress={() => setShowBancoPicker(true)}
                  >
                    <Text style={[{ color: bancoComprobante ? colors.text : colors.textSecondary }]}>
                      {bancoComprobante || 'Seleccionar banco'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalField}>
                  <Text style={[styles.modalLabel, { color: colors.text }]}>Fecha de Transferencia *</Text>
                  <View style={[styles.modalInput, { backgroundColor: darkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderColor: colors.border, opacity: 0.7 }]}>
                    <Text style={[{ color: colors.textSecondary }]}>
                      {fechaTransferencia ? new Date(fechaTransferencia + 'T00:00:00').toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Fecha actual'}
                    </Text>
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.modalField}>
                <Text style={[styles.modalLabel, { color: colors.text }]}>Recibido Por</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
                  value={recibidoPor}
                  onChangeText={setRecibidoPor}
                  placeholder="Nombre de quien recibió"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            )}

            {/* Observaciones */}
            <View style={styles.modalField}>
              <Text style={[styles.modalLabel, { color: colors.text }]}>Observaciones (opcional)</Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextArea, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
                value={observaciones}
                onChangeText={setObservaciones}
                multiline
                numberOfLines={3}
                placeholder="Comentarios adicionales"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            {/* Comprobante */}
            <View style={styles.modalField}>
              <Text style={[styles.modalLabel, { color: colors.text }]}>Comprobante</Text>
              <TouchableOpacity
                style={[styles.fileButton, { backgroundColor: colors.input, borderColor: colors.border }]}
                onPress={handleFileSelect}
              >
                <Ionicons name="cloud-upload" size={20} color={colors.text} />
                <Text style={[styles.fileButtonText, { color: colors.text }]}>
                  {archivoComprobante ? 'Archivo seleccionado' : 'Seleccionar archivo'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Botones */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#10b981' }]}
                onPress={handleSubmit}
                disabled={loading}
              >
                <Text style={styles.modalButtonText}>{loading ? 'Procesando...' : 'Pagar'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border }]}
                onPress={onClose}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>

      {/* Modal Picker de Bancos */}
      <Modal
        visible={showBancoPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBancoPicker(false)}
      >
        <View style={styles.pickerModalOverlay}>
          <View style={[styles.pickerModalContent, { backgroundColor: colors.card }]}>
            <View style={styles.pickerHeader}>
              <Text style={[styles.pickerTitle, { color: colors.text }]}>Seleccionar Banco</Text>
              <TouchableOpacity onPress={() => setShowBancoPicker(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerList}>
              {bancos.map((banco, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.pickerItem,
                    { borderBottomColor: colors.border },
                    bancoComprobante === banco && { backgroundColor: darkMode ? 'rgba(251, 191, 36, 0.1)' : 'rgba(251, 191, 36, 0.05)' }
                  ]}
                  onPress={() => {
                    setBancoComprobante(banco);
                    setShowBancoPicker(false);
                  }}
                >
                  <Text style={[styles.pickerItemText, { color: bancoComprobante === banco ? '#fbbf24' : colors.text }]}>
                    {banco}
                  </Text>
                  {bancoComprobante === banco && (
                    <Ionicons name="checkmark-circle" size={20} color="#fbbf24" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Modal>
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
  resumenContainer: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: 4,
    gap: 6,
  },
  resumenCard: {
    flex: 1,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  resumenValue: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  resumenLabel: {
    fontSize: 8,
    fontWeight: '600',
  },
  section: {
    padding: 16,
    paddingTop: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  sectionSubtitle: {
    fontSize: 11,
    lineHeight: 16,
  },
  verHistorialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  verHistorialText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  cuotaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 6,
  },
  cuotaInfo: {
    flex: 1,
  },
  cuotaNumero: {
    fontSize: 12,
    fontWeight: '600',
  },
  cuotaMonto: {
    fontSize: 11,
    marginTop: 2,
  },
  emptyCard: {
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
  cursoCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  cursoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  cursoInfo: {
    flex: 1,
    gap: 4,
  },
  cursoNombre: {
    fontSize: 13,
    fontWeight: '700',
  },
  cursoTipo: {
    fontSize: 10,
  },
  promocionalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  promocionalText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#fff',
  },
  verCuotasButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  verCuotasText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  statBox: {
    flex: 1,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    gap: 3,
  },
  statLabel: {
    fontSize: 8,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  promocionInfo: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  promocionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  promocionTitle: {
    fontSize: 11,
    fontWeight: '700',
  },
  promocionText: {
    fontSize: 10,
    lineHeight: 16,
  },
  decisionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  decisionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  decisionButtonText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  cuotasContainer: {
    marginTop: 10,
    gap: 8,
  },
  loadingText: {
    fontSize: 11,
    textAlign: 'center',
    padding: 16,
  },
  cuotaCard: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  cuotaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cuotaFecha: {
    fontSize: 9,
    marginTop: 2,
  },
  cuotaFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  estadoBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  estadoText: {
    fontSize: 9,
    fontWeight: '700',
  },
  pagarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pagarButtonText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalField: {
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  modalInput: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 12,
  },
  montoContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  montoButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  montoButtonText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#10b981',
  },
  montoInput: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '600',
  },
  modalTextArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  metodoPagoButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  metodoPagoButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  metodoPagoText: {
    fontSize: 11,
    fontWeight: '700',
  },
  fileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  fileButtonText: {
    fontSize: 11,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerModalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  pickerList: {
    maxHeight: 400,
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  pickerItemText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
