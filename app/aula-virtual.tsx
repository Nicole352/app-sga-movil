import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../constants/config';
import { storage } from '../services/storage';

export default function AulaVirtual() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    identifier: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!formData.identifier || !formData.password) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    setIsLoading(true);

    try {
      const isEmail = formData.identifier.includes('@');
      const payload = isEmail
        ? { email: formData.identifier.trim(), password: formData.password }
        : { username: formData.identifier.trim(), password: formData.password };

      const loginUrl = `${API_URL}/auth/login`;
      console.log('🔐 Intentando login en:', loginUrl);
      console.log('📦 Payload:', { ...payload, password: '***' });

      const res = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      console.log('📡 Respuesta status:', res.status);

      if (!res.ok) {
        let errorMessage = 'Credenciales inválidas';
        try {
          const errorData = await res.json();
          console.log('❌ Error del servidor:', errorData);
          if (errorData.error) {
            errorMessage = errorData.error;
          } else if (errorData.bloqueada) {
            errorMessage = errorData.motivo || 'Su cuenta ha sido bloqueada. Por favor, contacte con el área administrativa.';
          }
        } catch (parseError) {
          console.log('❌ Error parseando respuesta:', parseError);
        }
        throw new Error(errorMessage);
      }

      const data = await res.json();
      console.log('✅ Login exitoso:', { user: data.user?.username, rol: data.user?.rol });
      
      if (!data?.token || !data?.user) throw new Error('Respuesta inválida del servidor');

      // Guardar token y datos del usuario
      await storage.setItem('auth_token', data.token);
      await storage.setItem('user_data', JSON.stringify(data.user));
      console.log('💾 Token y datos guardados');

      // Navegar según el rol
      if (data.user.rol === 'superadmin') {
        router.replace('/roles/superadmin-movil');
      } else if (data.user.rol === 'admin') {
        Alert.alert('Éxito', 'Panel de admin próximamente');
      } else if (data.user.rol === 'docente') {
        Alert.alert('Éxito', 'Panel de docente próximamente');
      } else if (data.user.rol === 'estudiante') {
        Alert.alert('Éxito', 'Panel de estudiante próximamente');
      } else {
        Alert.alert('Éxito', `Bienvenido como ${data.user.rol}`);
      }
    } catch (err: any) {
      console.log('💥 Error en login:', err);
      Alert.alert('Error', err.message || 'No se pudo iniciar sesión');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="light" />
      <ImageBackground
        source={{ uri: 'https://res.cloudinary.com/dfczvdz7b/image/upload/v1759544229/aula_qzzpke.jpg' }}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={styles.overlay} />
        
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.badge}>
              <Ionicons name="eye-outline" size={16} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.badgeText}>Plataforma Virtual de Aprendizaje</Text>
            </View>
            
            <Text style={styles.title}>
              Aula <Text style={styles.titleGradient}>Virtual</Text>
            </Text>
            
            <Text style={styles.subtitle}>
              Accede a tu plataforma de aprendizaje personalizada.
              Continúa tu formación profesional desde cualquier lugar.
            </Text>
          </View>

          {/* Formulario */}
          <View style={styles.formContainer}>
            <View style={styles.formCard}>
              {/* Usuario */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Usuario</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="person-outline" size={20} color="rgba(255, 255, 255, 0.7)" style={styles.inputIconLeft} />
                  <TextInput
                    style={styles.input}
                    placeholder="tu usuario (o correo si eres admin)"
                    placeholderTextColor="rgba(255, 255, 255, 0.5)"
                    value={formData.identifier}
                    onChangeText={(text) => setFormData({ ...formData, identifier: text.toLowerCase() })}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              {/* Contraseña */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Contraseña</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={20} color="rgba(255, 255, 255, 0.7)" style={styles.inputIconLeft} />
                  <TextInput
                    style={styles.input}
                    placeholder="••••••••"
                    placeholderTextColor="rgba(255, 255, 255, 0.5)"
                    value={formData.password}
                    onChangeText={(text) => setFormData({ ...formData, password: text })}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Ionicons 
                      name={showPassword ? "eye-outline" : "eye-off-outline"} 
                      size={20} 
                      color="rgba(255, 255, 255, 0.7)" 
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Botón de login */}
              <TouchableOpacity
                style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
                onPress={handleSubmit}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <>
                    <Text style={styles.loginButtonText}>INGRESAR</Text>
                    <Ionicons name="arrow-forward" size={20} color="#000" style={{ marginLeft: 4 }} />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </ImageBackground>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.5)',
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  badgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  title: {
    fontSize: 42,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  titleGradient: {
    color: '#fbbf24',
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  formContainer: {
    flex: 1,
  },
  formCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputWrapper: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputIconLeft: {
    position: 'absolute',
    left: 16,
    zIndex: 1,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(251, 191, 36, 0.4)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingLeft: 48,
    paddingRight: 48,
    color: '#fff',
    fontSize: 15,
  },
  eyeButton: {
    position: 'absolute',
    right: 16,
    padding: 4,
  },
  loginButton: {
    backgroundColor: '#fbbf24',
    borderRadius: 50,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#fbbf24',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
