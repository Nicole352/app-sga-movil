import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
    ScrollView,
    Image,
    Dimensions,
    Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import CompactPicker from './components/CompactPicker';
import Pagination from './components/Pagination';
import { API_URL } from '../../../constants/config';
import { getToken, getDarkMode } from '../../../services/storage';
import { eventEmitter } from '../../../services/eventEmitter';

const { width } = Dimensions.get('window');

interface Pago {
    id_pago: number;
    numero_cuota: number;
    monto: number;
    fecha_vencimiento: string;
    fecha_pago: string | null;
    metodo_pago: string;
    numero_comprobante: string | null;
    banco_comprobante: string | null;
    fecha_transferencia: string | null;
    comprobante_pago_url?: string | null;
    estado: 'pendiente' | 'pagado' | 'verificado' | 'vencido';
    observaciones: string | null;
    verificado_por: number | null;
    fecha_verificacion: string | null;
    verificado_por_nombre?: string;
    verificado_por_apellido?: string;
    estudiante_nombre: string;
    estudiante_apellido: string;
    estudiante_cedula: string;
    curso_nombre: string;
    codigo_matricula: string;
    id_curso: number;
    modalidad_pago?: 'mensual' | 'clases';
    numero_clases?: number;
    precio_por_clase?: number;
    curso_horario?: string;
    recibido_por?: string;
}

interface EstudianteAgrupado {
    estudiante_cedula: string;
    estudiante_nombre: string;
    estudiante_apellido: string;
    cursos: {
        id_curso: number;
        curso_nombre: string;
        codigo_matricula: string;
        pagos: Pago[];
    }[];
}

