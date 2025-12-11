import { View, Text, ScrollView, TouchableOpacity, Image, TextInput, Alert, StyleSheet, RefreshControl, Modal } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../../../constants/config';
import { getToken, storage } from '../../../services/storage';
import { eventEmitter } from '../../../services/eventEmitter';

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

  const colors = {
    background: darkMode ? '#000000' : '#f8fafc',
    card: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)',
    text: darkMode ? '#ffffff' : '#1e293b',
    textSecondary: darkMode ? 'rgba(255,255,255,0.8)' : 'rgba(30,41,59,0.8)',
    textMuted: darkMode ? 'rgba(255,255,255,0.7)' : 'rgba(30,41,59,0.7)',
    border: darkMode ? 'rgba(251, 191, 36, 0.1)' : 'rgba(251, 191, 36, 0.2)',
    input: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
    inputBorder: darkMode ? 'rgba(251, 191, 36, 0.2)' : 'rgba(251, 191, 36, 0.3)',
    accent: '#fbbf24',
  };

  if (loading && !estudiante) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.textMuted }}>Cargando perfil...</Text>
      </View>
    );
  }

  if (!estudiante) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.textMuted }}>No se pudo cargar el perfil</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Mi Perfil</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Gestiona tu información personal y seguridad
          </Text>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, { borderBottomColor: activeTab === 'info' ? colors.accent : 'transparent' }]}
            onPress={() => setActiveTab('info')}
            activeOpacity={0.7}
          >
            <Ionicons name="person" size={12} color={activeTab === 'info' ? colors.text : colors.textMuted} />
            <Text style={[styles.tabText, { color: activeTab === 'info' ? colors.text : colors.textMuted }]}>
              Información Personal
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, { borderBottomColor: activeTab === 'password' ? colors.accent : 'transparent' }]}
            onPress={() => setActiveTab('password')}
            activeOpacity={0.7}
          >
            <Ionicons name="lock-closed" size={12} color={activeTab === 'password' ? colors.text : colors.textMuted} />
            <Text style={[styles.tabText, { color: activeTab === 'password' ? colors.text : colors.textMuted }]}>
              Cambiar Contraseña
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'info' ? (
          <View style={styles.content}>
            {/* Card de perfil */}
            <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TouchableOpacity onPress={() => setShowPhotoPreview(true)} activeOpacity={0.8}>
                <View style={[styles.photoContainer, { borderColor: colors.accent }]}>
                  {fotoUrl ? (
                    <Image source={{ uri: fotoUrl }} style={styles.photo} />
                  ) : (
                    <View style={[styles.photoPlaceholder, { backgroundColor: colors.accent }]}>
                      <Text style={styles.initials}>{getInitials()}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>

              <Text style={[styles.userName, { color: colors.text }]}>
                {(estudiante.nombres || estudiante.nombre || 'Estudiante')} {(estudiante.apellidos || estudiante.apellido || '')}
              </Text>
              <Text style={[styles.userUsername, { color: colors.textMuted }]}>
                {estudiante.username ? `@${estudiante.username}` : ''}
              </Text>

              <View style={[styles.badge, { backgroundColor: `${colors.accent}20` }]}>
                <Ionicons name="school" size={12} color={colors.accent} />
                <Text style={[styles.badgeText, { color: colors.accent }]}>Estudiante</Text>
              </View>

              <View style={[styles.infoSection, { borderTopColor: colors.border }]}>
                <View style={styles.infoRow}>
                  <Ionicons name="checkmark-circle" size={14} color={colors.accent} />
                  <View style={styles.infoContent}>
                    <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Estado</Text>
                    <Text style={[styles.infoValue, { color: colors.text }]}>
                      {estudiante?.estado || 'Activo'}
                    </Text>
                  </View>
                </View>

                <View style={styles.infoRow}>
                  <Ionicons name="person" size={14} color={colors.accent} />
                  <View style={styles.infoContent}>
                    <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Identificación</Text>
                    <Text style={[styles.infoValue, { color: colors.text }]}>
                      {estudiante.identificacion || estudiante.cedula || 'No especificado'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Botones Editar/Guardar */}
              <View style={[styles.actionsSection, { borderTopColor: colors.border }]}>
                {!isEditing ? (
                  <TouchableOpacity
                    style={[styles.primaryButton, { backgroundColor: colors.accent }]}
                    onPress={() => setIsEditing(true)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="create" size={12} color="#fff" />
                    <Text style={styles.primaryButtonText}>Editar Perfil</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.editActions}>
                    <TouchableOpacity
                      style={[styles.primaryButton, { backgroundColor: colors.accent, flex: 1 }]}
                      onPress={handleSave}
                      disabled={loading}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="checkmark-circle" size={12} color="#fff" />
                      <Text style={styles.primaryButtonText}>{loading ? 'Guardando...' : 'Guardar'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.secondaryButton, { borderColor: colors.border, flex: 1 }]}
                      onPress={() => {
                        setIsEditing(false);
                        fetchPerfil();
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="close" size={14} color={colors.textSecondary} />
                      <Text style={[styles.secondaryButtonText, { color: colors.textSecondary }]}>Cancelar</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>

            {/* Información detallada */}
            <View style={[styles.detailsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>INFORMACIÓN PERSONAL</Text>

              <View style={styles.fieldsContainer}>
                {/* Nombres */}
                <View style={styles.field}>
                  <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Nombres</Text>
                  {isEditing ? (
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.input, borderColor: colors.inputBorder, color: colors.text }]}
                      value={formData.nombres}
                      onChangeText={(text) => setFormData({ ...formData, nombres: text })}
                      placeholderTextColor={colors.textMuted}
                    />
                  ) : (
                    <View style={[styles.fieldValue, { backgroundColor: colors.input, borderColor: colors.border }]}>
                      <Ionicons name="person" size={12} color="#6b7280" />
                      <Text style={[styles.fieldValueText, { color: colors.text }]}>
                        {formData.nombres || 'No especificado'}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Apellidos */}
                <View style={styles.field}>
                  <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Apellidos</Text>
                  {isEditing ? (
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.input, borderColor: colors.inputBorder, color: colors.text }]}
                      value={formData.apellidos}
                      onChangeText={(text) => setFormData({ ...formData, apellidos: text })}
                      placeholderTextColor={colors.textMuted}
                    />
                  ) : (
                    <View style={[styles.fieldValue, { backgroundColor: colors.input, borderColor: colors.border }]}>
                      <Ionicons name="person" size={12} color="#6b7280" />
                      <Text style={[styles.fieldValueText, { color: colors.text }]}>
                        {formData.apellidos || 'No especificado'}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Email */}
                <View style={styles.field}>
                  <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Email</Text>
                  {isEditing ? (
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.input, borderColor: colors.inputBorder, color: colors.text }]}
                      value={formData.email}
                      onChangeText={(text) => setFormData({ ...formData, email: text })}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      placeholderTextColor={colors.textMuted}
                    />
                  ) : (
                    <View style={[styles.fieldValue, { backgroundColor: colors.input, borderColor: colors.border }]}>
                      <Ionicons name="mail" size={12} color="#6b7280" />
                      <Text style={[styles.fieldValueText, { color: colors.text }]}>
                        {formData.email || 'No especificado'}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Teléfono */}
                <View style={styles.field}>
                  <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Teléfono</Text>
                  {isEditing ? (
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.input, borderColor: colors.inputBorder, color: colors.text }]}
                      value={formData.telefono}
                      onChangeText={(text) => setFormData({ ...formData, telefono: text })}
                      keyboardType="phone-pad"
                      placeholderTextColor={colors.textMuted}
                    />
                  ) : (
                    <View style={[styles.fieldValue, { backgroundColor: colors.input, borderColor: colors.border }]}>
                      <Ionicons name="call" size={12} color="#6b7280" />
                      <Text style={[styles.fieldValueText, { color: colors.text }]}>
                        {formData.telefono || 'No especificado'}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Dirección */}
                <View style={styles.field}>
                  <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Dirección</Text>
                  {isEditing ? (
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.input, borderColor: colors.inputBorder, color: colors.text }]}
                      value={formData.direccion}
                      onChangeText={(text) => setFormData({ ...formData, direccion: text })}
                      placeholderTextColor={colors.textMuted}
                    />
                  ) : (
                    <View style={[styles.fieldValue, { backgroundColor: colors.input, borderColor: colors.border }]}>
                      <Ionicons name="location" size={12} color="#6b7280" />
                      <Text style={[styles.fieldValueText, { color: colors.text }]}>
                        {formData.direccion || 'No especificado'}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Fecha de nacimiento */}
                {formData.fecha_nacimiento && (
                  <View style={styles.field}>
                    <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Fecha de Nacimiento</Text>
                    <View style={[styles.fieldValue, { backgroundColor: colors.input, borderColor: colors.border }]}>
                      <Ionicons name="calendar" size={12} color="#6b7280" />
                      <Text style={[styles.fieldValueText, { color: colors.text }]}>
                        {new Date(formData.fecha_nacimiento).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Contacto de Emergencia */}
                <View style={styles.field}>
                  <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Contacto de Emergencia</Text>
                  {isEditing ? (
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.input, borderColor: colors.inputBorder, color: colors.text }]}
                      value={formData.contacto_emergencia}
                      onChangeText={(text) => setFormData({ ...formData, contacto_emergencia: text })}
                      keyboardType="phone-pad"
                      placeholder="Teléfono de emergencia"
                      placeholderTextColor={colors.textMuted}
                    />
                  ) : (
                    <View style={[styles.fieldValue, { backgroundColor: colors.input, borderColor: colors.border }]}>
                      <Ionicons name="call" size={12} color="#6b7280" />
                      <Text style={[styles.fieldValueText, { color: colors.text }]}>
                        {formData.contacto_emergencia || 'No especificado'}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Género */}
                <View style={styles.field}>
                  <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Género</Text>
                  {isEditing ? (
                    <View style={[styles.input, { backgroundColor: colors.input, borderColor: colors.inputBorder }]}>
                      <Text style={{ color: colors.text, fontSize: 11 }}>
                        {formData.genero || 'Seleccionar...'}
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.fieldValue, { backgroundColor: colors.input, borderColor: colors.border }]}>
                      <Ionicons name="people" size={12} color="#6b7280" />
                      <Text style={[styles.fieldValueText, { color: colors.text }]}>
                        {formData.genero ? (formData.genero.charAt(0).toUpperCase() + formData.genero.slice(1)) : 'No especificado'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.content}>
            <View style={[styles.passwordCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>CAMBIAR CONTRASEÑA</Text>

              {/* Contraseña Actual */}
              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Contraseña Actual</Text>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={[styles.passwordInput, { backgroundColor: colors.input, borderColor: colors.inputBorder, color: colors.text }]}
                    value={passwordData.password_actual}
                    onChangeText={(text) => setPasswordData({ ...passwordData, password_actual: text })}
                    secureTextEntry={!showCurrentPassword}
                    placeholderTextColor={colors.textMuted}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    <Ionicons name={showCurrentPassword ? 'eye-off' : 'eye'} size={16} color="#9ca3af" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Nueva Contraseña */}
              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Nueva Contraseña</Text>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={[styles.passwordInput, { backgroundColor: colors.input, borderColor: colors.inputBorder, color: colors.text }]}
                    value={passwordData.password_nueva}
                    onChangeText={(text) => setPasswordData({ ...passwordData, password_nueva: text })}
                    secureTextEntry={!showNewPassword}
                    placeholderTextColor={colors.textMuted}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowNewPassword(!showNewPassword)}
                  >
                    <Ionicons name={showNewPassword ? 'eye-off' : 'eye'} size={16} color="#9ca3af" />
                  </TouchableOpacity>
                </View>
                <View style={styles.passwordHint}>
                  <Ionicons name="checkmark-circle" size={10} color={passwordData.password_nueva.length >= 8 ? colors.accent : '#9ca3af'} />
                  <Text style={[styles.passwordHintText, { color: colors.textMuted }]}>
                    Mínimo 8 caracteres
                  </Text>
                </View>
              </View>

              {/* Confirmar Nueva Contraseña */}
              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Confirmar Nueva Contraseña</Text>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={[styles.passwordInput, { backgroundColor: colors.input, borderColor: colors.inputBorder, color: colors.text }]}
                    value={passwordData.confirmar_password}
                    onChangeText={(text) => setPasswordData({ ...passwordData, confirmar_password: text })}
                    secureTextEntry={!showConfirmPassword}
                    placeholderTextColor={colors.textMuted}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <Ionicons name={showConfirmPassword ? 'eye-off' : 'eye'} size={16} color="#9ca3af" />
                  </TouchableOpacity>
                </View>
                {passwordData.confirmar_password && (
                  <View style={styles.passwordHint}>
                    <Ionicons name="checkmark-circle" size={10} color={colors.accent} />
                    <Text style={[styles.passwordHintText, { color: colors.textMuted }]}>
                      {passwordData.password_nueva === passwordData.confirmar_password ? 'Las contraseñas coinciden' : 'Las contraseñas no coinciden'}
                    </Text>
                  </View>
                )}
              </View>

              {/* Botón Cambiar Contraseña */}
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: colors.accent, marginTop: 8 }]}
                onPress={handleChangePassword}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Ionicons name="shield-checkmark" size={14} color="#fff" />
                <Text style={styles.primaryButtonText}>{loading ? 'Actualizando...' : 'Cambiar Contraseña'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Modal de vista previa de foto */}
      <Modal
        visible={showPhotoPreview}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPhotoPreview(false)}
      >
        <TouchableOpacity
          style={styles.photoPreviewOverlay}
          activeOpacity={1}
          onPress={() => setShowPhotoPreview(false)}
        >
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowPhotoPreview(false)}
            activeOpacity={0.8}
          >
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>

          <View style={[styles.photoPreviewContainer, { borderColor: colors.accent }]}>
            {fotoUrl ? (
              <Image source={{ uri: fotoUrl }} style={styles.photoPreview} />
            ) : (
              <View style={[styles.photoPreviewPlaceholder, { backgroundColor: colors.accent }]}>
                <Text style={styles.photoPreviewInitials}>{getInitials()}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
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
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 10,
    fontWeight: '600',
  },
  content: {
    padding: 16,
    paddingTop: 4,
    gap: 10,
  },
  profileCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  photoContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    marginBottom: 10,
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 35,
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
  },
  userName: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  userUsername: {
    fontSize: 11,
    marginBottom: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  infoSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    width: '100%',
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 8,
  },
  infoValue: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  actionsSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    width: '100%',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  primaryButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  secondaryButtonText: {
    fontSize: 11,
    fontWeight: '700',
  },
  detailsCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  fieldsContainer: {
    gap: 12,
  },
  field: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  input: {
    fontSize: 11,
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
  },
  fieldValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderRadius: 6,
    borderWidth: 1,
  },
  fieldValueText: {
    fontSize: 11,
  },
  passwordCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  passwordInputContainer: {
    position: 'relative',
  },
  passwordInput: {
    fontSize: 11,
    padding: 10,
    paddingRight: 40,
    borderRadius: 6,
    borderWidth: 1,
  },
  eyeButton: {
    position: 'absolute',
    right: 10,
    top: 10,
  },
  passwordHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  passwordHintText: {
    fontSize: 9,
  },
  photoPreviewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  photoPreviewContainer: {
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 4,
    overflow: 'hidden',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  photoPreviewPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPreviewInitials: {
    fontSize: 80,
    fontWeight: '800',
    color: '#fff',
  },
});
