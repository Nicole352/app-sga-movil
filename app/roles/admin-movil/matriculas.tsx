import React, { useState, useEffect, useCallback } from 'react';
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
    Linking,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { WebView } from 'react-native-webview';
import Pagination from './components/Pagination';
import { API_URL } from '../../../constants/config';
import { getToken, getDarkMode, getUserData } from '../../../services/storage';
import { eventEmitter } from '../../../services/eventEmitter';

const { width } = Dimensions.get('window');

interface Solicitud {
    id_solicitud: number;
    codigo_solicitud: string;
    nombre_solicitante: string;
    apellido_solicitante: string;
    identificacion_solicitante?: string;
    email_solicitante: string;
    telefono_solicitante?: string;
    fecha_nacimiento_solicitante?: string;
    direccion_solicitante?: string;
    genero_solicitante?: string;
    contacto_emergencia?: string;
    curso_nombre?: string;
    tipo_curso_nombre?: string;
    horario_preferido?: string;
    monto_matricula: number;
    metodo_pago: string;
    numero_comprobante?: string;
    banco_comprobante?: string;
    fecha_transferencia?: string;
    recibido_por?: string;
    comprobante_pago_url?: string;
    documento_identificacion_url?: string;
    certificado_cosmetologia_url?: string;
    documento_estatus_legal_url?: string;
    estado: 'pendiente' | 'aprobado' | 'rechazado' | 'observaciones';
    fecha_solicitud: string;
    observaciones_admin?: string;
    // Auxiliares para mapeo defensivo
    curso?: { nombre: string };
}

