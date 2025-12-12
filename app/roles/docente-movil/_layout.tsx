import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Switch, Alert, Image, TextInput } from 'react-native';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { eventEmitter } from '../../../services/eventEmitter';
import { getToken, getUserData, setUserData as saveUserData, getDarkMode, clearAll, storage } from '../../../services/storage';
import { API_URL } from '../../../constants/config';
import { useNotifications } from '../../../hooks/useNotifications';
import NotificationBell from '../../../components/NotificationBell';

export default function DocenteLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [darkMode, setDarkMode] = useState(false);
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const [userData, setUserData] = useState<any>(null);

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

  const {
    notificaciones,
    marcarTodasLeidas
  } = useNotifications('docente');

  useEffect(() => {
    loadUserData();
    loadDarkMode();
    checkPasswordReset();

    const themeHandler = (isDark: boolean) => setDarkMode(isDark);
    const drawerHandler = () => setShowProfileDrawer(true);

    eventEmitter.on('themeChanged', themeHandler);
    eventEmitter.on('openProfileDrawer', drawerHandler);

    return () => {
      eventEmitter.off('themeChanged', themeHandler);
      eventEmitter.off('openProfileDrawer', drawerHandler);
    };
  }, []);

  const loadUserData = async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setUserData(data);
        await saveUserData(data);
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
    }
  };

  const loadDarkMode = async () => {
    try {
      const savedMode = await getDarkMode();
      setDarkMode(savedMode);
    } catch (error) {
      console.error('Error cargando modo oscuro:', error);
    }
  };

  const checkPasswordReset = async () => {
    try {
      const data = await getUserData();
      if (data?.requiere_cambio_password) {
        setIsRequiredPasswordChange(true);
        setIsFirstLogin(data?.primer_login || false);
        setShowPasswordModal(true);
      }
    } catch (error) {
      console.error('Error verificando cambio de contraseña:', error);
    }
  };

  const toggleDarkMode = async (value: boolean) => {
    setDarkMode(value);
    await storage.setItem('dark_mode', value.toString());
    eventEmitter.emit('themeChanged', value);
  };

  const handlePhotoOptions = () => {
    const options: any[] = [
      { text: 'Tomar Foto', onPress: () => takePhoto() },
      { text: 'Elegir de Galería', onPress: () => pickImage() },
    ];

    if (userData?.foto_perfil) {
      options.push({ text: 'Eliminar Foto', onPress: () => deletePhoto(), style: 'destructive' });
    }

    options.push({ text: 'Cancelar', style: 'cancel' });

    Alert.alert('Foto de Perfil', 'Selecciona una opción', options);
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
              if (!userData?.id_usuario) return;

              const response = await fetch(`${API_URL}/usuarios/${userData.id_usuario}/foto-perfil`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
              });

              if (response.ok) {
                await loadUserData();
                eventEmitter.emit('profilePhotoUpdated');
                Alert.alert('Éxito', 'Foto eliminada correctamente');
              } else {
                Alert.alert('Error', 'No se pudo eliminar la foto');
              }
            } catch (error) {
              console.error('Error eliminando foto:', error);
              Alert.alert('Error', 'Error al eliminar la foto');
            }
          }
        }
      ]
    );
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso Denegado', 'Se necesita acceso a la cámara');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      uploadPhoto(result.assets[0].uri);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso Denegado', 'Se necesita acceso a la galería');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      uploadPhoto(result.assets[0].uri);
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

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        await loadUserData();
        eventEmitter.emit('profilePhotoUpdated');
        Alert.alert('Éxito', 'Foto actualizada correctamente');
      } else {
        const errorText = await response.text();
        console.log('Error response:', errorText);
        Alert.alert('Error', 'No se pudo actualizar la foto');
      }
    } catch (error: any) {
      console.error('Error subiendo foto:', error);
      Alert.alert('Error', error?.message || 'No se pudo actualizar la foto');
    }
  };

  const handleChangePassword = async () => {
    if (!passwordData.password_actual || !passwordData.password_nueva || !passwordData.confirmar_password) {
      Alert.alert('Error', 'Todos los campos son obligatorios');
      return;
    }

    if (passwordData.password_nueva.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
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
        body: JSON.stringify(passwordData),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert('Éxito', 'Contraseña cambiada correctamente');
        setShowPasswordModal(false);
        setIsRequiredPasswordChange(false);
        setPasswordData({
          password_actual: '',
          password_nueva: '',
          confirmar_password: ''
        });

        const updatedUserData = { ...userData, requiere_cambio_password: false, primer_login: false };
        await saveUserData(updatedUserData);
        setUserData(updatedUserData);
      } else {
        Alert.alert('Error', data.message || 'No se pudo cambiar la contraseña');
      }
    } catch (error) {
      Alert.alert('Error', 'Error al cambiar la contraseña');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro que deseas salir?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: async () => {
            await clearAll();
            router.replace('/');
          },
        },
      ]
    );
  };

  const theme = {
    bg: darkMode ? '#000000' : '#f8fafc',
    cardBg: darkMode ? '#1a1a1a' : '#ffffff',
    text: darkMode ? '#ffffff' : '#1e293b',
    textSecondary: darkMode ? 'rgba(255,255,255,0.7)' : 'rgba(30,41,59,0.7)',
    textMuted: darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(30,41,59,0.5)',
    border: darkMode ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.3)',
    accent: '#3b82f6',
    tabActive: '#3b82f6',
    tabInactive: darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(30,41,59,0.5)',
    tabBg: darkMode ? '#000000' : '#ffffff',
    headerBg: darkMode ? '#000000' : '#ffffff',
  };

  const getInitials = () => {
    if (!userData) return '?';
    const nombre = userData.nombre || userData.nombres || '';
    const apellido = userData.apellido || userData.apellidos || '';
    return `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase();
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
        headerTitle: 'MI PANEL DOCENTE',
        headerTitleAlign: 'left',
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 16,
          letterSpacing: 0.5,
        },
        headerRight: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
            <NotificationBell
              notificaciones={notificaciones}
              onMarcarTodasLeidas={marcarTodasLeidas}
              darkMode={darkMode}
            />
            <TouchableOpacity
              onPress={() => setShowProfileDrawer(true)}
              style={styles.profileButton}
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
        tabBarActiveTintColor: theme.tabActive,
        tabBarInactiveTintColor: theme.tabInactive,
        tabBarStyle: {
          backgroundColor: theme.tabBg,
          borderTopColor: theme.border,
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: 8 + insets.bottom,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Mi Aula',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="stats-chart" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="cursos"
        options={{
          title: 'Cursos',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="book" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="estudiantes"
        options={{
          title: 'Estudiantes',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="asistencia"
        options={{
          title: 'Asistencia',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="checkmark-circle" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="calificaciones"
        options={{
          title: 'Notas',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="school" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="horario"
        options={{
          title: 'Horario',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          href: null,
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="detallecursodocente"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="calificaciones-curso"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="ModalModulo"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="ModalTarea"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="ModalCalificaciones"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="ModalEntregas"
        options={{
          href: null,
        }}
      />
    </Tabs>

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
            <View style={styles.drawerHeader}>
              <TouchableOpacity onPress={() => setShowProfileDrawer(false)}>
                <Ionicons name="close" size={28} color={theme.text} />
              </TouchableOpacity>
              <Text style={[styles.drawerTitle, { color: theme.text }]}>Configuración</Text>
            </View>

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
                {userData?.email || 'docente@belleza.com'}
              </Text>
            </View>

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

            <TouchableOpacity
              style={[styles.settingItem, { borderBottomColor: theme.border }]}
              onPress={() => {
                setShowProfileDrawer(false);
                setTimeout(() => router.push('/roles/docente-movil/perfil' as any), 300);
              }}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="person-outline" size={24} color={theme.accent} />
                <Text style={[styles.settingText, { color: theme.text }]}>Mi Perfil</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
            </TouchableOpacity>

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

    <Modal
      visible={showPasswordModal}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!isRequiredPasswordChange) {
          setShowPasswordModal(false);
        }
      }}
    >
      <View style={styles.passwordModalOverlay}>
        <View style={[styles.passwordModalContent, { backgroundColor: theme.cardBg }]}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.passwordModalHeader}>
              <View style={[styles.passwordIconContainer, { backgroundColor: theme.accent + '20' }]}>
                <Ionicons name="lock-closed" size={32} color={theme.accent} />
              </View>
              <Text style={[styles.passwordModalTitle, { color: theme.text }]}>
                {isFirstLogin ? 'Bienvenido/a' : 'Cambio de Contraseña'}
              </Text>
              <Text style={[styles.passwordModalSubtitle, { color: theme.textSecondary }]}>
                {isFirstLogin 
                  ? 'Por seguridad, debes cambiar tu contraseña en el primer acceso'
                  : 'Por seguridad, debes cambiar tu contraseña'
                }
              </Text>
            </View>

            <View style={styles.passwordForm}>
              <View style={styles.passwordField}>
                <Text style={[styles.passwordLabel, { color: theme.text }]}>Contraseña Actual</Text>
                <View style={[styles.passwordInputContainer, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                  <Ionicons name="lock-closed-outline" size={20} color={theme.textMuted} />
                  <TextInput
                    style={[styles.passwordInput, { color: theme.text }]}
                    value={passwordData.password_actual}
                    onChangeText={(text) => setPasswordData(prev => ({ ...prev, password_actual: text }))}
                    secureTextEntry={!showCurrentPassword}
                    placeholder="Ingresa tu contraseña actual"
                    placeholderTextColor={theme.textMuted}
                  />
                  <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)}>
                    <Ionicons name={showCurrentPassword ? 'eye-off' : 'eye'} size={20} color={theme.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.passwordField}>
                <Text style={[styles.passwordLabel, { color: theme.text }]}>Nueva Contraseña</Text>
                <View style={[styles.passwordInputContainer, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                  <Ionicons name="key-outline" size={20} color={theme.textMuted} />
                  <TextInput
                    style={[styles.passwordInput, { color: theme.text }]}
                    value={passwordData.password_nueva}
                    onChangeText={(text) => setPasswordData(prev => ({ ...prev, password_nueva: text }))}
                    secureTextEntry={!showNewPassword}
                    placeholder="Mínimo 6 caracteres"
                    placeholderTextColor={theme.textMuted}
                  />
                  <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
                    <Ionicons name={showNewPassword ? 'eye-off' : 'eye'} size={20} color={theme.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.passwordField}>
                <Text style={[styles.passwordLabel, { color: theme.text }]}>Confirmar Nueva Contraseña</Text>
                <View style={[styles.passwordInputContainer, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
                  <Ionicons name="checkmark-circle-outline" size={20} color={theme.textMuted} />
                  <TextInput
                    style={[styles.passwordInput, { color: theme.text }]}
                    value={passwordData.confirmar_password}
                    onChangeText={(text) => setPasswordData(prev => ({ ...prev, confirmar_password: text }))}
                    secureTextEntry={!showConfirmPassword}
                    placeholder="Repite la nueva contraseña"
                    placeholderTextColor={theme.textMuted}
                  />
                  <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                    <Ionicons name={showConfirmPassword ? 'eye-off' : 'eye'} size={20} color={theme.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.passwordButton, { backgroundColor: theme.accent }]}
                onPress={handleChangePassword}
              >
                <Text style={styles.passwordButtonText}>Cambiar Contraseña</Text>
              </TouchableOpacity>

              {!isRequiredPasswordChange && (
                <TouchableOpacity
                  style={[styles.passwordCancelButton, { borderColor: theme.border }]}
                  onPress={() => setShowPasswordModal(false)}
                >
                  <Text style={[styles.passwordCancelText, { color: theme.textSecondary }]}>Cancelar</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  profileButton: {
    marginRight: 16,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  headerAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#3b82f6',
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
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#3b82f6',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#3b82f6',
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
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    fontWeight: '500',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  passwordModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  passwordModalContent: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    maxHeight: '80%',
  },
  passwordModalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  passwordIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  passwordModalTitle: {
    fontSize: 20,
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
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
  },
  passwordButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  passwordButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  passwordCancelButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    marginTop: 8,
  },
  passwordCancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
