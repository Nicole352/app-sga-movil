import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    onPageChange: (page: number) => void;
    theme: any;
    itemLabel?: string; // ej: "estudiantes", "solicitudes", "cursos"
}

export default function Pagination({
    currentPage,
    totalPages,
    totalItems,
    onPageChange,
    theme,
    itemLabel = 'items'
}: PaginationProps) {
    // Siempre mostrar la paginación para que el usuario vea el conteo de items
    // Los botones se deshabilitarán automáticamente cuando sea necesario

    return (
        <View style={[styles.container, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
            <TouchableOpacity
                style={[styles.button, { opacity: currentPage === 1 ? 0.5 : 1, backgroundColor: theme.primary + '15' }]}
                onPress={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
            >
                <Ionicons name="chevron-back" size={20} color={theme.primary} />
            </TouchableOpacity>

            <View style={styles.info}>
                <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>
                    Página {currentPage} de {totalPages}
                </Text>
                <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 2 }}>
                    {totalItems} {itemLabel}
                </Text>
            </View>

            <TouchableOpacity
                style={[styles.button, { opacity: currentPage === totalPages ? 0.5 : 1, backgroundColor: theme.primary + '15' }]}
                onPress={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
            >
                <Ionicons name="chevron-forward" size={20} color={theme.primary} />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 15,
        marginHorizontal: 15,
        marginTop: 10,
        marginBottom: 15,
        borderRadius: 12,
        borderWidth: 1,
    },
    button: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    info: {
        alignItems: 'center',
    },
});
