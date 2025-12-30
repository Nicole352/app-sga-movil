import { View, Text, ScrollView, TouchableOpacity, Image, TextInput, Alert, StyleSheet, RefreshControl, Modal, Dimensions } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { API_URL } from '../../../constants/config';
import { getToken, storage } from '../../../services/storage';
import { eventEmitter } from '../../../services/eventEmitter';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

interface AdminData {
    id_usuario: number;
    cedula?: string;
    nombre: string;
    apellido: string;
    email: string;
    telefono?: string;
    direccion?: string;
    fecha_nacimiento?: string;
    genero?: string;
    rol: string;
    estado: string;
    foto_perfil?: string;
}

export default function PerfilAdmin() {
    const [darkMode, setDarkMode] = useState(false);
    const [activeTab, setActiveTab] = useState<'info' | 'password'>('info');
    const [admin, setAdmin] = useState<AdminData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<Partial<AdminData>>({});
    const [fotoUrl, setFotoUrl] = useState<string | null>(null);
    const [showPhotoPreview, setShowPhotoPreview] = useState(false);

    // Estados contraseña
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [passwordData, setPasswordData] = useState({
        password_actual: '',
        password_nueva: '',
        confirmar_password: ''
    });

    // RED THEME for Admin
    const theme = darkMode
        ? {
            bg: '#0a0a0a',
            cardBg: '#141414',
            text: '#ffffff',
            textSecondary: '#a1a1aa',
            textMuted: '#71717a',
            border: '#27272a',
            accent: '#ef4444',
            primaryGradient: ['#ef4444', '#dc2626'] as const,
            inputBg: '#18181b',
            success: '#10b981',
        }
        : {
            bg: '#f8fafc',
            cardBg: '#ffffff',
            text: '#0f172a',
            textSecondary: '#475569',
            textMuted: '#64748b',
            border: '#e2e8f0',
            accent: '#ef4444',
            primaryGradient: ['#ef4444', '#dc2626'] as const,
            inputBg: '#f1f5f9',
            success: '#059669',
        };

    useEffect(() => {
        const loadDarkMode = async () => {
            const savedMode = await storage.getItem('dark_mode');
            if (savedMode !== null) {
                setDarkMode(savedMode === 'true');
            }
        };

        loadDarkMode();
        fetchPerfil();

        const handleThemeChange = (isDark: boolean) => setDarkMode(isDark);
        const handleProfilePhotoUpdate = () => fetchPerfil();

        eventEmitter.on('themeChanged', handleThemeChange);
        eventEmitter.on('profilePhotoUpdated', handleProfilePhotoUpdate);

        return () => {
            eventEmitter.off('themeChanged', handleThemeChange);
            eventEmitter.off('profilePhotoUpdated', handleProfilePhotoUpdate);
        };
    }, []);

    const fetchPerfil = async () => {
        try {
            setLoading(true);
            const token = await getToken();
            const response = await fetch(`${API_URL}/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setAdmin(data);
                setFormData({
                    nombre: data.nombre || '',
                    apellido: data.apellido || '',
                    email: data.email || '',
                    telefono: data.telefono || '',
                    direccion: data.direccion || '',
                    fecha_nacimiento: data.fecha_nacimiento ? data.fecha_nacimiento.split('T')[0] : '',
                    genero: data.genero || ''
                });
                if (data.foto_perfil) {
                    setFotoUrl(data.foto_perfil);
                }
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchPerfil();
    };

    const handleSave = async () => {
        try {
            const token = await getToken();
            if (!token) return;

            const response = await fetch(`${API_URL}/usuarios/mi-perfil`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                await fetchPerfil();
                setIsEditing(false);
                Alert.alert('Éxito', 'Perfil actualizado correctamente');
            } else {
                const error = await response.json();
                Alert.alert('Error', error.message || 'No se pudo actualizar el perfil');
            }
        } catch (error) {
            console.error('Error:', error);
            Alert.alert('Error', 'Error al actualizar el perfil');
        }
    };

    const handleChangePassword = async () => {
        if (!passwordData.password_actual || !passwordData.password_nueva || !passwordData.confirmar_password) {
            Alert.alert('Error', 'Todos los campos son obligatorios');
            return;
        }

        if (passwordData.password_nueva.length < 8) {
            Alert.alert('Error', 'La contraseña debe tener al menos 8 caracteres');
            return;
        }

        if (passwordData.password_nueva !== passwordData.confirmar_password) {
            Alert.alert('Error', 'Las contraseñas no coinciden');
            return;
        }

        try {
            const token = await getToken();
            const response = await fetch(`${API_URL}/usuarios/cambiar-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    password_actual: passwordData.password_actual,
                    password_nueva: passwordData.password_nueva,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                Alert.alert('Éxito', 'Contraseña cambiada correctamente');
                setPasswordData({
                    password_actual: '',
                    password_nueva: '',
                    confirmar_password: ''
                });
            } else {
                Alert.alert('Error', data.message || 'No se pudo cambiar la contraseña');
            }
        } catch (error) {
            Alert.alert('Error', 'Error al cambiar la contraseña');
        }
    };

    const getInitials = () => {
        if (!admin) return '?';
        const nombre = admin.nombre || '';
        const apellido = admin.apellido || '';
        return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase();
    };

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: theme.bg }]}>
                <Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 40 }}>Cargando perfil...</Text>
            </View>
        );
    }

    if (!admin) {
        return (
            <View style={[styles.container, { backgroundColor: theme.bg }]}>
                <Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 40 }}>No se pudo cargar el perfil</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.bg }]}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
                }
            >
                {/* RED GRADIENT HEADER */}
                <Animated.View entering={FadeInDown.duration(400)}>
                    <LinearGradient
                        colors={theme.primaryGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.header}
                    >
                        <View style={styles.headerContent}>
                            <View>
                                <Text style={styles.headerTitle}>Mi Perfil</Text>
                                <Text style={styles.headerSubtitle}>Gestiona tu información</Text>
                            </View>
                            <Ionicons name="shield-checkmark" size={32} color="#fff" />
                        </View>

                        {/* AVATAR */}
                        <TouchableOpacity
                            style={styles.avatarContainer}
                            onPress={() => setShowPhotoPreview(true)}
                        >
                            {fotoUrl ? (
                                <Image source={{ uri: fotoUrl }} style={styles.avatar} />
                            ) : (
                                <View style={[styles.avatarPlaceholder, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                                    <Text style={styles.avatarText}>{getInitials()}</Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        <Text style={styles.userName}>
                            {admin.nombre} {admin.apellido}
                        </Text>
                        <Text style={styles.userRole}>Administrativo</Text>
                    </LinearGradient>
                </Animated.View>

                {/* ANIMATED TABS */}
                <View style={[styles.tabsContainer, { backgroundColor: theme.bg }]}>
                    <TouchableOpacity
                        style={[
                            styles.tab,
                            {
                                backgroundColor: activeTab === 'info' ? theme.accent : theme.inputBg,
                                borderColor: activeTab === 'info' ? theme.accent : theme.border,
                            }
                        ]}
                        onPress={() => setActiveTab('info')}
                    >
                        <Ionicons
                            name="person"
                            size={18}
                            color={activeTab === 'info' ? '#fff' : theme.textMuted}
                        />
                        <Text style={[
                            styles.tabText,
                            { color: activeTab === 'info' ? '#fff' : theme.textMuted }
                        ]}>
                            Información
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.tab,
                            {
                                backgroundColor: activeTab === 'password' ? theme.accent : theme.inputBg,
                                borderColor: activeTab === 'password' ? theme.accent : theme.border,
                            }
                        ]}
                        onPress={() => setActiveTab('password')}
                    >
                        <Ionicons
                            name="lock-closed"
                            size={18}
                            color={activeTab === 'password' ? '#fff' : theme.textMuted}
                        />
                        <Text style={[
                            styles.tabText,
                            { color: activeTab === 'password' ? '#fff' : theme.textMuted }
                        ]}>
                            Seguridad
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* TAB CONTENT */}
                <View style={styles.content}>
                    {activeTab === 'info' ? (
                        <Animated.View entering={FadeInUp.duration(300)}>
                            {/* Read-Only Info Card */}
                            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                                <View style={styles.cardHeader}>
                                    <Ionicons name="shield-checkmark" size={20} color={theme.accent} />
                                    <Text style={[styles.cardTitle, { color: theme.text }]}>Información del Sistema</Text>
                                </View>
                                {admin.cedula && (
                                    <View style={styles.infoRow}>
                                        <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Identificación</Text>
                                        <Text style={[styles.infoValue, { color: theme.text }]}>
                                            {admin.cedula}
                                        </Text>
                                    </View>
                                )}
                                <View style={styles.infoRow}>
                                    <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Estado</Text>
                                    <Text style={[styles.infoValue, { color: theme.success, fontWeight: '700' }]}>
                                        {admin.estado || 'Activo'}
                                    </Text>
                                </View>
                            </View>

                            {/* Editable Info Card */}
                            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                                <View style={styles.cardHeader}>
                                    <Ionicons name="person-outline" size={20} color={theme.accent} />
                                    <Text style={[styles.cardTitle, { color: theme.text }]}>Información Personal</Text>
                                    {!isEditing && (
                                        <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.editButton}>
                                            <Ionicons name="create-outline" size={20} color={theme.accent} />
                                        </TouchableOpacity>
                                    )}
                                </View>

                                <View style={styles.formGrid}>
                                    <View style={styles.inputGroup}>
                                        <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Nombre</Text>
                                        <TextInput
                                            style={[
                                                styles.input,
                                                {
                                                    backgroundColor: isEditing ? theme.inputBg : 'transparent',
                                                    borderColor: theme.border,
                                                    color: theme.text
                                                }
                                            ]}
                                            value={formData.nombre || ''}
                                            onChangeText={(text) => setFormData({ ...formData, nombre: text })}
                                            editable={isEditing}
                                            placeholder="Nombre"
                                            placeholderTextColor={theme.textMuted}
                                        />
                                    </View>

                                    <View style={styles.inputGroup}>
                                        <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Apellido</Text>
                                        <TextInput
                                            style={[
                                                styles.input,
                                                {
                                                    backgroundColor: isEditing ? theme.inputBg : 'transparent',
                                                    borderColor: theme.border,
                                                    color: theme.text
                                                }
                                            ]}
                                            value={formData.apellido || ''}
                                            onChangeText={(text) => setFormData({ ...formData, apellido: text })}
                                            editable={isEditing}
                                            placeholder="Apellido"
                                            placeholderTextColor={theme.textMuted}
                                        />
                                    </View>

                                    <View style={styles.inputGroup}>
                                        <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Email</Text>
                                        <TextInput
                                            style={[
                                                styles.input,
                                                {
                                                    backgroundColor: isEditing ? theme.inputBg : 'transparent',
                                                    borderColor: theme.border,
                                                    color: theme.text
                                                }
                                            ]}
                                            value={formData.email || ''}
                                            onChangeText={(text) => setFormData({ ...formData, email: text })}
                                            editable={isEditing}
                                            placeholder="Email"
                                            placeholderTextColor={theme.textMuted}
                                            keyboardType="email-address"
                                        />
                                    </View>

                                    <View style={styles.inputGroup}>
                                        <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Teléfono</Text>
                                        <TextInput
                                            style={[
                                                styles.input,
                                                {
                                                    backgroundColor: isEditing ? theme.inputBg : 'transparent',
                                                    borderColor: theme.border,
                                                    color: theme.text
                                                }
                                            ]}
                                            value={formData.telefono || ''}
                                            onChangeText={(text) => setFormData({ ...formData, telefono: text })}
                                            editable={isEditing}
                                            placeholder="Teléfono"
                                            placeholderTextColor={theme.textMuted}
                                            keyboardType="phone-pad"
                                        />
                                    </View>

                                    <View style={styles.inputGroup}>
                                        <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Dirección</Text>
                                        <TextInput
                                            style={[
                                                styles.input,
                                                {
                                                    backgroundColor: isEditing ? theme.inputBg : 'transparent',
                                                    borderColor: theme.border,
                                                    color: theme.text
                                                }
                                            ]}
                                            value={formData.direccion || ''}
                                            onChangeText={(text) => setFormData({ ...formData, direccion: text })}
                                            editable={isEditing}
                                            placeholder="Dirección"
                                            placeholderTextColor={theme.textMuted}
                                        />
                                    </View>

                                    {formData.fecha_nacimiento && (
                                        <View style={styles.inputGroup}>
                                            <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Fecha de Nacimiento</Text>
                                            <View style={[styles.input, { backgroundColor: 'transparent', borderColor: theme.border, justifyContent: 'center' }]}>
                                                <Text style={{ color: theme.text }}>
                                                    {new Date(formData.fecha_nacimiento).toLocaleDateString()}
                                                </Text>
                                            </View>
                                        </View>
                                    )}

                                    {formData.genero && (
                                        <View style={styles.inputGroup}>
                                            <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Género</Text>
                                            <View style={[styles.input, { backgroundColor: 'transparent', borderColor: theme.border, justifyContent: 'center' }]}>
                                                <Text style={{ color: theme.text, textTransform: 'capitalize' }}>
                                                    {formData.genero}
                                                </Text>
                                            </View>
                                        </View>
                                    )}
                                </View>

                                {isEditing && (
                                    <View style={styles.buttonRow}>
                                        <TouchableOpacity
                                            style={[styles.button, styles.cancelButton, { borderColor: theme.border }]}
                                            onPress={() => {
                                                setIsEditing(false);
                                                fetchPerfil();
                                            }}
                                        >
                                            <Text style={[styles.buttonText, { color: theme.textSecondary }]}>Cancelar</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.button, styles.saveButton, { backgroundColor: theme.accent }]}
                                            onPress={handleSave}
                                        >
                                            <Ionicons name="checkmark-circle" size={18} color="#fff" />
                                            <Text style={[styles.buttonText, { color: '#fff' }]}>Guardar</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        </Animated.View>
                    ) : (
                        <Animated.View entering={FadeInUp.duration(300)}>
                            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                                <View style={styles.cardHeader}>
                                    <Ionicons name="lock-closed-outline" size={20} color={theme.accent} />
                                    <Text style={[styles.cardTitle, { color: theme.text }]}>Cambiar Contraseña</Text>
                                </View>

                                <View style={styles.inputGroup}>
                                    <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Contraseña Actual</Text>
                                    <View style={styles.passwordContainer}>
                                        <TextInput
                                            style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text, flex: 1 }]}
                                            value={passwordData.password_actual}
                                            onChangeText={(text) => setPasswordData({ ...passwordData, password_actual: text })}
                                            secureTextEntry={!showCurrentPassword}
                                            placeholder="••••••••"
                                            placeholderTextColor={theme.textMuted}
                                        />
                                        <TouchableOpacity
                                            style={styles.eyeButton}
                                            onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                                        >
                                            <Ionicons
                                                name={showCurrentPassword ? 'eye-off' : 'eye'}
                                                size={20}
                                                color={theme.textMuted}
                                            />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <View style={styles.inputGroup}>
                                    <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Nueva Contraseña</Text>
                                    <View style={styles.passwordContainer}>
                                        <TextInput
                                            style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text, flex: 1 }]}
                                            value={passwordData.password_nueva}
                                            onChangeText={(text) => setPasswordData({ ...passwordData, password_nueva: text })}
                                            secureTextEntry={!showNewPassword}
                                            placeholder="Mínimo 8 caracteres"
                                            placeholderTextColor={theme.textMuted}
                                        />
                                        <TouchableOpacity
                                            style={styles.eyeButton}
                                            onPress={() => setShowNewPassword(!showNewPassword)}
                                        >
                                            <Ionicons
                                                name={showNewPassword ? 'eye-off' : 'eye'}
                                                size={20}
                                                color={theme.textMuted}
                                            />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <View style={styles.inputGroup}>
                                    <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Confirmar Nueva Contraseña</Text>
                                    <View style={styles.passwordContainer}>
                                        <TextInput
                                            style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text, flex: 1 }]}
                                            value={passwordData.confirmar_password}
                                            onChangeText={(text) => setPasswordData({ ...passwordData, confirmar_password: text })}
                                            secureTextEntry={!showConfirmPassword}
                                            placeholder="Repite la contraseña"
                                            placeholderTextColor={theme.textMuted}
                                        />
                                        <TouchableOpacity
                                            style={styles.eyeButton}
                                            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                                        >
                                            <Ionicons
                                                name={showConfirmPassword ? 'eye-off' : 'eye'}
                                                size={20}
                                                color={theme.textMuted}
                                            />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={[styles.button, styles.saveButton, { backgroundColor: theme.accent, marginTop: 8 }]}
                                    onPress={handleChangePassword}
                                >
                                    <Ionicons name="shield-checkmark" size={18} color="#fff" />
                                    <Text style={[styles.buttonText, { color: '#fff' }]}>Cambiar Contraseña</Text>
                                </TouchableOpacity>
                            </View>
                        </Animated.View>
                    )}
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* Photo Preview Modal */}
            <Modal visible={showPhotoPreview} transparent animationType="fade">
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowPhotoPreview(false)}
                >
                    <View style={styles.modalContent}>
                        {fotoUrl ? (
                            <Image source={{ uri: fotoUrl }} style={styles.modalImage} />
                        ) : (
                            <View style={[styles.modalImagePlaceholder, { backgroundColor: theme.accent }]}>
                                <Text style={styles.modalImageText}>{getInitials()}</Text>
                            </View>
                        )}
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { paddingTop: 60, paddingBottom: 100, paddingHorizontal: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, alignItems: 'center' },
    headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 24 },
    headerTitle: { fontSize: 24, fontWeight: '700', color: '#fff' },
    headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 4 },
    avatarContainer: { marginBottom: 16 },
    avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: '#fff' },
    avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: '#fff', justifyContent: 'center', alignItems: 'center' },
    avatarText: { fontSize: 36, fontWeight: '700', color: '#fff' },
    userName: { fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 4 },
    userRole: { fontSize: 14, color: 'rgba(255,255,255,0.9)' },
    tabsContainer: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginTop: -40, zIndex: 10 },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
    tabText: { fontSize: 14, fontWeight: '600' },
    content: { padding: 16 },
    card: { borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
    cardTitle: { fontSize: 16, fontWeight: '700', flex: 1 },
    editButton: { padding: 4 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
    infoLabel: { fontSize: 13 },
    infoValue: { fontSize: 14, fontWeight: '600' },
    formGrid: { gap: 12 },
    inputGroup: { marginBottom: 12 },
    inputLabel: { fontSize: 12, marginBottom: 4, fontWeight: '600' },
    input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14 },
    buttonRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
    button: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8, gap: 8 },
    cancelButton: { borderWidth: 1, backgroundColor: 'transparent' },
    saveButton: {},
    buttonText: { fontSize: 14, fontWeight: '600' },
    passwordContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    eyeButton: { position: 'absolute', right: 10, padding: 8 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { width: '80%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
    modalImage: { width: '100%', height: '100%', borderRadius: 20 },
    modalImagePlaceholder: { width: '100%', height: '100%', borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    modalImageText: { fontSize: 80, fontWeight: '700', color: '#fff' }
});