export default function AdminMatriculasScreen() {
    const [darkMode, setDarkMode] = useState(false);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
    const [filteredSolicitudes, setFilteredSolicitudes] = useState<Solicitud[]>([]);

    // Filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [filterEstado, setFilterEstado] = useState<string>('pendiente');

    // Paginación
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Modales
    const [selectedSolicitud, setSelectedSolicitud] = useState<Solicitud | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);

    // Acciones y Estados
    const [detailLoading, setDetailLoading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [inputObservacion, setInputObservacion] = useState('');
    const [showActionModal, setShowActionModal] = useState(false);
    const [actionType, setActionType] = useState<'aprobado' | 'rechazado' | null>(null);

    // Visor de Archivos
    const [archivoPreview, setArchivoPreview] = useState<{
        url: string;
        titulo: string;
        tipo: 'image' | 'pdf' | 'otro';
    } | null>(null);

    const theme = darkMode ? {
        bg: '#0a0a0a',
        cardBg: '#141414',
        text: '#ffffff',
        textSecondary: '#a1a1aa',
        textMuted: '#71717a',
        border: '#27272a',
        primary: '#ef4444',
        inputBg: '#18181b',
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
            fetchSolicitudes();
        }, [])
    );

    useEffect(() => {
        const themeHandler = (isDark: boolean) => setDarkMode(isDark);
        eventEmitter.on('themeChanged', themeHandler);
        getDarkMode().then(setDarkMode);
        return () => { eventEmitter.off('themeChanged', themeHandler); };
    }, []);

    useEffect(() => {
        filterData();
    }, [searchTerm, filterEstado, solicitudes]);

    const fetchSolicitudes = async () => {
        try {
            const token = await getToken();
            if (!token) return;
            const response = await fetch(`${API_URL}/solicitudes?limit=100`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                const items = Array.isArray(data) ? data : (data.rows || data.data || []);
                setSolicitudes(items);
            }
        } catch (error) {
            console.error('Error fetching solicitudes:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const filterData = () => {
        let result = solicitudes;
        if (filterEstado !== 'todos') {
            result = result.filter(s => s.estado === filterEstado);
        }
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(s =>
                (s.nombre_solicitante || '').toLowerCase().includes(term) ||
                (s.apellido_solicitante || '').toLowerCase().includes(term) ||
                (s.identificacion_solicitante || '').includes(term) ||
                (s.email_solicitante || '').toLowerCase().includes(term)
            );
        }
        setFilteredSolicitudes(result);
        setCurrentPage(1); // Reset to page 1
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchSolicitudes();
    };

    const handleCall = (phone?: string) => {
        if (phone) Linking.openURL(`tel:${phone}`);
    };

    const handleEmail = (email: string) => {
        if (email) Linking.openURL(`mailto:${email}`);
    };

    const handleOpenDetail = async (item: Solicitud) => {
        setShowDetailModal(true);
        setSelectedSolicitud(item);
        setDetailLoading(true);

        try {
            const token = await getToken();
            const res = await fetch(`${API_URL}/solicitudes/${item.id_solicitud}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const fullData = await res.json();
                setSelectedSolicitud(prev => ({ ...prev, ...fullData }));
            }
        } catch (e) {
            console.error('Error fetching detail', e);
        } finally {
            setDetailLoading(false);
        }
    };

    const handleAction = (type: 'aprobado' | 'rechazado') => {
        setActionType(type);
        setInputObservacion('');
        // Cerrar el modal de detalle primero para evitar problemas de modales apilados
        setShowDetailModal(false);
        // Delay para que el modal de detalle se cierre completamente
        setTimeout(() => {
            setShowActionModal(true);
        }, 300);
    };

    const submitDecision = async () => {
        if (!selectedSolicitud || !actionType) return;
        try {
            setProcessing(true);
            const token = await getToken();

            let url = '';
            let method = '';
            let body = {};

            if (actionType === 'aprobado') {
                // Obtener el ID del usuario logueado para aprobado_por
                let aprobadoPor = 1; // Fallback
                try {
                    const userData = await getUserData();
                    if (userData?.id_usuario) {
                        aprobadoPor = userData.id_usuario;
                    }
                } catch (e) {
                    console.error('Error obteniendo usuario:', e);
                }

                url = `${API_URL}/estudiantes/crear-desde-solicitud`;
                method = 'POST';
                body = {
                    id_solicitud: selectedSolicitud.id_solicitud,
                    aprobado_por: aprobadoPor
                };
            } else if (actionType === 'rechazado') {
                url = `${API_URL}/solicitudes/${selectedSolicitud.id_solicitud}/decision`;
                method = 'PATCH';
                body = { estado: 'rechazado', observaciones: inputObservacion || null };
            }

            const response = await fetch(url, {
                method,
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (response.ok) {
                await response.json();
                Alert.alert('Éxito', `Solicitud ${actionType === 'aprobado' ? 'aprobada' : 'rechazada'} correctamente.`);
                setShowActionModal(false);
                await fetchSolicitudes();
            } else {
                const errorText = await response.text();
                Alert.alert('Error', `No se pudo procesar la solicitud: ${errorText}`);
            }
        } catch (e: any) {
            Alert.alert('Error', `Error de red: ${e.message || 'Desconocido'}`);
        } finally {
            setProcessing(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pendiente': return theme.warning;
            case 'aprobado': return theme.success;
            case 'rechazado': return theme.danger;
            case 'observaciones': return theme.warning;
            default: return theme.textMuted;
        }
    };

    const getInitials = (nombre: string, apellido: string) => {
        return `${nombre?.charAt(0) || ''}${apellido?.charAt(0) || ''}`.toUpperCase();
    };

    const handleViewFile = (url: string, titulo: string = 'Documento') => {
        if (!url) return;
        const extension = url.split('.').pop()?.split('?')[0].toLowerCase();
        let tipo: 'image' | 'pdf' | 'otro' = 'otro';

        if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension || '')) {
            tipo = 'image';
        } else if (extension === 'pdf') {
            tipo = 'pdf';
        }

        setArchivoPreview({ url, titulo, tipo });
    };

    const formatDate = (d?: string) => {
        if (!d) return 'No especificado';
        return new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

    };

    // Paginación
    const totalPages = Math.ceil(filteredSolicitudes.length / itemsPerPage);
    const paginatedSolicitudes = filteredSolicitudes.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );


    // Render Item List
    const renderItem = ({ item }: { item: Solicitud }) => {
        const color = getStatusColor(item.estado);
        const dateStr = new Date(item.fecha_solicitud).toLocaleDateString();

        return (
            <TouchableOpacity
                style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
                onPress={() => handleOpenDetail(item)}
                activeOpacity={0.8}
            >
                <View style={styles.cardContent}>
                    {/* Avatar / Initials */}
                    <View style={styles.avatarContainer}>
                        <View style={[styles.avatarPlaceholder, { backgroundColor: theme.primary }]}>
                            <Text style={styles.avatarInitial}>{getInitials(item.nombre_solicitante, item.apellido_solicitante)}</Text>
                        </View>
                        <View style={[styles.onlineIndicator, { backgroundColor: color, borderColor: theme.cardBg }]} />
                    </View>

                    <View style={styles.infoContainer}>
                        <Text style={[styles.nameText, { color: theme.text }]} numberOfLines={1}>
                            {item.nombre_solicitante} {item.apellido_solicitante}
                        </Text>
                        <Text style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 2 }}>
                            {item.curso_nombre || item.tipo_curso_nombre || 'Curso General'}
                        </Text>
                        <Text style={{ fontSize: 12, color: theme.textMuted }}>{dateStr}</Text>

                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                            <View style={[styles.badge, { backgroundColor: color + '20' }]}>
                                <Text style={[styles.badgeText, { color: color }]}>{item.estado.toUpperCase()}</Text>
                            </View>
                        </View>
                    </View>

                    <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
                </View>
            </TouchableOpacity>
        );
    };

    // Helper Composable
    const DetailItem = ({ label, value, theme, highlight, isCurrency, fullWidth, iconname }: any) => (
        <View style={[styles.detailCol, fullWidth && { width: '100%' }]}>
            <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>
                {iconname && <Ionicons name={iconname} size={12} color={theme.primary} />} {label}
            </Text>
            <Text style={[styles.detailValue, { color: highlight ? theme.primary : theme.text, fontSize: isCurrency ? 16 : 14, fontWeight: isCurrency || highlight ? '700' : '500' }]}>
                {value}
            </Text>
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.bg }]}>
            {/* --- HEADER CLEAN NIKE EFFECT --- */}
            <View
                style={[
                    styles.summaryCard,
                    {
                        backgroundColor: theme.cardBg,
                        borderBottomColor: theme.border,
                        borderBottomWidth: 1,
                    }
                ]}
            >
                <Text style={[styles.headerTitle, { color: theme.text }]}>Matrículas</Text>
                <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Gestiona y administra las solicitudes</Text>

                {/* Search */}
                <View style={[styles.searchContainer, { backgroundColor: theme.bg, borderColor: theme.border, borderWidth: 1, marginTop: 10 }]}>
                    <Ionicons name="search" size={20} color={theme.textMuted} style={{ marginLeft: 10 }} />
                    <TextInput
                        placeholder="Buscar solicitud..."
                        placeholderTextColor={theme.textMuted}
                        style={[styles.searchInput, { color: theme.text }]}
                        value={searchTerm}
                        onChangeText={setSearchTerm}
                    />
                    {searchTerm.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchTerm('')} style={{ padding: 8 }}>
                            <Ionicons name="close-circle" size={18} color={theme.textMuted} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Filtros Tabs */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 15 }} contentContainerStyle={{ paddingRight: 20 }}>
                    {['todos', 'pendiente', 'aprobado', 'rechazado'].map((f) => (
                        <TouchableOpacity
                            key={f}
                            style={[
                                styles.filterTab,
                                filterEstado === f && styles.filterTabActive,
                                { borderBottomColor: filterEstado === f ? theme.primary : 'transparent' }
                            ]}
                            onPress={() => {
                                if (filterEstado !== f) {
                                    setFilterEstado(f);
                                }
                            }}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            activeOpacity={0.7}
                        >
                            <Text style={[
                                styles.filterText,
                                {
                                    color: filterEstado === f ? theme.primary : theme.textSecondary,
                                    fontWeight: filterEstado === f ? '700' : '500'
                                }
                            ]}>
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <FlatList
                data={paginatedSolicitudes}
                renderItem={renderItem}
                keyExtractor={(item) => item.id_solicitud.toString()}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
                ListEmptyComponent={
                    !loading ? (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="folder-open-outline" size={48} color={theme.textMuted} />
                            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No hay solicitudes</Text>
                        </View>
                    ) : null
                }
                ListFooterComponent={
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={filteredSolicitudes.length}
                        onPageChange={setCurrentPage}
                        theme={theme}
                        itemLabel="solicitudes"
                    />
                }
            />

            {loading && (
                <View style={styles.loader}>
                    <ActivityIndicator size="large" color={theme.primary} />
                </View>
            )}

            {/* MODAL DETALLE PREMIUM */}
            <Modal visible={showDetailModal} animationType="slide" transparent onRequestClose={() => setShowDetailModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalCard, { backgroundColor: theme.cardBg }]}>
                        {/* Header Modal */}
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.text }]}>Detalle Solicitud</Text>
                            <TouchableOpacity onPress={() => setShowDetailModal(false)} style={{ padding: 4 }}>
                                <Ionicons name="close" size={24} color={theme.textMuted} />
                            </TouchableOpacity>
                        </View>

                        {detailLoading ? (
                            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                <ActivityIndicator size="large" color={theme.primary} />
                                <Text style={{ color: theme.textSecondary, marginTop: 10 }}>Cargando expediente...</Text>
                            </View>
                        ) : selectedSolicitud && (
                            <ScrollView style={{ marginTop: 10 }} showsVerticalScrollIndicator={false}>
                                {/* Cabecera Perfil Solicitante */}
                                <View style={{ alignItems: 'center', marginBottom: 20 }}>
                                    <View style={styles.modalAvatarContainer}>
                                        <View style={[styles.modalAvatar, { backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center' }]}>
                                            <Text style={{ color: '#fff', fontSize: 32, fontWeight: '700' }}>
                                                {getInitials(selectedSolicitud.nombre_solicitante, selectedSolicitud.apellido_solicitante)}
                                            </Text>
                                        </View>
                                        <View style={[styles.modalStatusBadge, { backgroundColor: getStatusColor(selectedSolicitud.estado) }]}>
                                            <Ionicons name={selectedSolicitud.estado === 'aprobado' ? "checkmark" : selectedSolicitud.estado === 'rechazado' ? "close" : "time"} size={14} color="#fff" />
                                        </View>
                                    </View>
                                    <Text style={[styles.modalName, { color: theme.text }]}>{selectedSolicitud.nombre_solicitante} {selectedSolicitud.apellido_solicitante}</Text>
                                    <Text style={{ color: theme.textSecondary, fontSize: 14 }}>{selectedSolicitud.email_solicitante}</Text>
                                    <View style={[styles.badge, { backgroundColor: getStatusColor(selectedSolicitud.estado) + '20', marginTop: 8 }]}>
                                        <Text style={{ color: getStatusColor(selectedSolicitud.estado), fontWeight: '700', textTransform: 'uppercase' }}>{selectedSolicitud.estado}</Text>
                                    </View>

                                    {/* COMMUNICATION ACTIONS ROW - PREMIUM DESIGN */}
                                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 15, justifyContent: 'center' }}>
                                        <TouchableOpacity
                                            style={[styles.miniActionBtn, { backgroundColor: '#10b98115', paddingLeft: 6, paddingRight: 16 }]}
                                            onPress={() => handleCall(selectedSolicitud.telefono_solicitante)}
                                        >
                                            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#10b981', justifyContent: 'center', alignItems: 'center' }}>
                                                <Ionicons name="call" size={16} color="#fff" />
                                            </View>
                                            <Text style={{ fontSize: 13, color: '#10b981', fontWeight: '700' }}>Llamar</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[styles.miniActionBtn, { backgroundColor: '#3b82f615', paddingLeft: 6, paddingRight: 16 }]}
                                            onPress={() => handleEmail(selectedSolicitud.email_solicitante)}
                                        >
                                            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center' }}>
                                                <Ionicons name="mail" size={16} color="#fff" />
                                            </View>
                                            <Text style={{ fontSize: 13, color: '#3b82f6', fontWeight: '700' }}>Email</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* ACCIONES PRINCIPALES (Solo Pendiente) */}
                                {selectedSolicitud.estado === 'pendiente' && (
                                    <View style={styles.quickActions}>
                                        <TouchableOpacity style={[styles.quickBtn, { backgroundColor: theme.success + '20' }]} onPress={() => handleAction('aprobado')}>
                                            <Ionicons name="checkmark-circle" size={24} color={theme.success} />
                                            <Text style={{ fontSize: 11, color: theme.success, marginTop: 4, fontWeight: 'bold' }}>Aprobar</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[styles.quickBtn, { backgroundColor: theme.danger + '20' }]} onPress={() => handleAction('rechazado')}>
                                            <Ionicons name="close-circle" size={24} color={theme.danger} />
                                            <Text style={{ fontSize: 11, color: theme.danger, marginTop: 4, fontWeight: 'bold' }}>Rechazar</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                <View style={[styles.divider, { backgroundColor: theme.border }]} />

                                {/* DATOS GRID */}
                                <View style={styles.gridContainer}>
                                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Información Personal</Text>
                                    <View style={styles.row}>
                                        <DetailItem label="Identificación" value={selectedSolicitud.identificacion_solicitante} theme={theme} />
                                        <DetailItem label="Teléfono" value={selectedSolicitud.telefono_solicitante || 'No especificado'} theme={theme} />
                                    </View>
                                    <View style={styles.row}>
                                        <DetailItem label="Dirección" value={selectedSolicitud.direccion_solicitante || 'No especificado'} theme={theme} />
                                        <DetailItem label="Contacto Emergencia" value={selectedSolicitud.contacto_emergencia || selectedSolicitud.telefono_solicitante} theme={theme} highlight />
                                    </View>
                                    <View style={styles.row}>
                                        <DetailItem label="F. Nacimiento" value={formatDate(selectedSolicitud.fecha_nacimiento_solicitante)} theme={theme} fullWidth />
                                    </View>

                                    <View style={[styles.divider, { backgroundColor: theme.border, opacity: 0.5 }]} />

                                    <Text style={[styles.sectionTitle, { color: theme.text }]}>Curso y Pago</Text>
                                    <View style={styles.row}>
                                        <DetailItem label="Curso Interés" value={selectedSolicitud.curso_nombre || selectedSolicitud.tipo_curso_nombre} theme={theme} highlight />
                                        <DetailItem label="Horario" value={selectedSolicitud.horario_preferido || 'No definido'} theme={theme} />
                                    </View>
                                    <View style={styles.row}>
                                        <DetailItem label="Monto" value={`$${Number(selectedSolicitud.monto_matricula || (selectedSolicitud as any).monto || 0).toFixed(2)}`} theme={theme} isCurrency />
                                        <DetailItem label="Método Pago" value={selectedSolicitud.metodo_pago} theme={theme} />
                                    </View>

                                    {/* COMPROBANTE BOX - CONDICIONAL SEGÚN MÉTODO */}
                                    <View style={{ marginTop: 10, padding: 12, borderRadius: 10, backgroundColor: theme.inputBg }}>
                                        <Text style={{ color: theme.textSecondary, fontSize: 12, marginBottom: 8, fontWeight: '600' }}>Detalle Transacción</Text>

                                        {/* Número de Comprobante (siempre) */}
                                        {selectedSolicitud.numero_comprobante && (
                                            <View style={{ marginBottom: 8 }}>
                                                <Text style={{ color: theme.textSecondary, fontSize: 11, marginBottom: 2 }}>Número de Comprobante</Text>
                                                <View style={{ backgroundColor: theme.danger + '20', padding: 6, borderRadius: 6, borderWidth: 1, borderColor: theme.danger + '30' }}>
                                                    <Text style={{ color: theme.danger, fontWeight: '700' }}>{selectedSolicitud.numero_comprobante}</Text>
                                                </View>
                                            </View>
                                        )}

                                        {/* Si es EFECTIVO: mostrar Recibido Por */}
                                        {selectedSolicitud.metodo_pago === 'efectivo' && (selectedSolicitud as any).recibido_por && (
                                            <View>
                                                <Text style={{ color: theme.textSecondary, fontSize: 11, marginBottom: 2 }}>Recibido por</Text>
                                                <View style={{ backgroundColor: theme.warning + '20', padding: 6, borderRadius: 6, borderWidth: 1, borderColor: theme.warning + '30' }}>
                                                    <Text style={{ color: theme.warning, fontWeight: '700' }}>{(selectedSolicitud as any).recibido_por}</Text>
                                                </View>
                                            </View>
                                        )}

                                        {/* Si es TRANSFERENCIA: mostrar Banco y Fecha */}
                                        {selectedSolicitud.metodo_pago === 'transferencia' && (
                                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                                {selectedSolicitud.banco_comprobante && (
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={{ color: theme.textSecondary, fontSize: 11, marginBottom: 2 }}>Banco</Text>
                                                        <Text style={{ color: theme.text, fontWeight: '600' }}>{selectedSolicitud.banco_comprobante}</Text>
                                                    </View>
                                                )}
                                                {selectedSolicitud.fecha_transferencia && (
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={{ color: theme.textSecondary, fontSize: 11, marginBottom: 2 }}>Fecha</Text>
                                                        <Text style={{ color: theme.text, fontWeight: '600' }}>{formatDate(selectedSolicitud.fecha_transferencia)}</Text>
                                                    </View>
                                                )}
                                            </View>
                                        )}
                                    </View>
                                </View>

                                <View style={[styles.divider, { backgroundColor: theme.border }]} />

                                {/* DOCUMENTOS (EVIDENCIA) */}
                                <Text style={[styles.sectionTitle, { color: theme.text }]}>Evidencias</Text>
                                <View style={styles.docsContainer}>
                                    {selectedSolicitud.comprobante_pago_url ? (
                                        <TouchableOpacity
                                            style={[styles.docBtn, { borderColor: theme.success, backgroundColor: theme.success + '10' }]}
                                            onPress={() => handleViewFile(selectedSolicitud.comprobante_pago_url!, `Comprobante: ${selectedSolicitud.numero_comprobante || 'S/N'}`)}
                                        >
                                            <Ionicons name="receipt-outline" size={20} color={theme.success} />
                                            <Text style={{ color: theme.success, fontWeight: '600' }}>Ver Comprobante</Text>
                                        </TouchableOpacity>
                                    ) : <Text style={{ color: theme.textMuted }}>No hay comprobante</Text>}

                                    {selectedSolicitud.documento_identificacion_url ? (
                                        <TouchableOpacity
                                            style={[styles.docBtn, { borderColor: '#3b82f6', backgroundColor: '#3b82f610' }]}
                                            onPress={() => handleViewFile(selectedSolicitud.documento_identificacion_url!, 'Identificación')}
                                        >
                                            <Ionicons name="card-outline" size={20} color="#3b82f6" />
                                            <Text style={{ color: '#3b82f6', fontWeight: '600' }}>Identificación</Text>
                                        </TouchableOpacity>
                                    ) : <Text style={{ color: theme.textMuted }}>No hay identificación</Text>}

                                    {selectedSolicitud.documento_estatus_legal_url && (
                                        <TouchableOpacity
                                            style={[styles.docBtn, { borderColor: '#8b5cf6', backgroundColor: '#8b5cf610' }]}
                                            onPress={() => handleViewFile(selectedSolicitud.documento_estatus_legal_url!, 'Estatus Legal')}
                                        >
                                            <Ionicons name="document-text-outline" size={20} color="#8b5cf6" />
                                            <Text style={{ color: '#8b5cf6', fontWeight: '600' }}>Estatus Legal</Text>
                                        </TouchableOpacity>
                                    )}

                                    {selectedSolicitud.certificado_cosmetologia_url && (
                                        <TouchableOpacity
                                            style={[styles.docBtn, { borderColor: '#ec4899', backgroundColor: '#ec489910' }]}
                                            onPress={() => handleViewFile(selectedSolicitud.certificado_cosmetologia_url!, 'Certificado')}
                                        >
                                            <Ionicons name="ribbon-outline" size={20} color="#ec4899" />
                                            <Text style={{ color: '#ec4899', fontWeight: '600' }}>Certificado</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>

                                {selectedSolicitud.observaciones_admin && (
                                    <View style={{ marginTop: 20, padding: 15, backgroundColor: theme.warning + '15', borderRadius: 12, borderLeftWidth: 4, borderLeftColor: theme.warning }}>
                                        <Text style={{ color: theme.warning, fontWeight: 'bold', marginBottom: 4 }}>Observaciones Anteriores</Text>
                                        <Text style={{ color: theme.text }}>{selectedSolicitud.observaciones_admin}</Text>
                                    </View>
                                )}

                                <View style={{ height: 40 }} />
                            </ScrollView>
                        )}

                        {/* VISOR DE ARCHIVOS INTEGRADO (PARA ESTAR ENCIMA DEL CONTENIDO DEL MODAL) */}
                        {archivoPreview && (
                            <View style={[styles.absoluteVisor, { borderTopLeftRadius: 24, borderTopRightRadius: 24 }]}>
                                <View style={styles.visorHeader}>
                                    <TouchableOpacity onPress={() => setArchivoPreview(null)} style={styles.visorHeaderBtn}>
                                        <Ionicons name="close" size={28} color="#fff" />
                                    </TouchableOpacity>

                                    <View style={{ flex: 1, alignItems: 'center' }}>
                                        <Text style={styles.visorTitle} numberOfLines={1}>
                                            {archivoPreview.titulo}
                                        </Text>
                                        {archivoPreview.titulo.includes('Comprobante') && (
                                            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10 }}>Desliza o usa el botón para cerrar</Text>
                                        )}
                                    </View>

                                    <TouchableOpacity
                                        onPress={() => Linking.openURL(archivoPreview.url)}
                                        style={styles.visorHeaderBtn}
                                    >
                                        <Ionicons name="download-outline" size={24} color="#fff" />
                                    </TouchableOpacity>
                                </View>

                                <View style={{ flex: 1, backgroundColor: '#000' }}>
                                    {archivoPreview.tipo === 'image' ? (
                                        <Image
                                            source={{ uri: archivoPreview.url }}
                                            style={{ width: '100%', height: '100%' }}
                                            resizeMode="contain"
                                        />
                                    ) : archivoPreview.tipo === 'pdf' ? (
                                        <WebView
                                            source={{ uri: archivoPreview.url }}
                                            style={{ flex: 1 }}
                                            scalesPageToFit
                                        />
                                    ) : (
                                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                                            <Ionicons name="document-text" size={80} color={theme.border} />
                                            <Text style={{ color: '#fff', textAlign: 'center', marginTop: 20, fontSize: 16 }}>
                                                La vista previa no está disponible.
                                            </Text>
                                            <TouchableOpacity
                                                style={styles.visorActionBtn}
                                                onPress={() => Linking.openURL(archivoPreview.url)}
                                            >
                                                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Abrir Externamente</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>

            {/* MODAL ACTION CONFIRMATION */}
            <Modal visible={showActionModal} transparent animationType="fade" onRequestClose={() => setShowActionModal(false)}>
                <View style={[styles.modalOverlay, { justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 99999, elevation: 99999 }]}>
                    <View style={[styles.modalCard, { backgroundColor: theme.cardBg, height: 'auto', padding: 30, borderRadius: 20, zIndex: 100000, elevation: 100000, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20 }]}>
                        <Text style={[styles.modalTitle, { color: theme.text, textAlign: 'center', marginBottom: 15 }]}>
                            {actionType === 'aprobado' ? '¿Aprobar Matrícula?' : 'Rechazar Matrícula'}
                        </Text>

                        {actionType !== 'aprobado' && (
                            <TextInput
                                style={[styles.textArea, { backgroundColor: theme.bg, color: theme.text, borderColor: theme.border }]}
                                placeholder="Escribe el motivo..."
                                placeholderTextColor={theme.textMuted}
                                multiline
                                numberOfLines={4}
                                value={inputObservacion}
                                onChangeText={setInputObservacion}
                            />
                        )}

                        <View style={{ flexDirection: 'row', gap: 15, marginTop: 10 }}>
                            <TouchableOpacity style={{ flex: 1, padding: 12, borderWidth: 1, borderColor: theme.border, borderRadius: 10, alignItems: 'center' }} onPress={() => setShowActionModal(false)}>
                                <Text style={{ color: theme.text }}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={{ flex: 1, padding: 12, backgroundColor: actionType === 'rechazado' ? theme.danger : actionType === 'aprobado' ? theme.success : theme.warning, borderRadius: 10, alignItems: 'center' }}
                                onPress={submitDecision}
                                disabled={processing}
                            >
                                {processing ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold' }}>Confirmar</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    summaryCard: {
        marginBottom: 16,
        paddingTop: 25,
        paddingBottom: 25,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3
    },
    headerTitle: { fontSize: 24, fontWeight: '700', marginBottom: 4 },
    headerSubtitle: { fontSize: 13, marginBottom: 12 },
    searchContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, height: 44, marginBottom: 15 },
    searchInput: { flex: 1, paddingHorizontal: 10, fontSize: 15 },

    filterTab: {
        paddingBottom: 4,
        borderBottomWidth: 2,
        marginRight: 15,
    },
    filterTabActive: {
        borderBottomWidth: 2,
    },
    filterText: {
        fontSize: 14,
    },

    listContent: { padding: 20, paddingBottom: 100 },
    card: {
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        marginBottom: 12,
        shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1
    },
    cardContent: { flexDirection: 'row', alignItems: 'center' },
    avatarContainer: { position: 'relative', marginRight: 15 },
    avatarPlaceholder: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
    avatarInitial: { color: '#fff', fontSize: 18, fontWeight: '700' },
    onlineIndicator: { width: 12, height: 12, borderRadius: 6, position: 'absolute', bottom: 0, right: 0, borderWidth: 2 },

    infoContainer: { flex: 1 },
    nameText: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
    badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start' },
    badgeText: { fontSize: 10, fontWeight: '700' },

    loader: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.1)' },
    emptyContainer: { alignItems: 'center', justifyContent: 'center', padding: 40 },
    emptyText: { marginTop: 10, fontSize: 15 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalCard: { height: '90%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    modalTitle: { fontSize: 18, fontWeight: 'bold' },

    modalAvatarContainer: { position: 'relative', marginBottom: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
    modalAvatar: { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: '#fff' },
    modalStatusBadge: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
    modalName: { fontSize: 20, fontWeight: '700', textAlign: 'center' },

    sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10, marginTop: 5 },

    gridContainer: {},
    row: { flexDirection: 'row', gap: 15, marginBottom: 12 },
    detailCol: { flex: 1 },
    detailLabel: { fontSize: 12, marginBottom: 4 },
    detailValue: { fontSize: 14 },

    divider: { height: 1, width: '100%', marginVertical: 15 },

    quickActions: { flexDirection: 'row', justifyContent: 'center', gap: 15, marginTop: 15 },
    quickBtn: { width: 80, height: 70, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },

    docsContainer: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    docBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },

    textArea: { height: 100, borderWidth: 1, borderRadius: 12, paddingHorizontal: 15, paddingTop: 12, fontSize: 15, textAlignVertical: 'top' },

    miniActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderRadius: 25 },

    // Absolute Visor Styles
    absoluteVisor: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000',
        zIndex: 9999, // Super alto para estar encima de modales
    },
    visorHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingTop: Platform.OS === 'ios' ? 50 : 30,
        paddingBottom: 15,
        backgroundColor: 'rgba(0,0,0,0.8)',
    },
    visorHeaderBtn: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.1)'
    },
    visorTitle: {
        color: '#fff',
        fontSize: 15,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    visorActionBtn: {
        marginTop: 20,
        backgroundColor: '#ef4444',
        paddingHorizontal: 25,
        paddingVertical: 12,
        borderRadius: 25,
    }
});
