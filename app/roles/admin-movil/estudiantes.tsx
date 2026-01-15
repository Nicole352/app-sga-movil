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
    Image,
    Linking,
    Dimensions,
    Alert,
    ScrollView,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { WebView } from 'react-native-webview';
import Pagination from './components/Pagination';
import { API_URL } from '../../../constants/config';
import { getToken, getDarkMode } from '../../../services/storage';
import { eventEmitter } from '../../../services/eventEmitter';

const { width } = Dimensions.get('window');

interface Curso {
    id_curso: number;
    nombre: string;
    codigo_curso: string;
    horario: string;
    estado: string;
}

interface Estudiante {
    id_usuario: number;
    identificacion: string;
    nombre: string;
    apellido: string;
    username: string;
    email: string;
    telefono?: string;
    fecha_nacimiento?: string;
    genero?: 'masculino' | 'femenino' | 'otro';
    direccion?: string;
    estado: 'activo' | 'inactivo' | 'pendiente';
    fecha_registro: string;
    fecha_ultima_conexion?: string;
    foto_perfil?: string | null;
    contacto_emergencia?: string;
    tipo_documento?: 'ecuatoriano' | 'extranjero';
    documento_identificacion_url?: string;
    documento_estatus_legal_url?: string;
    certificado_cosmetologia_url?: string;
    cursos?: Curso[];
}

