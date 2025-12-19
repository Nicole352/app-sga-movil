import { View, Text, ScrollView, TouchableOpacity, Image, TextInput, Alert, StyleSheet, RefreshControl, Modal, Dimensions } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { API_URL } from '../../../constants/config';
import { getToken, storage } from '../../../services/storage';
import { eventEmitter } from '../../../services/eventEmitter';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

interface EstudianteData {
  id_usuario: number;
  nombres: string;
  apellidos: string;
  nombre?: string;
  apellido?: string;
  identificacion: string;
  cedula?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  fecha_nacimiento?: string;
  genero?: string;
  username: string;
  rol?: string;
  estado?: string;
  foto_perfil?: string;
  contacto_emergencia?: string;
}

export default function PerfilEstudiante() {
  const [darkMode, setDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'password'>('info');
  const [estudiante, setEstudiante] = useState<EstudianteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<EstudianteData>>({});
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [showPhotoPreview, setShowPhotoPreview] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    password_actual: '',
    password_nueva: '',
    confirmar_password: ''
  });

  const theme = darkMode
    ? {
      bg: '#0f172a',
      cardBg: '#1e293b',
      text: '#f8fafc',
      textSecondary: '#cbd5e1',
      textMuted: '#94a3b8',
      border: '#334155',
      accent: '#fbbf24',
      primaryGradient: ['#f59e0b', '#d97706'] as const,
      inputBg: '#334155',
      success: '#10b981',
    }
    : {
      bg: '#f8fafc',
      cardBg: '#ffffff',
      text: '#0f172a',
      textSecondary: '#475569',
      textMuted: '#64748b',
      border: '#e2e8f0',
      accent: '#f59e0b',
      primaryGradient: ['#fbbf24', '#f59e0b'] as const,
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

    const handleThemeChange = (isDark: boolean) => {
      setDarkMode(isDark);
    };

    const handleProfilePhotoUpdate = () => {
      fetchPerfil();
    };

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

      if (!token) {
        Alert.alert('Error', 'Sesión expirada. Por favor, inicia sesión nuevamente.');
        return;
      }

      const response = await fetch(`${API_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setEstudiante(data);

        if (data.foto_perfil) {
          setFotoUrl(data.foto_perfil);
        } else {
          setFotoUrl(null);
        }

        setFormData({
          nombres: data.nombres || data.nombre || '',
          apellidos: data.apellidos || data.apellido || '',
          email: data.email || '',
          telefono: data.telefono || '',
          direccion: data.direccion || '',
          fecha_nacimiento: data.fecha_nacimiento ? data.fecha_nacimiento.split('T')[0] : '',
          genero: data.genero || '',
          identificacion: data.identificacion || data.cedula || '',
          contacto_emergencia: data.contacto_emergencia || ''
        });
      } else {
        Alert.alert('Error', 'Error al cargar el perfil');
      }
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'Error al cargar datos del perfil');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSave = async () => {
    try {
      const token = await getToken();
      if (!token || !estudiante) return;

      const cleanedData = {
        nombres: formData.nombres || '',
        apellidos: formData.apellidos || '',
        email: formData.email || '',
        telefono: formData.telefono || '',
        direccion: formData.direccion || '',
        fecha_nacimiento: formData.fecha_nacimiento || null,
        genero: formData.genero || '',
        identificacion: formData.identificacion || '',
        contacto_emergencia: formData.contacto_emergencia || ''
      };

      const response = await fetch(`${API_URL}/usuarios/mi-perfil`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cleanedData)
      });

      if (response.ok) {
        await fetchPerfil();
        setIsEditing(false);
        Alert.alert('Éxito', 'Perfil actualizado exitosamente');
      } else {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.message || 'Error al actualizar');
      }
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'Error al actualizar el perfil');
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.password_nueva !== passwordData.confirmar_password) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return;
    }

    if (passwordData.password_nueva.length < 8) {
      Alert.alert('Error', 'La contraseña debe tener al menos 8 caracteres');
      return;
    }

    setLoading(true);

    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/usuarios/cambiar-password`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          password_actual: passwordData.password_actual,
          password_nueva: passwordData.password_nueva
        })
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert('Éxito', 'Contraseña actualizada correctamente');
        setPasswordData({
          password_actual: '',
          password_nueva: '',
          confirmar_password: ''
        });
      } else {
        Alert.alert('Error', data.message || 'Error al cambiar contraseña');
      }
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'Error al cambiar contraseña');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchPerfil();
  };

  const getInitials = () => {
    if (!estudiante) return 'ES';
    const nombres = estudiante.nombres || estudiante.nombre || '';
    const apellidos = estudiante.apellidos || estudiante.apellido || '';
    if (!nombres && !apellidos) return 'ES';
    const primerNombre = nombres.trim().charAt(0).toUpperCase() || 'E';
    const primerApellido = apellidos.trim().charAt(0).toUpperCase() || 'S';
    return `${primerNombre}${primerApellido}`;
  };

  if (loading && !estudiante) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: theme.textMuted }}>Cargando perfil...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Premium Header Gradient */}
      <LinearGradient
        colors={theme.primaryGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <TouchableOpacity
          style={styles.headerAvatarContainer}
          onPress={() => setShowPhotoPreview(true)}
          activeOpacity={0.9}
        >
          {fotoUrl ? (
            <Image source={{ uri: fotoUrl }} style={styles.headerAvatar} />
          ) : (
            <View style={styles.headerAvatarPlaceholder}>
              <Text style={styles.headerInitials}>{getInitials()}</Text>
            </View>
          )}
          <View style={styles.headerChangeIcon}>
            <Ionicons name="camera" size={12} color="#fff" />
          </View>
        </TouchableOpacity>

        <Text style={styles.headerName}>
          {(estudiante?.nombres || estudiante?.nombre || 'Estudiante')}
        </Text>
        <Text style={styles.headerUsername}>
          {estudiante?.username ? `@${estudiante.username}` : ''}
        </Text>

        <View style={styles.headerBadge}>
          <Ionicons name="school" size={12} color="#fff" />
          <Text style={styles.headerBadgeText}>Estudiante</Text>
        </View>
      </LinearGradient>

      <View style={[styles.contentContainer, { backgroundColor: theme.bg }]}>
        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'info' && styles.activeTab]}
            onPress={() => setActiveTab('info')}
          >
            <Ionicons name="person" size={16} color={activeTab === 'info' ? theme.accent : theme.textMuted} />
            <Text style={[styles.tabText, { color: activeTab === 'info' ? theme.text : theme.textMuted, fontWeight: activeTab === 'info' ? '700' : '500' }]}>
              Información
            </Text>
            {activeTab === 'info' && <View style={[styles.activeIndicator, { backgroundColor: theme.accent }]} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'password' && styles.activeTab]}
            onPress={() => setActiveTab('password')}
          >
            <Ionicons name="lock-closed" size={16} color={activeTab === 'password' ? theme.accent : theme.textMuted} />
            <Text style={[styles.tabText, { color: activeTab === 'password' ? theme.text : theme.textMuted, fontWeight: activeTab === 'password' ? '700' : '500' }]}>
              Seguridad
            </Text>
            {activeTab === 'password' && <View style={[styles.activeIndicator, { backgroundColor: theme.accent }]} />}
          </TouchableOpacity>
        </View>

        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        >
          {activeTab === 'info' ? (
            <Animated.View entering={FadeInDown.delay(100).duration(500)}>
              <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                {/* Header Row */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <Text style={[styles.sectionTitle, { color: theme.accent }]}>DATOS PERSONALES</Text>
                  {!isEditing ? (
                    <TouchableOpacity onPress={() => setIsEditing(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Ionicons name="create-outline" size={18} color={theme.accent} />
                      <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '600' }}>Editar</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity onPress={() => setIsEditing(false)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Ionicons name="close-circle-outline" size={18} color={theme.textMuted} />
                      <Text style={{ color: theme.textMuted, fontSize: 12, fontWeight: '600' }}>Cancelar</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Fields Grid */}
                <View style={{ gap: 15 }}>
                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>Nombres</Text>
                    <TextInput
                      editable={isEditing}
                      value={formData.nombres}
                      onChangeText={(t) => setFormData({ ...formData, nombres: t })}
                      style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>Apellidos</Text>
                    <TextInput
                      editable={isEditing}
                      value={formData.apellidos}
                      onChangeText={(t) => setFormData({ ...formData, apellidos: t })}
                      style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                    />
                  </View>

                  <View style={styles.inputRow}>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={[styles.label, { color: theme.textSecondary }]}>Email</Text>
                      <TextInput
                        editable={isEditing}
                        value={formData.email}
                        onChangeText={(t) => setFormData({ ...formData, email: t })}
                        style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                        keyboardType="email-address"
                      />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={[styles.label, { color: theme.textSecondary }]}>Teléfono</Text>
                      <TextInput
                        editable={isEditing}
                        value={formData.telefono}
                        onChangeText={(t) => setFormData({ ...formData, telefono: t })}
                        style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                        keyboardType="phone-pad"
                      />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>Dirección</Text>
                    <TextInput
                      editable={isEditing}
                      value={formData.direccion}
                      onChangeText={(t) => setFormData({ ...formData, direccion: t })}
                      style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                    />
                  </View>

                  {/* Read Only Fields */}
                  <View style={styles.inputRow}>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={[styles.label, { color: theme.textSecondary }]}>Identificación</Text>
                      <View style={[styles.readOnlyBox, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                        <Ionicons name="card-outline" size={14} color={theme.textMuted} style={{ marginRight: 8 }} />
                        <Text style={{ color: theme.textMuted, fontSize: 13 }}>{estudiante?.identificacion || estudiante?.cedula}</Text>
                      </View>
                    </View>
                    <View style={[styles.inputGroup, { flex: 1 }]}>
                      <Text style={[styles.label, { color: theme.textSecondary }]}>Estado</Text>
                      <View style={[styles.readOnlyBox, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                        <Ionicons name="checkmark-circle-outline" size={14} color={theme.success} style={{ marginRight: 8 }} />
                        <Text style={{ color: theme.success, fontSize: 13, textTransform: 'capitalize' }}>{estudiante?.estado || 'Activo'}</Text>
                      </View>
                    </View>
                  </View>
                </View>

                {isEditing && (
                  <TouchableOpacity
                    style={[styles.saveButton, { backgroundColor: theme.accent }]}
                    onPress={handleSave}
                  >
                    <Text style={styles.saveButtonText}>Guardar Cambios</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInUp.delay(100).duration(500)}>
              <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                <Text style={[styles.sectionTitle, { color: theme.accent, marginBottom: 20 }]}>CAMBIAR CONTRASEÑA</Text>

                <View style={{ gap: 15 }}>
                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>Contraseña Actual</Text>
                    <View style={[styles.passwordInputContainer, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                      <TextInput
                        style={[styles.passwordInput, { color: theme.text }]}
                        value={passwordData.password_actual}
                        onChangeText={(t) => setPasswordData({ ...passwordData, password_actual: t })}
                        secureTextEntry={!showCurrentPassword}
                        placeholderTextColor={theme.textMuted}
                      />
                      <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)} style={{ padding: 10 }}>
                        <Ionicons name={showCurrentPassword ? 'eye-off' : 'eye'} size={18} color={theme.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>Nueva Contraseña</Text>
                    <View style={[styles.passwordInputContainer, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                      <TextInput
                        style={[styles.passwordInput, { color: theme.text }]}
                        value={passwordData.password_nueva}
                        onChangeText={(t) => setPasswordData({ ...passwordData, password_nueva: t })}
                        secureTextEntry={!showNewPassword}
                        placeholderTextColor={theme.textMuted}
                      />
                      <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} style={{ padding: 10 }}>
                        <Ionicons name={showNewPassword ? 'eye-off' : 'eye'} size={18} color={theme.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: theme.textSecondary }]}>Confirmar Contraseña</Text>
                    <View style={[styles.passwordInputContainer, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
                      <TextInput
                        style={[styles.passwordInput, { color: theme.text }]}
                        value={passwordData.confirmar_password}
                        onChangeText={(t) => setPasswordData({ ...passwordData, confirmar_password: t })}
                        secureTextEntry={!showConfirmPassword}
                        placeholderTextColor={theme.textMuted}
                      />
                      <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={{ padding: 10 }}>
                        <Ionicons name={showConfirmPassword ? 'eye-off' : 'eye'} size={18} color={theme.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.saveButton, { backgroundColor: theme.accent, marginTop: 25 }]}
                  onPress={handleChangePassword}
                  disabled={loading}
                >
                  <Text style={styles.saveButtonText}>{loading ? 'Actualizando...' : 'Actualizar Contraseña'}</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}
        </ScrollView>
      </View>

      {/* Photo Preview Modal */}
      <Modal visible={showPhotoPreview} transparent animationType="fade" onRequestClose={() => setShowPhotoPreview(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowPhotoPreview(false)}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={[styles.previewContainer, { borderColor: theme.accent }]}>
            {fotoUrl ? (
              <Image source={{ uri: fotoUrl }} style={styles.previewImage} />
            ) : (
              <View style={[styles.previewPlaceholder, { backgroundColor: theme.accent }]}>
                <Text style={styles.previewInitials}>{getInitials()}</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGradient: {
    paddingTop: 60,
    paddingBottom: 30,
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerAvatarContainer: {
    position: 'relative',
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  headerAvatar: {
    width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: '#fff'
  },
  headerAvatarPlaceholder: {
    width: 100, height: 100, borderRadius: 50, borderWidth: 4, borderColor: '#fff',
    backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center'
  },
  headerInitials: {
    fontSize: 32, fontWeight: '800', color: '#fff'
  },
  headerChangeIcon: {
    position: 'absolute', bottom: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)',
    width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff'
  },
  headerName: {
    fontSize: 20, fontWeight: '700', color: '#fff', marginBottom: 2
  },
  headerUsername: {
    fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 10
  },
  headerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20
  },
  headerBadgeText: {
    fontSize: 12, fontWeight: '600', color: '#fff'
  },
  contentContainer: {
    flex: 1, marginTop: -20, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingVertical: 10
  },
  tabsContainer: {
    flexDirection: 'row', paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(150,150,150,0.1)'
  },
  tab: {
    marginRight: 20, paddingVertical: 15, position: 'relative', flexDirection: 'row', alignItems: 'center', gap: 6
  },
  activeTab: {},
  tabText: { fontSize: 14 },
  activeIndicator: {
    position: 'absolute', bottom: -1, left: 0, right: 0, height: 3, borderRadius: 3
  },
  card: {
    borderRadius: 20, padding: 20, borderWidth: 1,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2
  },
  sectionTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  inputGroup: { gap: 5 },
  inputRow: { flexDirection: 'row', gap: 10 },
  label: { fontSize: 12, fontWeight: '600', marginLeft: 4 },
  input: {
    padding: 12, borderRadius: 12, borderWidth: 1, fontSize: 14
  },
  readOnlyBox: {
    padding: 12, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center'
  },
  saveButton: {
    padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 15,
    shadowColor: "#fbbf24", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4
  },
  saveButtonText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  passwordInputContainer: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12
  },
  passwordInput: { flex: 1, padding: 12 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center'
  },
  modalCloseBtn: {
    position: 'absolute', top: 50, right: 30, padding: 10
  },
  previewContainer: {
    width: width * 0.8, height: width * 0.8, borderRadius: width * 0.4, borderWidth: 4, overflow: 'hidden'
  },
  previewImage: { width: '100%', height: '100%' },
  previewPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  previewInitials: { fontSize: 80, fontWeight: 'bold', color: '#fff' }
});
