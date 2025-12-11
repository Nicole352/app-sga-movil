import { View, Text, ScrollView, TouchableOpacity, Image, Modal, TextInput, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../constants/config';
import { getToken, storage } from '../services/storage';
import { eventEmitter } from '../services/eventEmitter';

interface PerfilUsuarioProps {
  rol: 'estudiante' | 'docente' | 'admin' | 'superadmin';
  accentColor?: string;
}

export default function PerfilUsuario({ rol, accentColor = '#fbbf24' }: PerfilUsuarioProps) {
  const [darkMode, setDarkMode] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [passwordData, setPasswordData] = useState({
    password_actual: '',
    password_nueva: '',
    confirmar_password: ''
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUserData(data);
        setFormData({
          nombres: data.nombres || data.nombre || '',
          apellidos: data.apellidos || data.apellido || '',
          email: data.email || '',
          telefono: data.telefono || '',
          direccion: data.direccion || '',
          fecha_nacimiento: data.fecha_nacimiento || '',
          genero: data.genero || '',
          identificacion: data.identificacion || data.cedula || '',
          contacto_emergencia: data.contacto_emergencia || ''
        });
      }
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'No se pudo cargar el perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/usuarios/mi-perfil`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        await fetchPerfil();
        setIsEditing(false);
        Alert.alert('Éxito', 'Perfil actualizado correctamente');
      } else {
        Alert.alert('Error', 'No se pudo actualizar el perfil');
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

      if (response.ok) {
        Alert.alert('Éxito', 'Contraseña actualizada correctamente');
        setShowPasswordModal(false);
        setPasswordData({ password_actual: '', password_nueva: '', confirmar_password: '' });
      } else {
        const data = await response.json();
        Alert.alert('Error', data.message || 'Error al cambiar contraseña');
      }
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'Error al cambiar contraseña');
    }
  };



  const toggleTheme = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    eventEmitter.emit('themeChanged', newMode);
  };

  const colors = {
    background: darkMode ? '#000000' : '#f8fafc',
    card: darkMode ? '#1a1a1a' : '#ffffff',
    text: darkMode ? '#ffffff' : '#1e293b',
    textSecondary: darkMode ? 'rgba(255,255,255,0.7)' : 'rgba(30,41,59,0.7)',
    border: darkMode ? `${accentColor}33` : `${accentColor}4D`,
    accent: accentColor,
    input: darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
  };

  const getInitials = () => {
    if (!userData) return '?';
    const nombres = userData.nombres || userData.nombre || '';
    const apellidos = userData.apellidos || userData.apellido || '';
    return `${nombres.charAt(0)}${apellidos.charAt(0)}`.toUpperCase();
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Mi Perfil</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Gestiona tu información personal
          </Text>
        </View>

        {/* Foto de perfil */}
        <View style={styles.photoSection}>
          <View style={[styles.photoContainer, { borderColor: colors.accent }]}>
            {userData?.foto_perfil ? (
              <Image source={{ uri: userData.foto_perfil }} style={styles.photo} />
            ) : (
              <View style={[styles.photoPlaceholder, { backgroundColor: colors.accent }]}>
                <Text style={styles.initials}>{getInitials()}</Text>
              </View>
            )}
          </View>

          <Text style={[styles.userName, { color: colors.text }]}>
            {userData?.nombres || userData?.nombre} {userData?.apellidos || userData?.apellido}
          </Text>
          <Text style={[styles.userRole, { color: colors.textSecondary }]}>
            {rol.charAt(0).toUpperCase() + rol.slice(1)}
          </Text>
          <Text style={[styles.photoHint, { color: colors.textSecondary }]}>
            Cambia tu foto desde el menú lateral
          </Text>
        </View>

        {/* Botones de acción */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={toggleTheme}
          >
            <Ionicons name={darkMode ? 'sunny' : 'moon'} size={20} color={colors.accent} />
            <Text style={[styles.actionText, { color: colors.text }]}>
              Modo {darkMode ? 'Claro' : 'Oscuro'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setShowPasswordModal(true)}
          >
            <Ionicons name="lock-closed" size={20} color={colors.accent} />
            <Text style={[styles.actionText, { color: colors.text }]}>Cambiar Contraseña</Text>
          </TouchableOpacity>
        </View>

        {/* Información personal */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>INFORMACIÓN PERSONAL</Text>
            {!isEditing ? (
              <TouchableOpacity onPress={() => setIsEditing(true)}>
                <Ionicons name="create" size={20} color={colors.accent} />
              </TouchableOpacity>
            ) : (
              <View style={styles.editButtons}>
                <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
                  <Ionicons name="checkmark" size={20} color="#10b981" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setIsEditing(false); fetchPerfil(); }}>
                  <Ionicons name="close" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.fieldsContainer}>
            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Nombres</Text>
              {isEditing ? (
                <TextInput
                  style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
                  value={formData.nombres}
                  onChangeText={(text) => setFormData({ ...formData, nombres: text })}
                  placeholderTextColor={colors.textSecondary}
                />
              ) : (
                <Text style={[styles.fieldValue, { color: colors.text }]}>{formData.nombres || 'No especificado'}</Text>
              )}
            </View>

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Apellidos</Text>
              {isEditing ? (
                <TextInput
                  style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
                  value={formData.apellidos}
                  onChangeText={(text) => setFormData({ ...formData, apellidos: text })}
                  placeholderTextColor={colors.textSecondary}
                />
              ) : (
                <Text style={[styles.fieldValue, { color: colors.text }]}>{formData.apellidos || 'No especificado'}</Text>
              )}
            </View>

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Email</Text>
              {isEditing ? (
                <TextInput
                  style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
                  value={formData.email}
                  onChangeText={(text) => setFormData({ ...formData, email: text })}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholderTextColor={colors.textSecondary}
                />
              ) : (
                <Text style={[styles.fieldValue, { color: colors.text }]}>{formData.email || 'No especificado'}</Text>
              )}
            </View>

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Teléfono</Text>
              {isEditing ? (
                <TextInput
                  style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
                  value={formData.telefono}
                  onChangeText={(text) => setFormData({ ...formData, telefono: text })}
                  keyboardType="phone-pad"
                  placeholderTextColor={colors.textSecondary}
                />
              ) : (
                <Text style={[styles.fieldValue, { color: colors.text }]}>{formData.telefono || 'No especificado'}</Text>
              )}
            </View>

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Dirección</Text>
              {isEditing ? (
                <TextInput
                  style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
                  value={formData.direccion}
                  onChangeText={(text) => setFormData({ ...formData, direccion: text })}
                  placeholderTextColor={colors.textSecondary}
                />
              ) : (
                <Text style={[styles.fieldValue, { color: colors.text }]}>{formData.direccion || 'No especificado'}</Text>
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Modal de contraseña */}
      <Modal
        visible={showPasswordModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, maxHeight: '80%' }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Cambiar Contraseña</Text>
            
            <View style={styles.passwordField}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Contraseña Actual</Text>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={[styles.passwordInput, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
                  value={passwordData.password_actual}
                  onChangeText={(text) => setPasswordData({ ...passwordData, password_actual: text })}
                  secureTextEntry={!showCurrentPassword}
                  placeholderTextColor={colors.textSecondary}
                />
                <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)} style={styles.eyeButton}>
                  <Ionicons name={showCurrentPassword ? 'eye-off' : 'eye'} size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.passwordField}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Nueva Contraseña</Text>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={[styles.passwordInput, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
                  value={passwordData.password_nueva}
                  onChangeText={(text) => setPasswordData({ ...passwordData, password_nueva: text })}
                  secureTextEntry={!showNewPassword}
                  placeholderTextColor={colors.textSecondary}
                />
                <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} style={styles.eyeButton}>
                  <Ionicons name={showNewPassword ? 'eye-off' : 'eye'} size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.passwordField}>
              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Confirmar Contraseña</Text>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={[styles.passwordInput, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
                  value={passwordData.confirmar_password}
                  onChangeText={(text) => setPasswordData({ ...passwordData, confirmar_password: text })}
                  secureTextEntry={!showConfirmPassword}
                  placeholderTextColor={colors.textSecondary}
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeButton}>
                  <Ionicons name={showConfirmPassword ? 'eye-off' : 'eye'} size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalActionButton, { backgroundColor: colors.accent }]}
                onPress={handleChangePassword}
              >
                <Text style={styles.modalButtonTextWhite}>Cambiar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalActionButton, { borderColor: colors.border, borderWidth: 1 }]}
                onPress={() => {
                  setShowPasswordModal(false);
                  setPasswordData({ password_actual: '', password_nueva: '', confirmar_password: '' });
                }}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
  },
  photoSection: {
    alignItems: 'center',
    padding: 20,
  },
  photoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    marginBottom: 12,
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    fontSize: 40,
    fontWeight: '800',
    color: '#fff',
  },
  photoHint: {
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  userRole: {
    fontSize: 14,
  },
  actionsContainer: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 0,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  section: {
    margin: 20,
    marginTop: 0,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  editButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  saveButton: {
    marginRight: 8,
  },
  fieldsContainer: {
    gap: 16,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  fieldValue: {
    fontSize: 14,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  input: {
    fontSize: 14,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    gap: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextWhite: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  passwordField: {
    gap: 6,
    marginBottom: 12,
  },
  passwordInputContainer: {
    position: 'relative',
  },
  passwordInput: {
    fontSize: 14,
    padding: 12,
    paddingRight: 48,
    borderRadius: 8,
    borderWidth: 1,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    top: 12,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalActionButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
});