export default function AdminEstudiantesScreen() {
    const router = useRouter();
    const [darkMode, setDarkMode] = useState(false);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Datos
    const [estudiantes, setEstudiantes] = useState<Estudiante[]>([]);
    const [filteredEstudiantes, setFilteredEstudiantes] = useState<Estudiante[]>([]);
    const [stats, setStats] = useState({ total: 0, activos: 0, inactivos: 0 });

    // Filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [filterEstado, setFilterEstado] = useState<string>('todos');

    // Paginación
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Modal Detalle
    const [selectedEst, setSelectedEst] = useState<Estudiante | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);

    // Modal Acción (Cambio de Estado)
    const [showActionModal, setShowActionModal] = useState(false);
    const [actionType, setActionType] = useState<'activar' | 'desactivar' | null>(null);
    const [processingAction, setProcessingAction] = useState(false);

    // Visor de Archivos
    const [archivoPreview, setArchivoPreview] = useState<{
        url: string;
        titulo: string;
        tipo: 'image' | 'pdf' | 'otro';
    } | null>(null);

    // TEMA
    const theme = darkMode ? {
        bg: '#0a0a0a',
        cardBg: '#141414',
        text: '#ffffff',
        textSecondary: '#a1a1aa',
        textMuted: '#71717a',
        border: '#27272a',
        primary: '#ef4444',
        success: '#10b981',
        danger: '#ef4444',
        warning: '#f59e0b',
        inputBg: '#18181b',
    } : {
        bg: '#f8fafc',
        cardBg: '#ffffff',
        text: '#0f172a',
        textSecondary: '#475569',
        textMuted: '#64748b',
        border: '#e2e8f0',
        primary: '#ef4444',
        success: '#059669',
        danger: '#dc2626',
        warning: '#d97706',
        inputBg: '#ffffff',
    };

    useFocusEffect(
        useCallback(() => {
            fetchEstudiantes();
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
    }, [searchTerm, filterEstado, estudiantes]);

    const fetchEstudiantes = async () => {
        try {
            const token = await getToken();
            if (!token) return;

            // Fetch listado general
            const response = await fetch(`${API_URL}/estudiantes?limit=200`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                const items = Array.isArray(data) ? data : (data.items || data.rows || []);
                setEstudiantes(items);

                // Calcular Stats
                const total = items.length;
                const activos = items.filter((e: Estudiante) => e.estado === 'activo').length;
                setStats({ total, activos, inactivos: total - activos });
            }
        } catch (error) {
            console.error('Error cargando estudiantes:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const filterData = () => {
        let result = estudiantes;
        if (filterEstado !== 'todos') {
            result = result.filter(e => e.estado === filterEstado);
        }
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter(e =>
                e.nombre?.toLowerCase().includes(term) ||
                e.apellido?.toLowerCase().includes(term) ||
                e.identificacion?.includes(term) ||
                e.email?.toLowerCase().includes(term)
            );
        }
        setFilteredEstudiantes(result);
        setCurrentPage(1); // Reset to page 1 when filters change
    };

    const handleOpenDetail = async (estudiante: Estudiante) => {
        setShowModal(true);
        setSelectedEst(estudiante); // Mostrar data parcial inmediatamente
        setDetailLoading(true);

        // Fetch detalle completo para obtener cursos y documentos
        try {
            const token = await getToken();
            const response = await fetch(`${API_URL}/estudiantes/${estudiante.id_usuario}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.ok) {
                const fullData = await response.json();
                console.log('Detalle Estudiante:', fullData);
                setSelectedEst(prev => ({ ...prev, ...fullData }));
            }
        } catch (error) {
            console.error('Error fetching detalle estudiante:', error);
        } finally {
            setDetailLoading(false);
        }
    };

    const handleActionRequest = (type: 'activar' | 'desactivar') => {
        setActionType(type);
        // Cerrar el modal de detalle primero para evitar problemas de modales apilados
        setShowModal(false);
        // Delay para que el modal de detalle se cierre completamente
        setTimeout(() => {
            setShowActionModal(true);
        }, 300);
    };

    const executeAction = async () => {
        if (!selectedEst || !actionType) return;
        setProcessingAction(true);
        try {
            const token = await getToken();
            const nuevoEstado = actionType === 'activar' ? 'activo' : 'inactivo';
            const response = await fetch(`${API_URL}/usuarios/${selectedEst.id_usuario}/estado`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ estado: nuevoEstado })
            });

            if (response.ok) {
                Alert.alert('Éxito', `Estudiante ${actionType === 'activar' ? 'activado' : 'desactivado'} correctamente.`);
                setShowActionModal(false);
                setShowModal(false);
                fetchEstudiantes(); // Recargar lista
            } else {
                const err = await response.text();
                Alert.alert('Error', err || 'No se pudo cambiar el estado');
            }
        } catch (error) {
            Alert.alert('Error', 'Error de red al cambiar estado');
        } finally {
            setProcessingAction(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchEstudiantes();
    };

    const getInitials = (nombre: string, apellido: string) => {
        return `${nombre?.charAt(0) || ''}${apellido?.charAt(0) || ''}`.toUpperCase();
    };

    const handleCall = (phone?: string) => {
        if (phone) Linking.openURL(`tel:${phone}`);
    };

    const handleEmail = (email: string) => {
        if (email) Linking.openURL(`mailto:${email}`);
    };

    const handleViewDocument = (url?: string, titulo: string = 'Documento') => {
        if (!url) return;
        const extension = url.toLowerCase().split('.').pop()?.split('?')[0];
        let tipo: 'image' | 'pdf' | 'otro' = 'otro';

        if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension || '')) {
            tipo = 'image';
        } else if (extension === 'pdf') {
            tipo = 'pdf';
        }

        setArchivoPreview({ url, titulo, tipo });
    };

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    // Paginación
    const totalPages = Math.ceil(filteredEstudiantes.length / itemsPerPage);
    const paginatedEstudiantes = filteredEstudiantes.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const renderItem = ({ item }: { item: Estudiante }) => {
        const isActivo = item.estado === 'activo';
        const statusColor = isActivo ? theme.success : (item.estado === 'pendiente' ? theme.warning : theme.danger);

        return (
            <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}
                onPress={() => handleOpenDetail(item)}
            >
                <View style={styles.cardContent}>
                    {/* Avatar */}
                    <View style={styles.avatarContainer}>
                        {item.foto_perfil ? (
                            <Image source={{ uri: item.foto_perfil }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatarPlaceholder, { backgroundColor: theme.primary }]}>
                                <Text style={styles.avatarInitial}>{getInitials(item.nombre, item.apellido)}</Text>
                            </View>
                        )}
                        <View style={[styles.onlineIndicator, { backgroundColor: statusColor, borderColor: theme.cardBg }]} />
                    </View>

                    {/* Info */}
                    <View style={styles.infoContainer}>
                        <Text style={[styles.nameText, { color: theme.text }]} numberOfLines={1}>
                            {item.apellido} {item.nombre}
                        </Text>
                        <Text style={[styles.idText, { color: theme.textSecondary }]}>
                            ID: {item.identificacion}
                        </Text>
                        <Text style={{ fontSize: 12, color: theme.textMuted }}>{item.email}</Text>

                        {/* Badges Inline */}
                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                            <View style={[styles.badge, { backgroundColor: `${statusColor}20` }]}>
                                <Text style={[styles.badgeText, { color: statusColor }]}>{item.estado.toUpperCase()}</Text>
                            </View>
                        </View>
                    </View>

                    <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
                </View>
            </TouchableOpacity>
        );
    };

    // Componente Helper para filas del modal
    const DetailItem = ({ label, value, theme, iconname, isLink, onPress }: any) => (
        <TouchableOpacity
            disabled={!isLink}
            onPress={onPress}
            style={[styles.detailCol, isLink && { backgroundColor: theme.bg, padding: 8, borderRadius: 8, borderWidth: 1, borderColor: theme.border }]}
        >
            <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>
                {iconname && <Ionicons name={iconname} size={12} color={theme.primary} />} {label}
            </Text>
            <Text style={[styles.detailValue, { color: isLink ? theme.primary : theme.text, fontWeight: isLink ? '700' : '500' }]}>
                {value} {isLink && <Ionicons name="open-outline" size={12} />}
            </Text>
        </TouchableOpacity>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.bg }]}>
            {/* Header / Summary Card (Clean Nike Effect) */}
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
                <Text style={[styles.headerTitle, { color: theme.text }]}>Estudiantes</Text>
                <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Gestiona y administra los estudiantes</Text>

                {/* Search */}
                <View style={[styles.searchContainer, { backgroundColor: theme.bg, borderColor: theme.border, borderWidth: 1 }]}>
                    <Ionicons name="search" size={20} color={theme.textMuted} style={{ marginLeft: 10 }} />
                    <TextInput
                        placeholder="Buscar por nombre, CI, email..."
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

                {/* Filtros Botones */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 15 }} contentContainerStyle={{ gap: 6 }}>
                    {['todos', 'activo', 'inactivo', 'pendiente'].map((f) => (
                        <TouchableOpacity
                            key={f}
                            style={[
                                styles.filterButton,
                                {
                                    backgroundColor: filterEstado === f ? theme.primary : theme.inputBg,
                                    borderColor: filterEstado === f ? theme.primary : theme.border,
                                }
                            ]}
                            onPress={() => setFilterEstado(f)}
                        >
                            <Text style={[
                                styles.filterButtonText,
                                {
                                    color: filterEstado === f ? '#fff' : theme.text,
                                    fontWeight: filterEstado === f ? '700' : '600'
                                }
                            ]}>
                                {f.charAt(0).toUpperCase() + f.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* List */}
            <FlatList
                data={paginatedEstudiantes}
                renderItem={renderItem}
                keyExtractor={(item) => item.id_usuario.toString()}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
                ListEmptyComponent={!loading ? (
                    <View style={styles.emptyContainer}>
                        <Ionicons name="people-outline" size={48} color={theme.textMuted} />
                        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No se encontraron estudiantes</Text>
                    </View>
                ) : null}
                ListFooterComponent={
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={filteredEstudiantes.length}
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
            <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalCard, { backgroundColor: theme.cardBg }]}>
                        {/* Header Modal */}
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.text }]}>Perfil Estudiante</Text>
                            <TouchableOpacity onPress={() => setShowModal(false)} style={{ padding: 4 }}>
                                <Ionicons name="close" size={24} color={theme.textMuted} />
                            </TouchableOpacity>
                        </View>

                        {selectedEst && (
                            <ScrollView style={{ marginTop: 10 }} showsVerticalScrollIndicator={false}>
                                {/* Cabecera Perfil */}
                                <View style={{ alignItems: 'center', marginBottom: 20 }}>
                                    <View style={styles.modalAvatarContainer}>
                                        {selectedEst.foto_perfil ? (
                                            <Image source={{ uri: selectedEst.foto_perfil }} style={styles.modalAvatar} />
                                        ) : (
                                            <View style={[styles.modalAvatar, { backgroundColor: theme.primary, justifyContent: 'center', alignItems: 'center' }]}>
                                                <Text style={{ color: '#fff', fontSize: 32, fontWeight: '700' }}>{getInitials(selectedEst.nombre, selectedEst.apellido)}</Text>
                                            </View>
                                        )}
                                        <View style={[styles.modalStatusBadge, { backgroundColor: selectedEst.estado === 'activo' ? theme.success : theme.danger }]}>
                                            <Ionicons name={selectedEst.estado === 'activo' ? "checkmark" : "ban"} size={12} color="#fff" />
                                        </View>
                                    </View>
                                    <Text style={[styles.modalName, { color: theme.text }]}>{selectedEst.nombre} {selectedEst.apellido}</Text>
                                    <Text style={{ color: theme.textSecondary, fontSize: 14 }}>@{selectedEst.username}</Text>
                                </View>

                                {/* Acciones Rápidas */}
                                <View style={styles.quickActions}>
                                    <TouchableOpacity style={[styles.quickBtn, { backgroundColor: theme.success + '20' }]} onPress={() => handleCall(selectedEst.telefono)}>
                                        <Ionicons name="call" size={20} color={theme.success} />
                                        <Text style={{ fontSize: 10, color: theme.success, marginTop: 4, fontWeight: '600' }}>Llamar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.quickBtn, { backgroundColor: '#3b82f620' }]} onPress={() => handleEmail(selectedEst.email)}>
                                        <Ionicons name="mail" size={20} color="#3b82f6" />
                                        <Text style={{ fontSize: 10, color: '#3b82f6', marginTop: 4, fontWeight: '600' }}>Email</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.quickBtn, { backgroundColor: (selectedEst.estado === 'activo' ? theme.danger : theme.success) + '20' }]}
                                        onPress={() => handleActionRequest(selectedEst.estado === 'activo' ? 'desactivar' : 'activar')}
                                    >
                                        <Ionicons name={selectedEst.estado === 'activo' ? "power" : "play"} size={20} color={selectedEst.estado === 'activo' ? theme.danger : theme.success} />
                                        <Text style={{ fontSize: 10, color: selectedEst.estado === 'activo' ? theme.danger : theme.success, marginTop: 4, fontWeight: '600' }}>
                                            {selectedEst.estado === 'activo' ? 'Desactivar' : 'Activar'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={[styles.divider, { backgroundColor: theme.border }]} />

                                {/* Detalles Grid 2 Columnas */}
                                <View style={styles.gridContainer}>
                                    <View style={styles.row}>
                                        <DetailItem label="Identificación" value={selectedEst.identificacion} theme={theme} />
                                        <DetailItem label="Teléfono" value={selectedEst.telefono || 'N/A'} theme={theme} />
                                    </View>
                                    <View style={styles.row}>
                                        <DetailItem label="F. Nacimiento" value={formatDate(selectedEst.fecha_nacimiento)} theme={theme} />
                                        <DetailItem label="Género" value={selectedEst.genero || 'N/A'} theme={theme} />
                                    </View>
                                    <View style={styles.row}>
                                        <DetailItem label="Dirección" value={selectedEst.direccion || 'SD'} theme={theme} />
                                        <DetailItem label="Fecha Registro" value={formatDate(selectedEst.fecha_registro)} theme={theme} />
                                    </View>
                                    {selectedEst.tipo_documento && (
                                        <View style={styles.row}>
                                            <DetailItem label="Tipo Documento" value={selectedEst.tipo_documento === 'extranjero' ? 'Extranjero' : 'Ecuatoriano'} theme={theme} iconname="document-text-outline" />
                                        </View>
                                    )}
                                    <View style={styles.fullRow}>
                                        <DetailItem label="Contacto Emergencia" value={selectedEst.contacto_emergencia || 'No registrado'} theme={theme} iconname="warning-outline" />
                                    </View>
                                </View>

                                <View style={[styles.divider, { backgroundColor: theme.border }]} />

                                {/* Documentos */}
                                <Text style={[styles.sectionTitle, { color: theme.text }]}>Documentos</Text>
                                {detailLoading ? (
                                    <ActivityIndicator color={theme.primary} style={{ marginVertical: 10 }} />
                                ) : (
                                    <View style={styles.docsContainer}>
                                        {selectedEst.documento_identificacion_url ? (
                                            <DetailItem
                                                label={selectedEst.tipo_documento === 'extranjero' ? 'Pasaporte' : 'Cédula'}
                                                value="Ver Documento"
                                                theme={theme}
                                                isLink
                                                onPress={() => handleViewDocument(selectedEst.documento_identificacion_url, selectedEst.tipo_documento === 'extranjero' ? 'Pasaporte' : 'Cédula')}
                                            />
                                        ) : <Text style={{ color: theme.textMuted, fontStyle: 'italic' }}>Sin identificación</Text>}

                                        {selectedEst.documento_estatus_legal_url && (
                                            <DetailItem
                                                label="Estatus Legal"
                                                value="Ver Archivo"
                                                theme={theme}
                                                isLink
                                                onPress={() => handleViewDocument(selectedEst.documento_estatus_legal_url, 'Estatus Legal')}
                                            />
                                        )}

                                        {selectedEst.certificado_cosmetologia_url && (
                                            <DetailItem
                                                label="Certificado"
                                                value="Ver Archivo"
                                                theme={theme}
                                                isLink
                                                onPress={() => handleViewDocument(selectedEst.certificado_cosmetologia_url, 'Certificado')}
                                            />
                                        )}
                                    </View>
                                )}

                                <View style={[styles.divider, { backgroundColor: theme.border }]} />

                                {/* Cursos (Si hay) */}
                                <Text style={[styles.sectionTitle, { color: theme.text }]}>Cursos Inscritos</Text>
                                {selectedEst.cursos && selectedEst.cursos.length > 0 ? (
                                    selectedEst.cursos.map((c, i) => (
                                        <View key={i} style={[styles.cursoItem, { backgroundColor: theme.bg, borderColor: theme.border }]}>
                                            <View>
                                                <Text style={{ fontWeight: 'bold', color: theme.text }}>{c.nombre}</Text>
                                                <Text style={{ fontSize: 12, color: theme.textSecondary }}>{c.codigo_curso} • {c.horario}</Text>
                                            </View>
                                            <View style={[styles.badge, { backgroundColor: c.estado === 'activo' ? theme.success + '20' : theme.textMuted + '20' }]}>
                                                <Text style={{ color: c.estado === 'activo' ? theme.success : theme.textMuted, fontSize: 10, fontWeight: '700' }}>{c.estado}</Text>
                                            </View>
                                        </View>
                                    ))
                                ) : (
                                    <Text style={{ color: theme.textMuted, fontStyle: 'italic', marginBottom: 20 }}>No está inscrito en cursos</Text>
                                )}

                                <View style={{ height: 40 }} />
                            </ScrollView>
                        )}

                        {/* VISOR DE ARCHIVOS INTEGRADO */}
                        {archivoPreview && (
                            <View style={[styles.absoluteVisor, { borderTopLeftRadius: 24, borderTopRightRadius: 24 }]}>
                                <View style={styles.visorHeader}>
                                    <TouchableOpacity onPress={() => setArchivoPreview(null)} style={styles.visorHeaderBtn}>
                                        <Ionicons name="arrow-back" size={24} color="#fff" />
                                    </TouchableOpacity>

                                    <View style={{ flex: 1, alignItems: 'center' }}>
                                        <Text style={styles.visorTitle} numberOfLines={1}>
                                            {archivoPreview.titulo}
                                        </Text>
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

            {/* Modal Confirmación Acción */}
            <Modal visible={showActionModal} transparent animationType="fade" onRequestClose={() => setShowActionModal(false)}>
                <View style={[styles.modalOverlay, { justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)' }]}>
                    <View style={[styles.modalCard, { backgroundColor: theme.cardBg, height: 'auto', padding: 30 }]}>
                        <Text style={[styles.modalTitle, { color: theme.text, textAlign: 'center', marginBottom: 10 }]}>Confirmar Acción</Text>
                        <Text style={{ color: theme.textSecondary, textAlign: 'center', marginBottom: 25 }}>
                            ¿Estás seguro que deseas <Text style={{ fontWeight: 'bold', color: actionType === 'desactivar' ? theme.danger : theme.success }}>{actionType?.toUpperCase()}</Text> al estudiante {selectedEst?.nombre}?
                        </Text>

                        <View style={{ flexDirection: 'row', gap: 15 }}>
                            <TouchableOpacity style={{ flex: 1, padding: 12, borderWidth: 1, borderColor: theme.border, borderRadius: 10, alignItems: 'center' }} onPress={() => setShowActionModal(false)}>
                                <Text style={{ color: theme.text }}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={{ flex: 1, padding: 12, backgroundColor: actionType === 'desactivar' ? theme.danger : theme.success, borderRadius: 10, alignItems: 'center' }}
                                onPress={executeAction}
                                disabled={processingAction}
                            >
                                {processingAction ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold' }}>Confirmar</Text>}
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
        marginBottom: 4,
        paddingTop: 16,
        paddingBottom: 16,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3
    },
    headerTitle: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
    headerSubtitle: { fontSize: 13, marginBottom: 12 },

    searchContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, height: 44, marginBottom: 15 },
    searchInput: { flex: 1, paddingHorizontal: 10, fontSize: 15 },

    filterButton: {
        paddingHorizontal: 13,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1,
        minWidth: 90,
        alignItems: 'center'
    },
    filterButtonText: { fontSize: 12.5, textAlign: 'center', fontWeight: '600' },

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
    avatar: { width: 50, height: 50, borderRadius: 25 },
    avatarPlaceholder: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
    avatarInitial: { color: '#fff', fontSize: 18, fontWeight: '700' },
    onlineIndicator: { width: 12, height: 12, borderRadius: 6, position: 'absolute', bottom: 0, right: 0, borderWidth: 2 },

    infoContainer: { flex: 1 },
    nameText: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
    idText: { fontSize: 13 },
    badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start' },
    badgeText: { fontSize: 10, fontWeight: '700' },

    loader: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.1)' },
    emptyContainer: { alignItems: 'center', justifyContent: 'center', padding: 40 },
    emptyText: { marginTop: 10, fontSize: 15 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    modalCard: { height: '90%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    modalTitle: { fontSize: 18, fontWeight: 'bold' },

    modalAvatarContainer: { position: 'relative', marginBottom: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
    modalAvatar: { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: '#fff' },
    modalStatusBadge: { position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
    modalName: { fontSize: 22, fontWeight: '700', textAlign: 'center' },

    // Grid System
    gridContainer: {},
    row: { flexDirection: 'row', gap: 15, marginBottom: 15 },
    fullRow: { marginBottom: 15 },
    detailCol: { flex: 1 },
    detailLabel: { fontSize: 12, marginBottom: 4 },
    detailValue: { fontSize: 14 },

    divider: { height: 1, width: '100%', marginVertical: 15 },
    sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },

    quickActions: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 10 },
    quickBtn: { width: 70, height: 60, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },

    docsContainer: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    cursoItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 8, borderWidth: 1, marginBottom: 8 },

    // Paginación
    paginationContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        marginHorizontal: 20,
        marginTop: 15,
        marginBottom: 20,
        borderRadius: 12,
        borderWidth: 1,
    },
    pageButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    pageInfo: {
        alignItems: 'center',
    },

    // Absolute Visor Styles
    absoluteVisor: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000',
        zIndex: 9999,
    },
    visorHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingTop: Platform.OS === 'ios' ? 20 : 10,
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
        fontSize: 16,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    visorActionBtn: {
        marginTop: 20,
        backgroundColor: '#ef4444',
        paddingHorizontal: 25,
        paddingVertical: 12,
        borderRadius: 25,
    },
});
