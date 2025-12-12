import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, TextInput, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { getToken, getDarkMode } from '../../../services/storage';
import { API_URL } from '../../../constants/config';
import { eventEmitter } from '../../../services/eventEmitter';

interface DocenteData {
  id_usuario: number;
  nombre: string;
  apellido: string;
  identificacion: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  fecha_nacimiento?: string;
  genero?: string;
  titulo_profesional: string;
  experiencia_anos?: number;
  username: string;
  rol?: string;
  estado?: string;
  foto_perfil?: string;
}

export default function PerfilScreen() {
  const [darkMode, setDarkMode] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [docente, setDocente] = useState<DocenteData | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'password'>('info');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<DocenteData>>({});
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);

  const [passwordData, setPasswordData] = useState({
    password_actual: '',
    password_nueva: '',
    confirmar_password: ''
  });

  useEffect(() => {
    loadData();

    const themeHandler = (isDark: boolean) => setDarkMode(isDark);
    eventEmitter.on('themeChanged', themeHandler);
    return () => eventEmitter.off('themeChanged', themeHandler);
  }, []);

  const loadData = async () => {
    try {
      const mode = await getDarkMode();
      setDarkMode(mode);
      await fetchPerfil();
    } catch (error) {
      console.error('Error cargando datos:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPerfil();
    setRefreshing(false);
  };

  const fetchPerfil = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setDocente(data);
        setFormData({
          nombre: data.nombre || '',
          apellido: data.apellido || '',
          email: data.email || '',
          telefono: data.telefono || '',
          direccion: data.direccion || '',
          fecha_nacimiento: data.fecha_nacimiento ? data.fecha_nacimiento.split('T')[0] : '',
          genero: data.genero || '',
          titulo_profesional: data.titulo_profesional || '',
          experiencia_anos: data.experiencia_anos || 0,
          identificacion: data.identificacion || ''
        });
        if (data.foto_perfil) {
          setFotoUrl(data.foto_perfil);
        }
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const theme = {
    bg: darkMode ? '#000000' : '#f8fafc',
    cardBg: darkMode ? '#1a1a1a' : '#ffffff',
    text: darkMode ? '#ffffff' : '#1e293b',
    textSecondary: darkMode ? 'rgba(255,255,255,0.8)' : 'rgba(30,41,59,0.8)',
    textMuted: darkMode ? 'rgba(255,255,255,0.6)' : 'rgba(30,41,59,0.6)',
    border: darkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.3)',
    accent: '#3b82f6',
  };

  const getInitials = () => {
    if (!docente) return 'D';
    const nombre = docente.nombre?.charAt(0) || '';
    const apellido = docente.apellido?.charAt(0) || '';
    return (nombre + apellido).toUpperCase() || 'D';
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No especificado';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  const handleSave = async () => {
    try {
      const token = await getToken();
      if (!token || !docente) return;

      // Buscar el ID del docente
      const searchResponse = await fetch(`${API_URL}/docentes?search=${encodeURIComponent(docente.identificacion)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!searchResponse.ok) {
        Alert.alert('Error', 'No se pudo obtener información del docente');
        return;
      }

      const docentes = await searchResponse.json();
      const docenteData = Array.isArray(docentes)
        ? docentes.find((d: any) => d.identificacion === docente.identificacion)
        : null;

      if (!docenteData?.id_docente) {
        Alert.alert('Error', 'No se encontró el ID del docente');
        return;
      }

      const response = await fetch(`${API_URL}/docentes/${docenteData.id_docente}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          identificacion: formData.identificacion || docente.identificacion,
          nombre: formData.nombre || docente.nombre,
          apellido: formData.apellido || docente.apellido,
          fecha_nacimiento: formData.fecha_nacimiento || docente.fecha_nacimiento,
          titulo_profesional: formData.titulo_profesional || docente.titulo_profesional,
          experiencia_anos: Number(formData.experiencia_anos) || 0,
          estado: 'activo'
        })
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
      setLoading(true);
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

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Mi Perfil</Text>
        <Text style={[styles.headerSubtitle, { color: theme.textMuted }]}>
          Información personal y configuración
        </Text>
      </View>

      {/* Tabs */}
      <View style={[styles.tabsContainer, { borderColor: theme.border }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'info' && styles.tabActive,
            {
              backgroundColor: activeTab === 'info'
                ? theme.accent
                : (darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
              borderColor: theme.border
            }
          ]}
          onPress={() => setActiveTab('info')}
        >
          <Ionicons name="person" size={18} color={activeTab === 'info' ? '#fff' : theme.textSecondary} />
          <Text style={[
            styles.tabText,
            { color: activeTab === 'info' ? '#fff' : theme.textSecondary }
          ]}>
            Información
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'password' && styles.tabActive,
            {
              backgroundColor: activeTab === 'password'
                ? theme.accent
                : (darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
              borderColor: theme.border
            }
          ]}
          onPress={() => setActiveTab('password')}
        >
          <Ionicons name="lock-closed" size={18} color={activeTab === 'password' ? '#fff' : theme.textSecondary} />
          <Text style={[
            styles.tabText,
            { color: activeTab === 'password' ? '#fff' : theme.textSecondary }
          ]}>
            Contraseña
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Cargando perfil...</Text>
          </View>
        ) : activeTab === 'info' ? (
          <View style={styles.content}>
            {/* Avatar y Nombre */}
            <View style={[styles.profileCard, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <TouchableOpacity
                style={[styles.avatar, { backgroundColor: fotoUrl ? 'transparent' : theme.accent }]}
                activeOpacity={0.8}
              >
                {fotoUrl ? (
                  <View style={{ width: '100%', height: '100%', borderRadius: 40, overflow: 'hidden' }}>
                    <Text style={{ width: 80, height: 80, borderRadius: 40 }} />
                  </View>
                ) : (
                  <Text style={styles.avatarText}>{getInitials()}</Text>
                )}
              </TouchableOpacity>
              <Text style={[styles.profileName, { color: theme.text }]}>
                {docente?.nombre} {docente?.apellido}
              </Text>
              <Text style={[styles.profileRole, { color: theme.textSecondary }]}>
                {docente?.titulo_profesional || 'Docente'}
              </Text>
              {docente?.experiencia_anos && (
                <Text style={[styles.profileExperience, { color: theme.textMuted }]}>
                  {docente.experiencia_anos} años de experiencia
                </Text>
              )}

              {/* Botones Editar/Guardar */}
              <View style={{ marginTop: 16, width: '100%', gap: 8 }}>
                {!isEditing ? (
                  <TouchableOpacity
                    style={[styles.editButton, { backgroundColor: theme.accent }]}
                    onPress={() => setIsEditing(true)}
                  >
                    <Ionicons name="create" size={16} color="#fff" />
                    <Text style={styles.editButtonText}>Editar Perfil</Text>
                  </TouchableOpacity>
                ) : (
                  <>
                    <TouchableOpacity
                      style={[styles.saveButton, { backgroundColor: theme.accent }]}
                      onPress={handleSave}
                    >
                      <Ionicons name="checkmark-circle" size={16} color="#fff" />
                      <Text style={styles.saveButtonText}>Guardar Cambios</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.cancelButton, { borderColor: theme.border }]}
                      onPress={() => {
                        setIsEditing(false);
                        fetchPerfil();
                      }}
                    >
                      <Ionicons name="close-circle" size={16} color={theme.textSecondary} />
                      <Text style={[styles.cancelButtonText, { color: theme.textSecondary }]}>Cancelar</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>

            {/* Información Personal */}
            <View style={[styles.section, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Información Personal</Text>

              {isEditing ? (
                <View style={{ gap: 16 }}>
                  <View>
                    <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Nombres</Text>
                    <TextInput
                      style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
                      value={formData.nombre || ''}
                      onChangeText={(text) => setFormData({ ...formData, nombre: text })}
                      placeholderTextColor={theme.textMuted}
                    />
                  </View>
                  <View>
                    <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Apellidos</Text>
                    <TextInput
                      style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
                      value={formData.apellido || ''}
                      onChangeText={(text) => setFormData({ ...formData, apellido: text })}
                      placeholderTextColor={theme.textMuted}
                    />
                  </View>
                  <View>
                    <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Email</Text>
                    <TextInput
                      style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
                      value={formData.email || ''}
                      onChangeText={(text) => setFormData({ ...formData, email: text })}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      placeholderTextColor={theme.textMuted}
                    />
                  </View>
                  <View>
                    <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Teléfono</Text>
                    <TextInput
                      style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
                      value={formData.telefono || ''}
                      onChangeText={(text) => setFormData({ ...formData, telefono: text })}
                      keyboardType="phone-pad"
                      placeholderTextColor={theme.textMuted}
                    />
                  </View>
                  <View>
                    <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Dirección</Text>
                    <TextInput
                      style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
                      value={formData.direccion || ''}
                      onChangeText={(text) => setFormData({ ...formData, direccion: text })}
                      placeholderTextColor={theme.textMuted}
                    />
                  </View>
                  <View>
                    <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Fecha de Nacimiento (YYYY-MM-DD)</Text>
                    <TextInput
                      style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
                      value={formData.fecha_nacimiento || ''}
                      onChangeText={(text) => setFormData({ ...formData, fecha_nacimiento: text })}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={theme.textMuted}
                    />
                  </View>
                  <View>
                    <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Título Profesional</Text>
                    <TextInput
                      style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
                      value={formData.titulo_profesional || ''}
                      onChangeText={(text) => setFormData({ ...formData, titulo_profesional: text })}
                      placeholderTextColor={theme.textMuted}
                    />
                  </View>
                  <View>
                    <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Años de Experiencia</Text>
                    <TextInput
                      style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
                      value={formData.experiencia_anos?.toString() || ''}
                      onChangeText={(text) => setFormData({ ...formData, experiencia_anos: Number(text) })}
                      keyboardType="numeric"
                      placeholderTextColor={theme.textMuted}
                    />
                  </View>
                </View>
              ) : (
                <>
                  <View style={styles.infoItem}>
                    <View style={[styles.infoIcon, { backgroundColor: theme.accent + '20' }]}>
                      <Ionicons name="card" size={18} color={theme.accent} />
                    </View>
                    <View style={styles.infoContent}>
                      <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Identificación</Text>
                      <Text style={[styles.infoValue, { color: theme.text }]}>{docente?.identificacion || 'No especificado'}</Text>
                    </View>
                  </View>

                  <View style={styles.infoItem}>
                    <View style={[styles.infoIcon, { backgroundColor: theme.accent + '20' }]}>
                      <Ionicons name="mail" size={18} color={theme.accent} />
                    </View>
                    <View style={styles.infoContent}>
                      <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Email</Text>
                      <Text style={[styles.infoValue, { color: theme.text }]}>{docente?.email || 'No especificado'}</Text>
                    </View>
                  </View>

                  <View style={styles.infoItem}>
                    <View style={[styles.infoIcon, { backgroundColor: theme.accent + '20' }]}>
                      <Ionicons name="call" size={18} color={theme.accent} />
                    </View>
                    <View style={styles.infoContent}>
                      <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Teléfono</Text>
                      <Text style={[styles.infoValue, { color: theme.text }]}>{docente?.telefono || 'No especificado'}</Text>
                    </View>
                  </View>

                  <View style={styles.infoItem}>
                    <View style={[styles.infoIcon, { backgroundColor: theme.accent + '20' }]}>
                      <Ionicons name="location" size={18} color={theme.accent} />
                    </View>
                    <View style={styles.infoContent}>
                      <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Dirección</Text>
                      <Text style={[styles.infoValue, { color: theme.text }]}>{docente?.direccion || 'No especificado'}</Text>
                    </View>
                  </View>

                  <View style={styles.infoItem}>
                    <View style={[styles.infoIcon, { backgroundColor: theme.accent + '20' }]}>
                      <Ionicons name="calendar" size={18} color={theme.accent} />
                    </View>
                    <View style={styles.infoContent}>
                      <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Fecha de Nacimiento</Text>
                      <Text style={[styles.infoValue, { color: theme.text }]}>{formatDate(docente?.fecha_nacimiento)}</Text>
                    </View>
                  </View>

                  <View style={styles.infoItem}>
                    <View style={[styles.infoIcon, { backgroundColor: theme.accent + '20' }]}>
                      <Ionicons name="person" size={18} color={theme.accent} />
                    </View>
                    <View style={styles.infoContent}>
                      <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Género</Text>
                      <Text style={[styles.infoValue, { color: theme.text }]}>
                        {docente?.genero === 'M' ? 'Masculino' : docente?.genero === 'F' ? 'Femenino' : 'No especificado'}
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </View>

            {/* Información de Cuenta */}
            <View style={[styles.section, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Información de Cuenta</Text>

              <View style={styles.infoItem}>
                <View style={[styles.infoIcon, { backgroundColor: theme.accent + '20' }]}>
                  <Ionicons name="person-circle" size={18} color={theme.accent} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Usuario</Text>
                  <Text style={[styles.infoValue, { color: theme.text }]}>{docente?.username}</Text>
                </View>
              </View>

              <View style={styles.infoItem}>
                <View style={[styles.infoIcon, { backgroundColor: theme.accent + '20' }]}>
                  <Ionicons name="shield-checkmark" size={18} color={theme.accent} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Rol</Text>
                  <Text style={[styles.infoValue, { color: theme.text }]}>{docente?.rol || 'Docente'}</Text>
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.content}>
            <View style={[styles.section, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Cambiar Contraseña</Text>
              <Text style={[styles.sectionSubtitle, { color: theme.textMuted }]}>
                Asegúrate de usar una contraseña segura
              </Text>

              <View style={{ gap: 16 }}>
                <View>
                  <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Contraseña Actual</Text>
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
                    value={passwordData.password_actual}
                    onChangeText={(text) => setPasswordData({ ...passwordData, password_actual: text })}
                    secureTextEntry
                    placeholderTextColor={theme.textMuted}
                  />
                </View>
                <View>
                  <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Nueva Contraseña</Text>
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
                    value={passwordData.password_nueva}
                    onChangeText={(text) => setPasswordData({ ...passwordData, password_nueva: text })}
                    secureTextEntry
                    placeholderTextColor={theme.textMuted}
                  />
                </View>
                <View>
                  <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Confirmar Nueva Contraseña</Text>
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
                    value={passwordData.confirmar_password}
                    onChangeText={(text) => setPasswordData({ ...passwordData, confirmar_password: text })}
                    secureTextEntry
                    placeholderTextColor={theme.textMuted}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.saveButton, { backgroundColor: theme.accent, marginTop: 8 }]}
                  onPress={handleChangePassword}
                >
                  <Ionicons name="lock-closed" size={16} color="#fff" />
                  <Text style={styles.saveButtonText}>Actualizar Contraseña</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
  },
  tabsContainer: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  tabActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  profileCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  profileRole: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  profileExperience: {
    fontSize: 12,
  },
  section: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
  },
  infoBoxText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  cancelButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
});
