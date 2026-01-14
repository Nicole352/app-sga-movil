import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Switch, Alert, Image, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { eventEmitter } from '../../../services/eventEmitter';
import { storage, getToken } from '../../../services/storage';
import { API_URL } from '../../../constants/config';
import { useNotifications } from '../../../hooks/useNotifications';
import NotificationBell from '../../../components/NotificationBell';

export default function EstudianteLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [darkMode, setDarkMode] = useState(false);
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);

  const [userData, setUserData] = useState<any>(null);

  // Estados para modal de cambio de contraseña obligatorio
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [isRequiredPasswordChange, setIsRequiredPasswordChange] = useState(false);
  const [isFirstLogin, setIsFirstLogin] = useState(true);
  const [passwordData, setPasswordData] = useState({
    password_actual: '',
    password_nueva: '',
    confirmar_password: ''
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Hook de notificaciones con WebSocket
  const {
    notificaciones,
    marcarTodasLeidas
  } = useNotifications('estudiante');

  useEffect(() => {
    loadUserData();
    loadDarkMode();
    checkPasswordReset();

    eventEmitter.on('themeChanged', (isDark: boolean) => {
      setDarkMode(isDark);
    });

    eventEmitter.on('openProfileDrawer', () => {
      setShowProfileDrawer(true);
    });
  }, []);

  const loadUserData = async () => {
    try {
      const userDataStr = await storage.getItem('user_data');
      if (userDataStr) {
        const data = JSON.parse(userDataStr);
        setUserData(data);
        // Check local data first for immediate modal show
        if (data.needs_password_reset) {
          setShowPasswordModal(true);
          setIsRequiredPasswordChange(true);
          setIsFirstLogin(data.is_first_login !== false);
        }
      }
      await fetchPerfil();
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadDarkMode = async () => {
    try {
      const savedMode = await storage.getItem('dark_mode');
      if (savedMode !== null) {
        setDarkMode(savedMode === 'true');
      }
    } catch (error) {
      console.error('Error loading dark mode:', error);
    }
  };

  const fetchPerfil = async () => {
    try {
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
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const checkPasswordReset = async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.needs_password_reset) {
          setShowPasswordModal(true);
          setIsRequiredPasswordChange(true);
          setIsFirstLogin(data.is_first_login !== false);
          // Actualizar storage local con la info fresca
          await storage.setItem('user_data', JSON.stringify(data));
        }
      }
    } catch (error) {
      console.error('Error verificando estado de contraseña:', error);
    }
  };

  const handlePasswordChange = async () => {
    if ((!isRequiredPasswordChange && !passwordData.password_actual) || !passwordData.password_nueva || !passwordData.confirmar_password) {
      Alert.alert('Error', 'Por favor completa todos los campos');
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

    try {
      const token = await getToken();
      const endpoint = isRequiredPasswordChange
        ? `${API_URL}/auth/reset-password`
        : `${API_URL}/usuarios/cambiar-password`;

      const method = isRequiredPasswordChange ? 'POST' : 'PUT';

      const body = isRequiredPasswordChange
        ? { newPassword: passwordData.password_nueva, confirmPassword: passwordData.confirmar_password }
        : { password_actual: passwordData.password_actual, password_nueva: passwordData.password_nueva };

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert(
          'Éxito',
          isFirstLogin
            ? '¡Contraseña actualizada! Ya puedes usar el sistema.'
            : 'Contraseña actualizada correctamente',
          [
            {
              text: 'OK',
              onPress: () => {
                setShowPasswordModal(false);
                setIsRequiredPasswordChange(false);
                setPasswordData({
                  password_actual: '',
                  password_nueva: '',
                  confirmar_password: ''
                });
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', data.error || 'No se pudo cambiar la contraseña');
      }
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'Error al cambiar la contraseña');
    }
  };

  const toggleDarkMode = async (value: boolean) => {
    setDarkMode(value);
    await storage.setItem('dark_mode', value.toString());
    eventEmitter.emit('themeChanged', value);
  };

  const handleLogout = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro que deseas cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Sesión',
          style: 'destructive',
          onPress: async () => {
            await storage.clear();
            setShowProfileDrawer(false);
            router.replace('/aula-virtual');
          },
        },
      ]
    );
  };

  const handlePhotoOptions = () => {
    const options: any[] = [
      { text: 'Cámara', onPress: takePhoto },
      { text: 'Galería', onPress: pickImage },
    ];

    if (userData?.foto_perfil) {
      options.push({ text: 'Eliminar foto', onPress: deletePhoto, style: 'destructive' });
    }

    options.push({ text: 'Cancelar', style: 'cancel' });

    Alert.alert('Foto de Perfil', 'Elige una opción', options);
  };

  const pickImage = async () => {
    try {
      console.log('Solicitando permiso de galería...');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('Status de permiso de galería:', status);

      if (status !== 'granted') {
        Alert.alert(
          'Permiso denegado',
          'Ve a Ajustes → Expo Go → Fotos y selecciona "Todas las fotos"',
          [{ text: 'OK' }]
        );
        return;
      }

      console.log('Abriendo galería...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      console.log('Galería respondió');
      console.log('Resultado:', result.canceled ? 'Cancelado' : 'Imagen seleccionada');

      if (!result.canceled && result.assets && result.assets[0]) {
        console.log('URI de la imagen:', result.assets[0].uri);
        await uploadPhoto(result.assets[0].uri);
      } else {
        console.log('No se seleccionó imagen');
      }
    } catch (error: any) {
      console.error('Error en pickImage:', error);
      Alert.alert('Error', `Error al abrir la galería: ${error?.message || 'Desconocido'}`);
    }
  };

  const takePhoto = async () => {
    try {
      console.log('Solicitando permiso de cámara...');
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      console.log('Status de permiso de cámara:', status);

      if (status !== 'granted') {
        Alert.alert(
          'Permiso denegado',
          'Necesitamos acceso a tu cámara para tomar una foto. Por favor, ve a Configuración y habilita el permiso.',
          [{ text: 'OK' }]
        );
        return;
      }

      console.log('Intentando abrir cámara...');

      // Intentamos configuración mínima para evitar crashes en algunos dispositivos
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false, // Desactivado temporalmente para aislar el error
        quality: 0.5,
      });

      console.log('Cámara respondió');
      console.log('Resultado:', result.canceled ? 'Cancelado' : 'Foto tomada');

      if (!result.canceled && result.assets && result.assets[0]) {
        console.log('URI de la foto:', result.assets[0].uri);
        await uploadPhoto(result.assets[0].uri);
      } else {
        console.log('No se tomó foto o se canceló');
      }
    } catch (error: any) {
      console.error('Error en takePhoto:', error);
      Alert.alert('Error', `Error al abrir la cámara: ${error?.message || 'La cámara no responde. Intenta reiniciar la app.'}`);
    }
  };

  const uploadPhoto = async (uri: string) => {
    try {
      const token = await getToken();

      if (!userData?.id_usuario) {
        Alert.alert('Error', 'No se pudo obtener la información del usuario');
        return;
      }

      const formData = new FormData();

      const filename = uri.split('/').pop() || 'photo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('foto', {
        uri,
        name: filename,
        type
      } as any);

      console.log('Subiendo foto para usuario:', userData.id_usuario);
      const url = `${API_URL}/usuarios/${userData.id_usuario}/foto-perfil`;
      console.log('URL:', url);

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData
      });

      console.log('Response status:', response.status);

      if (response.ok) {
        await fetchPerfil();
        eventEmitter.emit('profilePhotoUpdated');
        Alert.alert('Éxito', 'Foto actualizada correctamente');
      } else {
        const errorText = await response.text();
        console.log('Error response:', errorText);
        Alert.alert('Error', 'No se pudo actualizar la foto');
      }
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'Error al subir la foto');
    }
  };

  const deletePhoto = async () => {
    Alert.alert(
      'Eliminar foto',
      '¿Estás seguro de que quieres eliminar tu foto de perfil?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getToken();
              const response = await fetch(`${API_URL}/usuarios/${userData.id_usuario}/foto-perfil`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
              });

              if (response.ok) {
                await fetchPerfil();
                eventEmitter.emit('profilePhotoUpdated');
                Alert.alert('Éxito', 'Foto eliminada correctamente');
              }
            } catch (error) {
              console.error('Error:', error);
              Alert.alert('Error', 'Error al eliminar la foto');
            }
          }
        }
      ]
    );
  };

  const getInitials = () => {
    if (!userData) return '?';
    const nombres = userData.nombres || userData.nombre || '';
    const apellidos = userData.apellidos || userData.apellido || '';
    return `${nombres.charAt(0)}${apellidos.charAt(0)}`.toUpperCase();
  };

  const theme = darkMode ? {
    bg: '#0a0a0a',
    cardBg: '#141414',
    text: '#fff',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',
    border: '#27272a',
    accent: '#f59e0b',
    tabBg: '#0a0a0a',
    tabActive: '#f59e0b',
    tabInactive: '#71717a',
  } : {
    bg: '#f8fafc',
    cardBg: '#ffffff',
    text: '#1e293b',
    textSecondary: 'rgba(30, 41, 59, 0.7)',
    textMuted: 'rgba(30, 41, 59, 0.5)',
    border: '#e2e8f0',
    accent: '#f59e0b',
    tabBg: '#ffffff',
    tabActive: '#f59e0b',
    tabInactive: 'rgba(30, 41, 59, 0.5)',
  };

  return (
    <>
      <Tabs
        key={darkMode ? 'dark' : 'light'}
        screenOptions={{
          headerShown: true,
          headerStyle: {
            backgroundColor: theme.cardBg,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
          },
          headerTintColor: theme.text,
          headerTitle: 'MI PANEL ESTUDIANTIL',
          headerTitleAlign: 'left',
          headerTitleStyle: {
            fontWeight: '700',
            fontSize: 16,
            letterSpacing: 0.5,
          },
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16, gap: 12 }}>
              <NotificationBell
                notificaciones={notificaciones}
                onMarcarTodasLeidas={marcarTodasLeidas}
                darkMode={darkMode}
              />
              <TouchableOpacity
                onPress={() => setShowProfileDrawer(true)}
                style={[styles.profileButton, { marginRight: 0 }]}
              >
                {userData?.foto_perfil ? (
                  <Image
                    source={{ uri: userData.foto_perfil }}
                    style={styles.headerAvatar}
                  />
                ) : (
                  <View style={[styles.headerAvatarPlaceholder, { backgroundColor: theme.accent }]}>
                    <Text style={styles.headerAvatarText}>{getInitials()}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          ),
          tabBarShowLabel: false,
          headerShadowVisible: false,
          tabBarActiveTintColor: theme.accent,
          tabBarInactiveTintColor: theme.textMuted,
          tabBarStyle: {
            backgroundColor: theme.cardBg,
            borderTopColor: theme.border,
            borderTopWidth: 1,
            height: 60 + insets.bottom,
            paddingTop: 12,
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            elevation: 0,
          },
        }}
      >
        <Tabs.Screen
          name="miaula"
          options={{
            title: 'Mi Aula',
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? "school" : "school-outline"} size={28} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="horario"
          options={{
            title: 'Horario',
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? "calendar" : "calendar-outline"} size={28} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="calificaciones"
          options={{
            title: 'Notas',
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? "ribbon" : "ribbon-outline"} size={28} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="historial"
          options={{
            title: 'Historial',
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? "time" : "time-outline"} size={28} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="servicios"
          options={{
            title: 'Servicios',
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? "grid" : "grid-outline"} size={28} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="perfil"
          options={{
            href: null, // Oculto - accesible desde el drawer
            title: 'Perfil',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="detallecursoestudiante"
          options={{
            href: null, // Esto oculta la pantalla de los tabs
            headerShown: false,
          }}
        />
        <Tabs.Screen
          name="tareasestudiante"
          options={{
            href: null, // Esto oculta la pantalla de los tabs
          }}
        />
        <Tabs.Screen
          name="pagosmensuales"
          options={{
            href: null, // Esto oculta la pantalla de los tabs
          }}
        />
      </Tabs>

      {/* Drawer lateral derecho para perfil */}
      <Modal
        visible={showProfileDrawer}
        animationType="slide"
        transparent
        onRequestClose={() => setShowProfileDrawer(false)}
      >
        <TouchableOpacity
          style={styles.drawerOverlay}
          activeOpacity={1}
          onPress={() => setShowProfileDrawer(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.drawerContent, { backgroundColor: theme.cardBg }]}
            onPress={(e) => e.stopPropagation()}
          >
            <ScrollView>
              {/* Header del drawer */}
              <View style={styles.drawerHeader}>
                <TouchableOpacity onPress={() => setShowProfileDrawer(false)}>
                  <Ionicons name="close" size={28} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.drawerTitle, { color: theme.text }]}>Configuración</Text>
              </View>

              {/* Perfil */}
              <View style={[styles.profileSection, { borderBottomColor: theme.border }]}>
                <TouchableOpacity
                  style={styles.avatarContainer}
                  onPress={() => {
                    setShowProfileDrawer(false);
                    setTimeout(() => handlePhotoOptions(), 300);
                  }}
                >
                  {userData?.foto_perfil ? (
                    <Image source={{ uri: userData.foto_perfil }} style={styles.avatarImage} />
                  ) : (
                    <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
                      <Text style={styles.avatarText}>{getInitials()}</Text>
                    </View>
                  )}
                  <View style={[styles.cameraIcon, { backgroundColor: theme.accent }]}>
                    <Ionicons name="camera" size={16} color="#fff" />
                  </View>
                </TouchableOpacity>
                <Text style={[styles.profileName, { color: theme.text }]}>
                  {userData?.nombres || userData?.nombre} {userData?.apellidos || userData?.apellido}
                </Text>
                <Text style={[styles.profileEmail, { color: theme.textSecondary }]}>
                  {userData?.email || 'estudiante@belleza.com'}
                </Text>
              </View>

              {/* Modo oscuro */}
              <View style={[styles.settingItem, { borderBottomColor: theme.border }]}>
                <View style={styles.settingLeft}>
                  <Ionicons
                    name={darkMode ? 'moon' : 'sunny'}
                    size={24}
                    color={theme.accent}
                  />
                  <Text style={[styles.settingText, { color: theme.text }]}>Modo Oscuro</Text>
                </View>
                <Switch
                  value={darkMode}
                  onValueChange={toggleDarkMode}
                  trackColor={{ false: '#767577', true: theme.accent }}
                  thumbColor="#fff"
                />
              </View>

              {/* Perfil */}
              <TouchableOpacity
                style={[styles.settingItem, { borderBottomColor: theme.border }]}
                onPress={() => {
                  setShowProfileDrawer(false);
                  setTimeout(() => router.push('/roles/estudiante-movil/perfil'), 300);
                }}
              >
                <View style={styles.settingLeft}>
                  <Ionicons name="person-outline" size={24} color={theme.accent} />
                  <Text style={[styles.settingText, { color: theme.text }]}>Mi Perfil</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
              </TouchableOpacity>

              {/* Cerrar sesión */}
              <TouchableOpacity
                style={[styles.settingItem, { borderBottomWidth: 0 }]}
                onPress={handleLogout}
              >
                <View style={styles.settingLeft}>
                  <Ionicons name="log-out-outline" size={24} color="#ef4444" />
                  <Text style={[styles.settingText, { color: '#ef4444' }]}>Cerrar Sesión</Text>
                </View>
              </TouchableOpacity>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Modal de cambio de contraseña OBLIGATORIO */}
      <Modal
        visible={showPasswordModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!isRequiredPasswordChange) {
            setShowPasswordModal(false);
          }
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.passwordModalOverlay}
        >
          <View style={[styles.passwordModalContent, { backgroundColor: theme.cardBg }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Header */}
              <View style={styles.passwordModalHeader}>
                <View style={[styles.passwordIconContainer, { backgroundColor: theme.accent + '20' }]}>
                  <Ionicons name="lock-closed" size={32} color={theme.accent} />
                </View>
                <Text style={[styles.passwordModalTitle, { color: theme.text }]}>
                  {isFirstLogin ? '¡Bienvenido!' : 'Cambiar Contraseña'}
                </Text>
                <Text style={[styles.passwordModalSubtitle, { color: theme.textSecondary }]}>
                  {isFirstLogin
                    ? 'Por seguridad, debes cambiar tu contraseña antes de continuar'
                    : 'Actualiza tu contraseña de acceso'}
                </Text>
              </View>

              {/* Formulario */}
              <View style={styles.passwordForm}>
                {!isRequiredPasswordChange && (
                  <View style={styles.passwordField}>
                    <Text style={[styles.passwordLabel, { color: theme.text }]}>Contraseña Actual</Text>
                    <View style={[styles.passwordInputContainer, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                      <Ionicons name="lock-closed-outline" size={20} color={theme.textMuted} />
                      <TextInput
                        style={[styles.passwordInput, { color: theme.text }]}
                        value={passwordData.password_actual}
                        onChangeText={(text: string) => setPasswordData({ ...passwordData, password_actual: text })}
                        secureTextEntry={!showCurrentPassword}
                        placeholder="Ingresa tu contraseña actual"
                        placeholderTextColor={theme.textMuted}
                      />
                      <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)}>
                        <Ionicons name={showCurrentPassword ? 'eye-off' : 'eye'} size={20} color={theme.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                <View style={styles.passwordField}>
                  <Text style={[styles.passwordLabel, { color: theme.text }]}>Nueva Contraseña</Text>
                  <View style={[styles.passwordInputContainer, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                    <Ionicons name="key-outline" size={20} color={theme.textMuted} />
                    <TextInput
                      style={[styles.passwordInput, { color: theme.text }]}
                      value={passwordData.password_nueva}
                      onChangeText={(text: string) => setPasswordData({ ...passwordData, password_nueva: text })}
                      secureTextEntry={!showNewPassword}
                      placeholder="Mínimo 8 caracteres"
                      placeholderTextColor={theme.textMuted}
                    />
                    <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
                      <Ionicons name={showNewPassword ? 'eye-off' : 'eye'} size={20} color={theme.textMuted} />
                    </TouchableOpacity>
                  </View>

                  {/* Password Strength Checklist */}
                  {passwordData.password_nueva.length > 0 && (
                    <View style={{ marginTop: 10, gap: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name={passwordData.password_nueva.length >= 8 ? "checkmark-circle" : "ellipse-outline"} size={14} color={passwordData.password_nueva.length >= 8 ? '#10b981' : theme.textMuted} />
                        <Text style={{ fontSize: 12, color: passwordData.password_nueva.length >= 8 ? '#10b981' : theme.textMuted }}>Mínimo 8 caracteres</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name={/[A-Z]/.test(passwordData.password_nueva) ? "checkmark-circle" : "ellipse-outline"} size={14} color={/[A-Z]/.test(passwordData.password_nueva) ? '#10b981' : theme.textMuted} />
                        <Text style={{ fontSize: 12, color: /[A-Z]/.test(passwordData.password_nueva) ? '#10b981' : theme.textMuted }}>Una mayúscula</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name={/[a-z]/.test(passwordData.password_nueva) ? "checkmark-circle" : "ellipse-outline"} size={14} color={/[a-z]/.test(passwordData.password_nueva) ? '#10b981' : theme.textMuted} />
                        <Text style={{ fontSize: 12, color: /[a-z]/.test(passwordData.password_nueva) ? '#10b981' : theme.textMuted }}>Una minúscula</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name={/[0-9]/.test(passwordData.password_nueva) ? "checkmark-circle" : "ellipse-outline"} size={14} color={/[0-9]/.test(passwordData.password_nueva) ? '#10b981' : theme.textMuted} />
                        <Text style={{ fontSize: 12, color: /[0-9]/.test(passwordData.password_nueva) ? '#10b981' : theme.textMuted }}>Un número</Text>
                      </View>
                    </View>
                  )}
                </View>

                <View style={styles.passwordField}>
                  <Text style={[styles.passwordLabel, { color: theme.text }]}>Confirmar Contraseña</Text>
                  <View style={[styles.passwordInputContainer, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                    <Ionicons name="checkmark-circle-outline" size={20} color={theme.textMuted} />
                    <TextInput
                      style={[styles.passwordInput, { color: theme.text }]}
                      value={passwordData.confirmar_password}
                      onChangeText={(text: string) => setPasswordData({ ...passwordData, confirmar_password: text })}
                      secureTextEntry={!showConfirmPassword}
                      placeholder="Repite la nueva contraseña"
                      placeholderTextColor={theme.textMuted}
                    />
                    <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                      <Ionicons name={showConfirmPassword ? 'eye-off' : 'eye'} size={20} color={theme.textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Requisitos */}
                <View style={[styles.passwordRequirements, { backgroundColor: darkMode ? 'rgba(251, 191, 36, 0.1)' : 'rgba(251, 191, 36, 0.05)', borderColor: theme.accent + '30' }]}>
                  <Ionicons name="information-circle" size={16} color={theme.accent} />
                  <Text style={[styles.passwordRequirementsText, { color: theme.textSecondary }]}>
                    La contraseña debe tener al menos 8 caracteres
                  </Text>
                </View>
              </View>

              {/* Botones */}
              <View style={styles.passwordModalActions}>
                <TouchableOpacity
                  style={[styles.passwordModalButton, { backgroundColor: theme.accent }]}
                  onPress={handlePasswordChange}
                >
                  <Ionicons name="checkmark-circle" size={20} color="#fff" />
                  <Text style={styles.passwordModalButtonText}>
                    {isFirstLogin ? 'Establecer Contraseña' : 'Cambiar Contraseña'}
                  </Text>
                </TouchableOpacity>

                {!isRequiredPasswordChange && (
                  <TouchableOpacity
                    style={[styles.passwordModalButton, { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.border }]}
                    onPress={() => setShowPasswordModal(false)}
                  >
                    <Text style={[styles.passwordModalButtonText, { color: theme.text }]}>Cancelar</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}


const styles = StyleSheet.create({
  profileButton: {
    marginRight: 16,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#fbbf24',
  },
  headerAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fbbf24',
  },
  headerAvatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  drawerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  drawerContent: {
    width: '100%',
    maxHeight: '80%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 16,
  },
  drawerTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 1,
    marginHorizontal: 20,
  },
  avatarContainer: {
    marginBottom: 16,
    position: 'relative',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  settingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  photoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  photoModalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    gap: 12,
  },
  photoModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  photoModalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  photoModalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  photoModalButtonTextWhite: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  passwordModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  passwordModalContent: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    borderRadius: 24,
    padding: 24,
  },
  passwordModalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  passwordIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  passwordModalTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  passwordModalSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  passwordForm: {
    gap: 16,
    marginBottom: 24,
  },
  passwordField: {
    gap: 8,
  },
  passwordLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  passwordInput: {
    flex: 1,
    fontSize: 14,
  },
  passwordRequirements: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  passwordRequirementsText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  passwordModalActions: {
    gap: 12,
  },
  passwordModalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
  },
  passwordModalButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
