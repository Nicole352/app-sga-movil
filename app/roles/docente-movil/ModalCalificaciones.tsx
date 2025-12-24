import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Estudiante {
  id: number;
  nombre: string;
  apellido: string;
  calificacion?: number;
  comentario?: string;
}

interface ModalCalificacionesProps {
  visible: boolean;
  onClose: () => void;
  onSave: (calificaciones: any[]) => void;
  tarea: any;
  estudiantes: Estudiante[];
}

export default function ModalCalificaciones({
  visible,
  onClose,
  onSave,
  tarea,
  estudiantes,
}: ModalCalificacionesProps) {
  const [calificaciones, setCalificaciones] = useState<Map<number, { nota: string; comentario: string }>>(new Map());
  const [expandedStudent, setExpandedStudent] = useState<number | null>(null);

  useEffect(() => {
    if (visible && estudiantes) {
      const newCalificaciones = new Map();
      estudiantes.forEach((est) => {
        newCalificaciones.set(est.id, {
          nota: est.calificacion?.toString() || '',
          comentario: est.comentario || '',
        });
      });
      setCalificaciones(newCalificaciones);
    }
  }, [visible, estudiantes]);

  const handleNotaChange = (estudianteId: number, text: string) => {
    // Reemplazar coma por punto para decimales
    let formattedText = text.replace(',', '.');

    // Validar si es un número válido y aplicar clamping (tope máximo)
    const notaNum = parseFloat(formattedText);

    if (!isNaN(notaNum)) {
      if (notaNum > tarea.puntaje) {
        Alert.alert('Aviso', `La nota máxima es ${tarea.puntaje}`);
        formattedText = tarea.puntaje.toString();
      } else if (notaNum < 0) {
        formattedText = '0';
      }
    }

    const newCalificaciones = new Map(calificaciones);
    const current = newCalificaciones.get(estudianteId) || { nota: '', comentario: '' };
    newCalificaciones.set(estudianteId, { ...current, nota: formattedText });
    setCalificaciones(newCalificaciones);
  };

  const handleComentarioChange = (estudianteId: number, comentario: string) => {
    const newCalificaciones = new Map(calificaciones);
    const current = newCalificaciones.get(estudianteId) || { nota: '', comentario: '' };
    newCalificaciones.set(estudianteId, { ...current, comentario });
    setCalificaciones(newCalificaciones);
  };

  const handleSave = () => {
    const calificacionesArray: any[] = [];
    let hasError = false;

    calificaciones.forEach((value, estudianteId) => {
      if (value.nota) {
        const notaStr = value.nota.replace(',', '.');
        const nota = parseFloat(notaStr);
        if (isNaN(nota) || nota < 0 || nota > tarea.puntaje) {
          hasError = true;
          Alert.alert(
            'Error',
            `La nota debe estar entre 0 y ${tarea.puntaje}`
          );
          return;
        }

        calificacionesArray.push({
          estudianteId,
          tareaId: tarea.id,
          calificacion: nota,
          comentario: value.comentario,
        });
      }
    });

    if (hasError) return;

    onSave(calificacionesArray);
    onClose();
  };

  const getNotaColor = (nota: string) => {
    if (!nota) return '#6b7280';
    const notaNum = parseFloat(nota.replace(',', '.'));
    const porcentaje = (notaNum / tarea.puntaje) * 100;

    if (porcentaje >= 90) return '#10b981';
    if (porcentaje >= 70) return '#3b82f6';
    if (porcentaje >= 50) return '#f59e0b';
    return '#ef4444';
  };

  const aplicarNotaATodos = () => {
    Alert.prompt(
      'Aplicar Nota a Todos',
      `Ingresa la nota (0-${tarea.puntaje}):`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aplicar',
          onPress: (nota?: string) => {
            if (nota) {
              const notaNum = parseFloat(nota.replace(',', '.'));
              if (!isNaN(notaNum) && notaNum >= 0 && notaNum <= tarea.puntaje) {
                const newCalificaciones = new Map(calificaciones);
                estudiantes.forEach((est) => {
                  const current = newCalificaciones.get(est.id) || { nota: '', comentario: '' };
                  newCalificaciones.set(est.id, { ...current, nota });
                });
                setCalificaciones(newCalificaciones);
              } else {
                Alert.alert('Error', `La nota debe estar entre 0 y ${tarea.puntaje}`);
              }
            }
          },
        },
      ],
      'plain-text'
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View style={styles.headerInfo}>
              <Text style={styles.modalTitle}>Calificar Tarea</Text>
              <Text style={styles.tareaTitle}>{tarea?.titulo}</Text>
              <Text style={styles.puntajeMax}>Puntaje máximo: {tarea?.puntaje}</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.actionBar}>
            <TouchableOpacity style={styles.actionButton} onPress={aplicarNotaATodos}>
              <Ionicons name="copy-outline" size={18} color="#3b82f6" />
              <Text style={styles.actionButtonText}>Aplicar a Todos</Text>
            </TouchableOpacity>
            <Text style={styles.estudiantesCount}>
              {estudiantes.length} estudiantes
            </Text>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {estudiantes.map((estudiante) => {
              const calif = calificaciones.get(estudiante.id) || { nota: '', comentario: '' };
              const isExpanded = expandedStudent === estudiante.id;

              return (
                <View key={estudiante.id} style={styles.estudianteCard}>
                  <TouchableOpacity
                    style={styles.estudianteHeader}
                    onPress={() => setExpandedStudent(isExpanded ? null : estudiante.id)}
                  >
                    <View style={styles.estudianteInfo}>
                      <View style={styles.avatarCircle}>
                        <Text style={styles.avatarText}>
                          {estudiante.nombre[0]}{estudiante.apellido[0]}
                        </Text>
                      </View>
                      <View style={styles.estudianteNombre}>
                        <Text style={styles.nombreText}>
                          {estudiante.nombre} {estudiante.apellido}
                        </Text>
                        {calif.nota && (
                          <Text style={[styles.notaPreview, { color: getNotaColor(calif.nota) }]}>
                            {calif.nota} / {tarea.puntaje}
                          </Text>
                        )}
                      </View>
                    </View>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color="#6b7280"
                    />
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.estudianteBody}>
                      <View style={styles.inputGroup}>
                        <Text style={styles.label}>Calificación</Text>
                        <View style={styles.notaInputContainer}>
                          <TextInput
                            style={[styles.notaInput, { borderColor: getNotaColor(calif.nota) }]}
                            value={calif.nota}
                            onChangeText={(text) => handleNotaChange(estudiante.id, text.replace(',', '.'))}
                            placeholder="0.00"
                            placeholderTextColor="#999"
                            keyboardType="decimal-pad"
                          />
                          <Text style={styles.notaMax}>/ {tarea.puntaje}</Text>
                        </View>
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={styles.label}>Comentario (opcional)</Text>
                        <TextInput
                          style={[styles.input, styles.textArea]}
                          value={calif.comentario}
                          onChangeText={(text) => handleComentarioChange(estudiante.id, text)}
                          placeholder="Agrega un comentario..."
                          placeholderTextColor="#999"
                          multiline
                          numberOfLines={3}
                          textAlignVertical="top"
                        />
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Guardar Calificaciones</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerInfo: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  tareaTitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  puntajeMax: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '600',
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#eff6ff',
  },
  actionButtonText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '600',
  },
  estudiantesCount: {
    fontSize: 14,
    color: '#6b7280',
  },
  modalBody: {
    padding: 20,
  },
  estudianteCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
    overflow: 'hidden',
  },
  estudianteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  estudianteInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  estudianteNombre: {
    flex: 1,
  },
  nombreText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  notaPreview: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  estudianteBody: {
    padding: 16,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  notaInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notaInput: {
    borderWidth: 2,
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    backgroundColor: '#fff',
    width: 80,
    textAlign: 'center',
  },
  notaMax: {
    fontSize: 16,
    color: '#6b7280',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1f2937',
    backgroundColor: '#fff',
  },
  textArea: {
    minHeight: 80,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  saveButton: {
    flex: 2,
    flexDirection: 'row',
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