export default function AdminPagosScreen() {
    const [darkMode, setDarkMode] = useState(false);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Datos
    const [pagos, setPagos] = useState<Pago[]>([]);
    const [estudiantes, setEstudiantes] = useState<EstudianteAgrupado[]>([]);

    // Filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [filterEstado, setFilterEstado] = useState<string>('todos');

    // Paginación
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Modales
    const [selectedPago, setSelectedPago] = useState<Pago | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showComprobanteModal, setShowComprobanteModal] = useState(false);
    const [comprobanteUrl, setComprobanteUrl] = useState('');
    const [showRechazoModal, setShowRechazoModal] = useState(false);
    const [motivoRechazo, setMotivoRechazo] = useState('');
    const [procesando, setProcesando] = useState(false);

    // Selección de curso y cuota por estudiante
    const [selectedCurso, setSelectedCurso] = useState<{ [cedula: string]: number }>({});
    const [selectedCuota, setSelectedCuota] = useState<{ [key: string]: number }>({});

    const theme = darkMode ? {
        bg: '#0f172a',
        cardBg: '#1e293b',
        text: '#f8fafc',
        textSecondary: '#cbd5e1',
        textMuted: '#94a3b8',
        border: '#334155',
        primary: '#ef4444',
        inputBg: '#334155',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
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
        warning: '#d97706',
        danger: '#ef4444',
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [filterEstado])
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

            const params = new URLSearchParams();
            if (filterEstado !== 'todos') params.set('estado', filterEstado);
            params.set('limit', '999999');

            const response = await fetch(`${API_URL}/admin/pagos?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setPagos(data);
                const agrupados = agruparPorEstudiante(data);
                setEstudiantes(agrupados);

                // Inicializar selectores
                const initCursos: { [key: string]: number } = {};
                const initCuotas: { [key: string]: number } = {};
                agrupados.forEach(est => {
                    if (est.cursos.length > 0) {
                        initCursos[est.estudiante_cedula] = est.cursos[0].id_curso;
                        const key = `${est.estudiante_cedula}-${est.cursos[0].id_curso}`;
                        if (est.cursos[0].pagos.length > 0) {
                            // Priorizar pagos "pagado" (pendientes de verificar)
                            const pagoPendiente = est.cursos[0].pagos.find(p => p.estado === 'pagado');
                            initCuotas[key] = pagoPendiente ? pagoPendiente.id_pago : est.cursos[0].pagos[0].id_pago;
                        }
                    }
                });
                setSelectedCurso(initCursos);
                setSelectedCuota(initCuotas);
            }
        } catch (error) {
            console.error('Error loading pagos:', error);
            Alert.alert('Error', 'No se pudieron cargar los pagos');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const agruparPorEstudiante = (pagosData: Pago[]): EstudianteAgrupado[] => {
        const grupos: { [key: string]: EstudianteAgrupado } = {};

        pagosData.forEach(pago => {
            const cedula = pago.estudiante_cedula;
            if (!grupos[cedula]) {
                grupos[cedula] = {
                    estudiante_cedula: cedula,
                    estudiante_nombre: pago.estudiante_nombre,
                    estudiante_apellido: pago.estudiante_apellido,
                    cursos: []
                };
            }

            let curso = grupos[cedula].cursos.find(c => c.id_curso === pago.id_curso);
            if (!curso) {
                curso = {
                    id_curso: pago.id_curso,
                    curso_nombre: pago.curso_nombre,
                    codigo_matricula: pago.codigo_matricula,
                    pagos: []
                };
                grupos[cedula].cursos.push(curso);
            }
            curso.pagos.push(pago);
        });

        // Ordenar pagos por número de cuota
        Object.values(grupos).forEach(est => {
            est.cursos.forEach(curso => {
                curso.pagos.sort((a, b) => a.numero_cuota - b.numero_cuota);
            });
        });

        return Object.values(grupos);
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
    };

    const formatMonto = (monto: number) => {
        return `$${Number(monto).toFixed(2)}`;
    };

    const formatDate = (d?: string | null) => {
        if (!d) return 'N/D';
        return new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    const getEstadoColor = (estado: string) => {
        switch (estado) {
            case 'pendiente': return theme.textMuted;
            case 'pagado': return theme.warning;
            case 'verificado': return theme.success;
            case 'vencido': return theme.danger;
            default: return theme.textMuted;
        }
    };

    const getEstadoIcon = (estado: string) => {
        switch (estado) {
            case 'pendiente': return 'time-outline';
            case 'pagado': return 'hourglass-outline';
            case 'verificado': return 'checkmark-circle';
            case 'vencido': return 'alert-circle';
            default: return 'help-circle-outline';
        }
    };

    const pagosPorVerificar = useMemo(() => {
        return pagos.filter(p => p.estado === 'pagado').length;
    }, [pagos]);

    const handleVerComprobante = async (pago: Pago) => {
        try {
            const token = await getToken();
            const response = await fetch(`${API_URL}/admin/pagos/${pago.id_pago}/comprobante`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.comprobante_pago_url) {
                    const url = data.comprobante_pago_url;
                    // Si es PDF, abrir en navegador
                    if (url.toLowerCase().endsWith('.pdf')) {
                        Linking.openURL(url);
                    } else {
                        setComprobanteUrl(url);
                        setShowComprobanteModal(true);
                    }
                } else {
                    Alert.alert('Error', 'Comprobante no disponible');
                }
            }
        } catch (error) {
            Alert.alert('Error', 'No se pudo cargar el comprobante');
        }
    };

    const handleVerificarPago = async (pago: Pago) => {
        Alert.alert(
            'Verificar Pago',
            `¿Confirmar verificación de la cuota ${pago.numero_cuota} de ${pago.estudiante_nombre} ${pago.estudiante_apellido}?`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Verificar',
                    onPress: async () => {
                        try {
                            setProcesando(true);
                            const token = await getToken();

                            // Obtener ID del usuario actual
                            const meRes = await fetch(`${API_URL}/auth/me`, {
                                headers: { Authorization: `Bearer ${token}` }
                            });
                            const userData = await meRes.json();

                            const response = await fetch(`${API_URL}/admin/pagos/${pago.id_pago}/verificar`, {
                                method: 'PUT',
                                headers: {
                                    'Content-Type': 'application/json',
                                    Authorization: `Bearer ${token}`
                                },
                                body: JSON.stringify({ verificado_por: userData.id_usuario })
                            });

                            if (response.ok) {
                                Alert.alert('Éxito', 'Pago verificado correctamente');
                                setShowDetailModal(false);
                                await loadData();
                            } else {
                                Alert.alert('Error', 'No se pudo verificar el pago');
                            }
                        } catch (error) {
                            Alert.alert('Error', 'Error de red');
                        } finally {
                            setProcesando(false);
                        }
                    }
                }
            ]
        );
    };

    const handleRechazarPago = (pago: Pago) => {
        setSelectedPago(pago);
        setMotivoRechazo('');
        setShowRechazoModal(true);
    };

    const confirmarRechazo = async () => {
        if (!motivoRechazo.trim()) {
            Alert.alert('Atención', 'Por favor ingrese el motivo del rechazo');
            return;
        }

        if (!selectedPago) return;

        try {
            setProcesando(true);
            const token = await getToken();

            const meRes = await fetch(`${API_URL}/auth/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const userData = await meRes.json();

            const response = await fetch(`${API_URL}/admin/pagos/${selectedPago.id_pago}/rechazar`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    observaciones: motivoRechazo,
                    verificado_por: userData.id_usuario
                })
            });

            if (response.ok) {
                Alert.alert('Éxito', 'Pago rechazado correctamente');
                setShowRechazoModal(false);
                setShowDetailModal(false);
                await loadData();
            } else {
                Alert.alert('Error', 'No se pudo rechazar el pago');
            }
        } catch (error) {
            Alert.alert('Error', 'Error de red');
        } finally {
            setProcesando(false);
        }
    };

    const getCursoSeleccionado = (estudiante: EstudianteAgrupado) => {
        const idCurso = selectedCurso[estudiante.estudiante_cedula];
        return estudiante.cursos.find(c => c.id_curso === idCurso) || estudiante.cursos[0];
    };

    const getPagoSeleccionado = (estudiante: EstudianteAgrupado, curso: EstudianteAgrupado['cursos'][number]): Pago | null => {
        const key = `${estudiante.estudiante_cedula}-${curso.id_curso}`;
        const idCuota = selectedCuota[key];
        return curso.pagos.find(p => p.id_pago === idCuota) || curso.pagos[0] || null;
    };

    const estudiantesFiltrados = useMemo(() => {
        return estudiantes.filter(est => {
            const matchSearch =
                est.estudiante_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                est.estudiante_apellido.toLowerCase().includes(searchTerm.toLowerCase()) ||
                est.estudiante_cedula.includes(searchTerm);
            return matchSearch;
        });
    }, [estudiantes, searchTerm]);

    // Paginación
    const totalPages = Math.ceil(estudiantesFiltrados.length / itemsPerPage);
    const paginatedEstudiantes = estudiantesFiltrados.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterEstado]);

    const renderEstudiante = ({ item }: { item: EstudianteAgrupado }) => {
        const curso = getCursoSeleccionado(item);
        if (!curso) return null;

        const pago = getPagoSeleccionado(item, curso);
        if (!pago) return null;

        const estadoColor = getEstadoColor(pago.estado);
        const estadoIcon = getEstadoIcon(pago.estado);

        return (
            <TouchableOpacity
                style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
                onPress={() => {
                    setSelectedPago(pago);
                    setShowDetailModal(true);
                }}
                activeOpacity={0.8}
            >
                {/* Header Estudiante */}
                <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.studentName, { color: theme.text }]}>
                            {item.estudiante_apellido}, {item.estudiante_nombre}
                        </Text>
                        <Text style={{ fontSize: 12, color: theme.textMuted }}>CI: {item.estudiante_cedula}</Text>
                    </View>
                    <View style={[styles.estadoBadge, { backgroundColor: estadoColor + '20', borderColor: estadoColor }]}>
                        <Ionicons name={estadoIcon as any} size={14} color={estadoColor} />
                        <Text style={[styles.estadoText, { color: estadoColor }]}>{pago.estado.toUpperCase()}</Text>
                    </View>
                </View>

                <View style={[styles.divider, { backgroundColor: theme.border }]} />

                {/* Selector de Curso (si tiene múltiples) */}
                {item.cursos.length > 1 && (
                    <View style={{ marginBottom: 10 }}>
                        <Text style={{ fontSize: 11, color: theme.textMuted, marginBottom: 4 }}>Curso:</Text>
                        <CompactPicker
                            selectedValue={String(selectedCurso[item.estudiante_cedula])}
                            onValueChange={(value) => {
                                setSelectedCurso(prev => ({ ...prev, [item.estudiante_cedula]: Number(value) }));
                            }}
                            items={item.cursos.map(c => ({
                                label: c.curso_nombre,
                                value: String(c.id_curso)
                            }))}
                            theme={theme}
                        />
                    </View>
                )}

                {/* Info Curso */}
                <View style={styles.infoRow}>
                    <Ionicons name="book-outline" size={14} color={theme.primary} />
                    <Text style={{ fontSize: 13, color: theme.text, marginLeft: 6 }}>{curso.curso_nombre}</Text>
                </View>
                <View style={styles.infoRow}>
                    <Ionicons name="barcode-outline" size={14} color={theme.textMuted} />
                    <Text style={{ fontSize: 12, color: theme.textMuted, marginLeft: 6 }}>{curso.codigo_matricula}</Text>
                </View>

                <View style={[styles.divider, { backgroundColor: theme.border }]} />

                {/* Selector de Cuota */}
                <View style={{ marginBottom: 10 }}>
                    <Text style={{ fontSize: 11, color: theme.textMuted, marginBottom: 4 }}>Cuota:</Text>
                    <CompactPicker
                        selectedValue={String(selectedCuota[`${item.estudiante_cedula}-${curso.id_curso}`])}
                        onValueChange={(value) => {
                            const key = `${item.estudiante_cedula}-${curso.id_curso}`;
                            setSelectedCuota(prev => ({ ...prev, [key]: Number(value) }));
                        }}
                        items={curso.pagos.map(p => ({
                            label: `Cuota ${p.numero_cuota} - ${formatMonto(p.monto)} - ${p.estado}`,
                            value: String(p.id_pago)
                        }))}
                        theme={theme}
                    />
                </View>

                {/* Info Pago */}
                <View style={styles.pagoInfo}>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, color: theme.textMuted }}>Monto</Text>
                        <Text style={{ fontSize: 18, fontWeight: '700', color: theme.primary }}>{formatMonto(pago.monto)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, color: theme.textMuted }}>Vencimiento</Text>
                        <Text style={{ fontSize: 12, color: theme.text }}>{formatDate(pago.fecha_vencimiento)}</Text>
                    </View>
                </View>

                {/* Botones */}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    {pago.comprobante_pago_url && (
                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: theme.primary + '15', borderColor: theme.primary, flex: 1 }]}
                            onPress={() => handleVerComprobante(pago)}
                        >
                            <Ionicons name="document-text-outline" size={16} color={theme.primary} />
                            <Text style={{ fontSize: 12, color: theme.primary, fontWeight: '600' }}>Comprobante</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: theme.cardBg, borderColor: theme.border, flex: 1 }]}
                        onPress={() => {
                            setSelectedPago(pago);
                            setShowDetailModal(true);
                        }}
                    >
                        <Ionicons name="eye-outline" size={16} color={theme.text} />
                        <Text style={{ fontSize: 12, color: theme.text, fontWeight: '600' }}>Detalles</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.bg }]}>
            {/* Header Gradiente */}
            <LinearGradient
                colors={darkMode ? ['#b91c1c', '#991b1b'] : ['#ef4444', '#dc2626']}
                style={styles.summaryCard}
            >
                <Text style={styles.headerTitle}>Gestión de Pagos</Text>
                <Text style={styles.headerSubtitle}>Verifica y administra los pagos mensuales</Text>

                {/* Search */}
                <View style={[styles.searchContainer, { backgroundColor: darkMode ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)', marginTop: 15 }]}>
                    <Ionicons name="search" size={20} color="#fff" style={{ marginLeft: 10, opacity: 0.8 }} />
                    <TextInput
                        placeholder="Buscar estudiante..."
                        placeholderTextColor="rgba(255,255,255,0.7)"
                        style={styles.searchInput}
                        value={searchTerm}
                        onChangeText={setSearchTerm}
                    />
                    {searchTerm.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchTerm('')} style={{ padding: 8 }}>
                            <Ionicons name="close-circle" size={18} color="#fff" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Filtros Tabs */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 15 }}>
                    {['todos', 'pendiente', 'pagado', 'verificado', 'vencido'].map((f) => (
                        <TouchableOpacity
                            key={f}
                            style={[
                                styles.filterTab,
                                filterEstado === f && styles.filterTabActive,
                                { borderColor: filterEstado === f ? '#fff' : 'transparent' }
                            ]}
                            onPress={() => setFilterEstado(f)}
                        >
                            <Text style={[styles.filterText, { fontWeight: filterEstado === f ? '700' : '400', opacity: filterEstado === f ? 1 : 0.7 }]}>
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </LinearGradient>

            {/* Banner Pagos Por Verificar */}
            {pagosPorVerificar > 0 ? (
                <TouchableOpacity
                    style={[styles.alertBanner, { backgroundColor: darkMode ? 'rgba(239,68,68,0.2)' : '#fee2e2', borderColor: theme.danger }]}
                    onPress={() => setFilterEstado('pagado')}
                    activeOpacity={0.7}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <View style={[styles.alertIcon, { backgroundColor: theme.danger }]}>
                            <Ionicons name="alert-circle" size={24} color="#fff" />
                            <View style={styles.alertBadge}>
                                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{pagosPorVerificar}</Text>
                            </View>
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={{ color: theme.danger, fontWeight: '700', fontSize: 15 }}>
                                {pagosPorVerificar} {pagosPorVerificar === 1 ? 'pago pendiente' : 'pagos pendientes'} por verificar
                            </Text>
                            <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>Toca para ver los pagos que requieren verificación</Text>
                        </View>
                    </View>
                    <Ionicons name="chevron-forward" size={24} color={theme.danger} />
                </TouchableOpacity>
            ) : (
                <View style={[styles.alertBanner, { backgroundColor: darkMode ? 'rgba(16,185,129,0.15)' : '#d1fae5', borderColor: theme.success }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <View style={[styles.alertIcon, { backgroundColor: theme.success }]}>
                            <Ionicons name="checkmark-circle" size={24} color="#fff" />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={{ color: theme.success, fontWeight: '700', fontSize: 15 }}>¡Al día! No hay pagos por verificar</Text>
                            <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 2 }}>Todos los pagos han sido verificados correctamente</Text>
                        </View>
                    </View>
                    <Ionicons name="checkmark-done" size={24} color={theme.success} />
                </View>
            )}

            {/* Lista */}
            <FlatList
                data={paginatedEstudiantes}
                renderItem={renderEstudiante}
                keyExtractor={(item) => item.estudiante_cedula}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
                ListEmptyComponent={
                    !loading ? (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="wallet-outline" size={48} color={theme.textMuted} />
                            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No hay pagos registrados</Text>
                        </View>
                    ) : null
                }
                ListFooterComponent={
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={estudiantesFiltrados.length}
                        onPageChange={setCurrentPage}
                        theme={theme}
                        itemLabel="estudiantes"
                    />
                }
            />

            {loading && (
                <View style={styles.loader}>
                    <ActivityIndicator size="large" color={theme.primary} />
                </View>
            )}

            {/* MODAL DETALLE */}
            <Modal visible={showDetailModal} animationType="slide" transparent onRequestClose={() => setShowDetailModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalCard, { backgroundColor: theme.cardBg }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.text }]}>Detalle de Pago</Text>
                            <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                                <Ionicons name="close" size={24} color={theme.textMuted} />
                            </TouchableOpacity>
                        </View>

                        {selectedPago && (
                            <ScrollView style={{ marginTop: 10 }} showsVerticalScrollIndicator={false}>
                                {/* Estado Badge Grande */}
                                <View style={{ alignItems: 'center', marginBottom: 20 }}>
                                    <View style={[styles.estadoBadgeLarge, { backgroundColor: getEstadoColor(selectedPago.estado) + '20', borderColor: getEstadoColor(selectedPago.estado) }]}>
                                        <Ionicons name={getEstadoIcon(selectedPago.estado) as any} size={24} color={getEstadoColor(selectedPago.estado)} />
                                        <Text style={{ color: getEstadoColor(selectedPago.estado), fontWeight: '700', fontSize: 16, marginLeft: 8 }}>
                                            {selectedPago.estado.toUpperCase()}
                                        </Text>
                                    </View>
                                </View>

                                {/* Estudiante */}
                                <Text style={[styles.sectionTitle, { color: theme.text }]}>Estudiante</Text>
                                <View style={styles.detailGrid}>
                                    <DetailItem label="Nombre" value={`${selectedPago.estudiante_apellido}, ${selectedPago.estudiante_nombre}`} theme={theme} />
                                    <DetailItem label="Cédula" value={selectedPago.estudiante_cedula} theme={theme} />
                                </View>

                                <View style={[styles.divider, { backgroundColor: theme.border }]} />

                                {/* Curso */}
                                <Text style={[styles.sectionTitle, { color: theme.text }]}>Curso</Text>
                                <View style={styles.detailGrid}>
                                    <DetailItem label="Nombre" value={selectedPago.curso_nombre} theme={theme} />
                                    <DetailItem label="Código" value={selectedPago.codigo_matricula} theme={theme} />
                                    {selectedPago.curso_horario && (
                                        <DetailItem label="Horario" value={selectedPago.curso_horario} theme={theme} />
                                    )}
                                </View>

                                <View style={[styles.divider, { backgroundColor: theme.border }]} />

                                {/* Información de Pago */}
                                <Text style={[styles.sectionTitle, { color: theme.text }]}>Información de Pago</Text>
                                <View style={styles.detailGrid}>
                                    <DetailItem label="Cuota" value={`${selectedPago.numero_cuota}`} theme={theme} />
                                    <DetailItem label="Monto" value={formatMonto(selectedPago.monto)} theme={theme} isCurrency />
                                    <DetailItem label="Vencimiento" value={formatDate(selectedPago.fecha_vencimiento)} theme={theme} />
                                    {selectedPago.fecha_pago && (
                                        <DetailItem label="Fecha Pago" value={formatDate(selectedPago.fecha_pago)} theme={theme} />
                                    )}
                                </View>

                                <View style={[styles.divider, { backgroundColor: theme.border }]} />

                                {/* Método de Pago */}
                                <Text style={[styles.sectionTitle, { color: theme.text }]}>Método de Pago</Text>
                                <View style={{ padding: 12, borderRadius: 10, backgroundColor: darkMode ? '#334155' : '#f1f5f9', marginBottom: 15 }}>
                                    <Text style={{ color: theme.text, fontWeight: '600', marginBottom: 8 }}>{selectedPago.metodo_pago}</Text>
                                    {selectedPago.numero_comprobante && (
                                        <Text style={{ color: theme.textMuted, fontSize: 12 }}>Comprobante: <Text style={{ fontWeight: '700' }}>{selectedPago.numero_comprobante}</Text></Text>
                                    )}
                                    {selectedPago.metodo_pago === 'transferencia' && selectedPago.banco_comprobante && (
                                        <Text style={{ color: theme.textMuted, fontSize: 12 }}>Banco: <Text style={{ fontWeight: '700' }}>{selectedPago.banco_comprobante}</Text></Text>
                                    )}
                                    {selectedPago.metodo_pago === 'efectivo' && selectedPago.recibido_por && (
                                        <Text style={{ color: theme.textMuted, fontSize: 12 }}>Recibido por: <Text style={{ fontWeight: '700' }}>{selectedPago.recibido_por}</Text></Text>
                                    )}
                                </View>

                                {/* Comprobante */}
                                {selectedPago.comprobante_pago_url && (
                                    <>
                                        <TouchableOpacity
                                            style={[styles.docBtn, { borderColor: theme.primary, backgroundColor: theme.primary + '10' }]}
                                            onPress={() => handleVerComprobante(selectedPago)}
                                        >
                                            <Ionicons name="document-text-outline" size={20} color={theme.primary} />
                                            <Text style={{ color: theme.primary, fontWeight: '600', marginLeft: 8 }}>Ver Comprobante</Text>
                                        </TouchableOpacity>
                                        <View style={[styles.divider, { backgroundColor: theme.border }]} />
                                    </>
                                )}

                                {/* Verificación */}
                                {selectedPago.estado === 'verificado' && selectedPago.verificado_por_nombre && (
                                    <>
                                        <Text style={[styles.sectionTitle, { color: theme.text }]}>Verificado Por</Text>
                                        <View style={{ padding: 12, borderRadius: 10, backgroundColor: theme.success + '10', borderWidth: 1, borderColor: theme.success, marginBottom: 15 }}>
                                            <Text style={{ color: theme.success, fontWeight: '700' }}>
                                                {selectedPago.verificado_por_nombre} {selectedPago.verificado_por_apellido}
                                            </Text>
                                            <Text style={{ color: theme.textMuted, fontSize: 12 }}>
                                                Fecha: {formatDate(selectedPago.fecha_verificacion)}
                                            </Text>
                                        </View>
                                    </>
                                )}

                                {/* Observaciones */}
                                {selectedPago.observaciones && (
                                    <View style={{ padding: 12, borderRadius: 10, backgroundColor: theme.warning + '10', borderWidth: 1, borderColor: theme.warning, marginBottom: 15 }}>
                                        <Text style={{ color: theme.warning, fontWeight: '700', marginBottom: 4 }}>Observaciones</Text>
                                        <Text style={{ color: theme.text }}>{selectedPago.observaciones}</Text>
                                    </View>
                                )}

                                {/* Acciones */}
                                {selectedPago.estado === 'pagado' && (
                                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                                        <TouchableOpacity
                                            style={[styles.bigActionBtn, { backgroundColor: theme.success + '15', borderColor: theme.success, flex: 1 }]}
                                            onPress={() => handleVerificarPago(selectedPago)}
                                            disabled={procesando}
                                        >
                                            {procesando ? (
                                                <ActivityIndicator color={theme.success} />
                                            ) : (
                                                <>
                                                    <Ionicons name="checkmark-circle" size={20} color={theme.success} />
                                                    <Text style={{ color: theme.success, fontWeight: '700', marginLeft: 6 }}>Verificar</Text>
                                                </>
                                            )}
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.bigActionBtn, { backgroundColor: theme.danger + '15', borderColor: theme.danger, flex: 1 }]}
                                            onPress={() => handleRechazarPago(selectedPago)}
                                            disabled={procesando}
                                        >
                                            <Ionicons name="close-circle" size={20} color={theme.danger} />
                                            <Text style={{ color: theme.danger, fontWeight: '700', marginLeft: 6 }}>Rechazar</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                <View style={{ height: 40 }} />
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

            {/* MODAL RECHAZO */}
            <Modal visible={showRechazoModal} transparent animationType="fade" onRequestClose={() => setShowRechazoModal(false)}>
                <View style={[styles.modalOverlay, { justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)' }]}>
                    <View style={[styles.modalCard, { backgroundColor: theme.cardBg, height: 'auto', padding: 30, borderRadius: 20 }]}>
                        <Text style={[styles.modalTitle, { color: theme.text, textAlign: 'center', marginBottom: 15 }]}>
                            Rechazar Pago
                        </Text>
                        <Text style={{ color: theme.textSecondary, marginBottom: 15, textAlign: 'center' }}>
                            Ingrese el motivo del rechazo
                        </Text>
                        <TextInput
                            style={[styles.textArea, { backgroundColor: theme.bg, color: theme.text, borderColor: theme.border }]}
                            placeholder="Motivo del rechazo..."
                            placeholderTextColor={theme.textMuted}
                            multiline
                            numberOfLines={4}
                            value={motivoRechazo}
                            onChangeText={setMotivoRechazo}
                        />
                        <View style={{ flexDirection: 'row', gap: 15, marginTop: 10 }}>
                            <TouchableOpacity
                                style={{ flex: 1, padding: 12, borderWidth: 1, borderColor: theme.border, borderRadius: 10, alignItems: 'center' }}
                                onPress={() => setShowRechazoModal(false)}
                            >
                                <Text style={{ color: theme.text }}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={{ flex: 1, padding: 12, backgroundColor: theme.danger, borderRadius: 10, alignItems: 'center' }}
                                onPress={confirmarRechazo}
                                disabled={procesando}
                            >
                                {procesando ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold' }}>Rechazar</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* MODAL COMPROBANTE */}
            <Modal visible={showComprobanteModal} transparent onRequestClose={() => setShowComprobanteModal(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' }}>
                    <TouchableOpacity style={{ position: 'absolute', top: 40, right: 20, zIndex: 10 }} onPress={() => setShowComprobanteModal(false)}>
                        <Ionicons name="close-circle" size={30} color="#fff" />
                    </TouchableOpacity>
                    {comprobanteUrl ? (
                        <Image
                            source={{ uri: comprobanteUrl }}
                            style={{ width: width, height: 500 }}
                            resizeMode="contain"
                        />
                    ) : null}
                </View>
            </Modal>
        </View>
    );
}

const DetailItem = ({ label, value, theme, isCurrency }: any) => (
    <View style={{ marginBottom: 10 }}>
        <Text style={{ fontSize: 11, color: theme.textMuted, marginBottom: 2 }}>{label}</Text>
        <Text style={{ fontSize: isCurrency ? 16 : 14, color: isCurrency ? theme.primary : theme.text, fontWeight: isCurrency ? '700' : '500' }}>
            {value}
        </Text>
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1 },
    summaryCard: {
        paddingTop: 25,
        paddingBottom: 25,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5
    },
    headerTitle: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 4 },
    headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
    searchContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, height: 44 },
    searchInput: { flex: 1, color: '#fff', paddingHorizontal: 10, fontSize: 15 },
    filterTab: { paddingBottom: 4, borderBottomWidth: 2, marginRight: 15 },
    filterTabActive: { borderBottomWidth: 2 },
    filterText: { color: '#fff', fontSize: 13 },

    alertBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        marginHorizontal: 20,
        marginTop: 15,
        borderRadius: 12,
        borderWidth: 1
    },
    alertIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative'
    },
    alertBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        backgroundColor: '#dc2626',
        borderRadius: 10,
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center'
    },

    listContent: { padding: 20, paddingBottom: 100 },
    card: {
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        marginBottom: 12,
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
    studentName: { fontSize: 16, fontWeight: '700' },
    estadoBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, gap: 4 },
    estadoText: { fontSize: 10, fontWeight: '700' },
    divider: { height: 1, width: '100%', marginVertical: 10 },
    pickerContainer: { borderRadius: 8, borderWidth: 1, overflow: 'hidden' },
    infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    pagoInfo: { flexDirection: 'row', gap: 15, marginTop: 10 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, gap: 6 },

    loader: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.1)' },
    emptyContainer: { alignItems: 'center', justifyContent: 'center', padding: 40 },
    emptyText: { marginTop: 10, fontSize: 15 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalCard: { height: '90%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    modalTitle: { fontSize: 18, fontWeight: 'bold' },
    estadoBadgeLarge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 2 },
    sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10, marginTop: 5 },
    detailGrid: { marginBottom: 10 },
    docBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 15 },
    bigActionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
    textArea: { height: 100, borderWidth: 1, borderRadius: 12, paddingHorizontal: 15, paddingTop: 12, fontSize: 15, textAlignVertical: 'top', marginBottom: 20 },
});
