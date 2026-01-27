import { View, Text, ScrollView, TouchableOpacity, Image, TextInput, Alert, StyleSheet, RefreshControl, Modal, Dimensions, Platform, KeyboardAvoidingView } from 'react-native';
import { useState, useEffect, useRef } from 'react';
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

  const scrollViewRef = useRef<ScrollView>(null);
  const direccionRef = useRef<TextInput>(null);
  const contactoEmergenciaRef = useRef<TextInput>(null);

  const theme = darkMode
    ? {
      bg: '#0a0a0a',
      cardBg: '#141414',
      text: '#ffffff',
      textSecondary: '#a1a1aa',
      textMuted: '#71717a',
      border: '#27272a',
      accent: '#f59e0b',
      primaryGradient: ['#f59e0b', '#d97706'] as const,
      inputBg: '#1e1e1e',
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

      // --- VALIDACIONES DE TELÉFONO ---
      const telefono = formData.telefono?.trim() || '';

      if (telefono) {
        // 1. Debe empezar con 09
        if (!telefono.startsWith('09')) {
          Alert.alert('Formato Incorrecto', 'El teléfono debe empezar con 09');
          return;
        }

        // 2. Debe tener 10 dígitos
        if (telefono.length !== 10 || !/^\d+$/.test(telefono)) {
          Alert.alert('Número Inválido', 'El teléfono debe tener exactamente 10 números');
          return;
        }
      }

      // --- VALIDACIONES DE CONTACTO DE EMERGENCIA ---
      const contacto = formData.contacto_emergencia?.trim() || '';
      const telefonoPersonal = formData.telefono?.trim() || '';

      if (contacto) {
        // 1. Debe empezar con 09
        if (!contacto.startsWith('09')) {
          Alert.alert('Formato Incorrecto', 'El contacto de emergencia debe empezar con 09');
          return;
        }

        // 2. Debe tener 10 dígitos
        if (contacto.length !== 10 || !/^\d+$/.test(contacto)) {
          Alert.alert('Número Inválido', 'El contacto de emergencia debe tener exactamente 10 números');
          return;
        }

        // 3. No puede ser igual al teléfono personal
        if (contacto === telefonoPersonal) {
          Alert.alert('Atención', 'El contacto de emergencia no puede ser igual a tu número personal');
          return;
        }
      }

      // --- VALIDACIÓN DE EMAIL ---
      const email = formData.email?.trim() || '';
      if (email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          Alert.alert('Email Inválido', 'Por favor ingresa un email válido');
          return;
        }
      }

      const cleanedData = {
        nombres: formData.nombres || '',
        apellidos: formData.apellidos || '',
        email: formData.email || '',
        telefono: formData.telefono || '',
        direccion: formData.direccion || '',
        fecha_nacimiento: formData.fecha_nacimiento || null,
        genero: formData.genero || '',
        identificacion: formData.identificacion || '',
        contacto_emergencia: contacto
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
      Alert.alert('Error', error instanceof Error ? error.message : 'Error al actualizar el perfil');
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.password_nueva !== passwordData.confirmar_password) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return;
    }

    // Validaciones dinámicas
    const hasMinLength = passwordData.password_nueva.length >= 8;
    const hasUppercase = /[A-Z]/.test(passwordData.password_nueva);
    const hasLowercase = /[a-z]/.test(passwordData.password_nueva);
    const hasNumber = /[0-9]/.test(passwordData.password_nueva);
    const isPasswordSecure = hasMinLength && hasUppercase && hasLowercase && hasNumber;

    if (!isPasswordSecure) {
      Alert.alert('Error', 'La contraseña no cumple con todos los requisitos de seguridad');
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} />
          }
        >
          {/* PREMIUM HEADER - CLEAN NIKE EFFECT */}
          <Animated.View entering={FadeInDown.duration(400)}>
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
                  <Text style={[styles.headerTitle, { color: theme.text }]}>Mi Perfil</Text>
                  <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Gestiona tu información</Text>
                </View>
                <Ionicons name="person-circle" size={32} color={theme.accent} />
              </View>

              {/* AVATAR */}
              <TouchableOpacity
                style={styles.avatarContainer}
                onPress={() => setShowPhotoPreview(true)}
              >
                {fotoUrl ? (
                  <Image source={{ uri: fotoUrl }} style={[styles.avatar, { borderColor: theme.cardBg }]} />
                ) : (
                  <View style={[styles.avatarPlaceholder, { backgroundColor: theme.accent, borderColor: theme.cardBg }]}>
                    <Text style={styles.avatarText}>{getInitials()}</Text>
                  </View>
                )}
              </TouchableOpacity>

              <Text style={[styles.userName, { color: theme.text }]}>
                {estudiante?.nombres || estudiante?.nombre} {estudiante?.apellidos || estudiante?.apellido}
              </Text>
              <Text style={[styles.userRole, { color: theme.textMuted }]}>Estudiante</Text>
            </View>
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
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Identificación</Text>
                    <Text style={[styles.infoValue, { color: theme.text }]}>
                      {estudiante?.identificacion || estudiante?.cedula || 'No especificado'}
                    </Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: theme.textMuted }]}>Estado</Text>
                    <Text style={[styles.infoValue, { color: theme.success }]}>
                      {estudiante?.estado || 'Activo'}
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
                      <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Nombres</Text>
                      <TextInput
                        style={[
                          styles.input,
                          {
                            backgroundColor: isEditing ? theme.inputBg : 'transparent',
                            borderColor: theme.border,
                            color: theme.text
                          }
                        ]}
                        value={formData.nombres || ''}
                        onChangeText={(text) => {
                          // Solo letras y espacios, convertir a mayúsculas
                          const cleanText = text.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ ]/g, '').toUpperCase();
                          setFormData({ ...formData, nombres: cleanText });
                        }}
                        editable={isEditing}
                        placeholder="Nombres"
                        placeholderTextColor={theme.textMuted}
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Apellidos</Text>
                      <TextInput
                        style={[
                          styles.input,
                          {
                            backgroundColor: isEditing ? theme.inputBg : 'transparent',
                            borderColor: theme.border,
                            color: theme.text
                          }
                        ]}
                        value={formData.apellidos || ''}
                        onChangeText={(text) => {
                          // Solo letras y espacios, convertir a mayúsculas
                          const cleanText = text.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ ]/g, '').toUpperCase();
                          setFormData({ ...formData, apellidos: cleanText });
                        }}
                        editable={isEditing}
                        placeholder="Apellidos"
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
                        onChangeText={(text) => {
                          // Convertir a minúsculas y eliminar espacios
                          const cleanEmail = text.toLowerCase().replace(/\s/g, '');
                          setFormData({ ...formData, email: cleanEmail });
                        }}
                        editable={isEditing}
                        placeholder="Email"
                        placeholderTextColor={theme.textMuted}
                        keyboardType="email-address"
                        autoCapitalize="none"
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
                        onChangeText={(text) => {
                          // Solo números, máximo 10 dígitos
                          const cleanText = text.replace(/[^0-9]/g, '').slice(0, 10);
                          setFormData({ ...formData, telefono: cleanText });
                        }}
                        editable={isEditing}
                        placeholder="0987654321"
                        placeholderTextColor={theme.textMuted}
                        keyboardType="phone-pad"
                        maxLength={10}
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Dirección</Text>
                      <TextInput
                        ref={direccionRef}
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
                        onFocus={() => {
                          if (isEditing && scrollViewRef.current) {
                            setTimeout(() => {
                              scrollViewRef.current?.scrollTo({ y: 400, animated: true });
                            }, 100);
                          }
                        }}
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Contacto de Emergencia</Text>
                      <TextInput
                        ref={contactoEmergenciaRef}
                        style={[
                          styles.input,
                          {
                            backgroundColor: isEditing ? theme.inputBg : 'transparent',
                            borderColor: theme.border,
                            color: theme.text
                          }
                        ]}
                        value={formData.contacto_emergencia || ''}
                        onChangeText={(text) => {
                          // Solo números, máximo 10 dígitos
                          const cleanText = text.replace(/[^0-9]/g, '').slice(0, 10);
                          setFormData({ ...formData, contacto_emergencia: cleanText });
                        }}
                        editable={isEditing}
                        placeholder="0987654321"
                        placeholderTextColor={theme.textMuted}
                        keyboardType="phone-pad"
                        maxLength={10}
                        onFocus={() => {
                          if (isEditing && scrollViewRef.current) {
                            setTimeout(() => {
                              scrollViewRef.current?.scrollTo({ y: 500, animated: true });
                            }, 100);
                          }
                        }}
                      />
                    </View>
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
                        onFocus={() => {
                          if (scrollViewRef.current) {
                            setTimeout(() => {
                              scrollViewRef.current?.scrollTo({ y: 150, animated: true });
                            }, 100);
                          }
                        }}
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
                        onFocus={() => {
                          if (scrollViewRef.current) {
                            setTimeout(() => {
                              scrollViewRef.current?.scrollTo({ y: 250, animated: true });
                            }, 100);
                          }
                        }}
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

                    {/* Password Strength Checklist */}
                    {passwordData.password_nueva.length > 0 && (
                      <View style={{ marginTop: 10, gap: 4 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name={passwordData.password_nueva.length >= 8 ? "checkmark-circle" : "ellipse-outline"} size={14} color={passwordData.password_nueva.length >= 8 ? theme.success : theme.textMuted} />
                          <Text style={{ fontSize: 12, color: passwordData.password_nueva.length >= 8 ? theme.success : theme.textMuted }}>Mínimo 8 caracteres</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name={/[A-Z]/.test(passwordData.password_nueva) ? "checkmark-circle" : "ellipse-outline"} size={14} color={/[A-Z]/.test(passwordData.password_nueva) ? theme.success : theme.textMuted} />
                          <Text style={{ fontSize: 12, color: /[A-Z]/.test(passwordData.password_nueva) ? theme.success : theme.textMuted }}>Una mayúscula</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name={/[a-z]/.test(passwordData.password_nueva) ? "checkmark-circle" : "ellipse-outline"} size={14} color={/[a-z]/.test(passwordData.password_nueva) ? theme.success : theme.textMuted} />
                          <Text style={{ fontSize: 12, color: /[a-z]/.test(passwordData.password_nueva) ? theme.success : theme.textMuted }}>Una minúscula</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name={/[0-9]/.test(passwordData.password_nueva) ? "checkmark-circle" : "ellipse-outline"} size={14} color={/[0-9]/.test(passwordData.password_nueva) ? theme.success : theme.textMuted} />
                          <Text style={{ fontSize: 12, color: /[0-9]/.test(passwordData.password_nueva) ? theme.success : theme.textMuted }}>Un número</Text>
                        </View>
                      </View>
                    )}
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
                        onFocus={() => {
                          if (scrollViewRef.current) {
                            setTimeout(() => {
                              scrollViewRef.current?.scrollTo({ y: 350, animated: true });
                            }, 100);
                          }
                        }}
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
      </KeyboardAvoidingView>

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
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 10,
    paddingBottom: 80, // Reduced bottom padding significantly for overlap
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30, // Keep slightly larger for profile aesthetic
    borderBottomRightRadius: 30,
    alignItems: 'center',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#fff',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  userRole: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginTop: -40,
    zIndex: 10,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    padding: 16,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  editButton: {
    padding: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 13,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  formGrid: {
    gap: 12,
  },
  inputGroup: {
    marginBottom: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 14,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    padding: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  cancelButton: {
    borderWidth: 1,
  },
  saveButton: {
    // backgroundColor set dynamically
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: width * 0.9,
    aspectRatio: 1,
  },
  modalImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  modalImagePlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImageText: {
    fontSize: 80,
    fontWeight: '700',
    color: '#fff',
  },
});
