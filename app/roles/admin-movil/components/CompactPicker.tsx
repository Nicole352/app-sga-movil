import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Platform, ScrollView } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';

interface PickerItem {
    label: string;
    value: string;
}

interface CompactPickerProps {
    items: PickerItem[];
    selectedValue: string;
    onValueChange: (val: string) => void;
    placeholder?: string;
    theme: any;
}

export default function CompactPicker({
    items,
    selectedValue,
    onValueChange,
    placeholder,
    theme
}: CompactPickerProps) {
    const [showModal, setShowModal] = useState(false);

    const selectedLabel = items.find(i => i.value === selectedValue)?.label || placeholder || items[0]?.label;

    // UI Trigger (Shared for both platforms)
    const trigger = (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setShowModal(true)}
            style={[styles.pickerTrigger, {
                backgroundColor: theme.cardBg,
                borderColor: theme.border
            }]}
        >
            <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={{ color: theme.textMuted, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', marginBottom: 2 }}>
                    {placeholder || 'Seleccionar'}
                </Text>
                <Text style={{ color: theme.text, fontSize: 13, fontWeight: '500' }} numberOfLines={1}>
                    {selectedLabel}
                </Text>
            </View>
            <View style={[styles.pickerIcon, { backgroundColor: theme.accent + '15' }]}>
                <Ionicons name="chevron-down" size={16} color={theme.accent} />
            </View>
        </TouchableOpacity>
    );

    if (Platform.OS === 'android') {
        return (
            <>
                {trigger}
                <Modal
                    animationType="slide"
                    transparent={true}
                    visible={showModal}
                    onRequestClose={() => setShowModal(false)}
                >
                    <TouchableOpacity
                        activeOpacity={1}
                        onPress={() => setShowModal(false)}
                        style={styles.modalOverlay}
                    >
                        <Animated.View
                            entering={FadeInDown.duration(300)}
                            style={[styles.modalContent, { backgroundColor: theme.cardBg }]}
                        >
                            <View style={[styles.modalIndicator, { backgroundColor: theme.border }]} />

                            <View style={styles.modalHeader}>
                                <View>
                                    <Text style={[styles.modalTitle, { color: theme.text }]}>Seleccionar Opción</Text>
                                    <Text style={{ color: theme.textMuted, fontSize: 12 }}>Elige una de las opciones de la lista</Text>
                                </View>
                                <TouchableOpacity onPress={() => setShowModal(false)} style={styles.modalCloseBtn}>
                                    <Ionicons name="close" size={24} color={theme.text} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
                                {items.map((item, index) => {
                                    const isSelected = item.value === selectedValue;
                                    return (
                                        <TouchableOpacity
                                            key={item.value}
                                            onPress={() => {
                                                onValueChange(item.value);
                                                setShowModal(false);
                                            }}
                                            style={[
                                                styles.optionItem,
                                                { borderBottomColor: theme.border + '50' },
                                                isSelected && { backgroundColor: theme.accent + '15', borderColor: theme.accent }
                                            ]}
                                        >
                                            <View style={styles.optionInfo}>
                                                <Text style={[
                                                    styles.optionText,
                                                    { color: isSelected ? theme.accent : theme.text },
                                                    isSelected && { fontWeight: '700' }
                                                ]}>
                                                    {item.label}
                                                </Text>
                                            </View>
                                            {isSelected && (
                                                <Ionicons name="checkmark-circle" size={22} color={theme.accent} />
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </Animated.View>
                    </TouchableOpacity>
                </Modal>
            </>
        );
    }

    // IOS: BACK TO NATIVE WHEEL
    return (
        <>
            {trigger}
            <Modal animationType="slide" transparent={true} visible={showModal} onRequestClose={() => setShowModal(false)}>
                <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <View style={{ backgroundColor: theme.cardBg, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 30 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                            <TouchableOpacity onPress={() => setShowModal(false)}>
                                <Text style={{ color: theme.textMuted, fontSize: 16 }}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setShowModal(false)}>
                                <Text style={{ color: theme.accent, fontWeight: '700', fontSize: 16 }}>Listo</Text>
                            </TouchableOpacity>
                        </View>
                        <Picker
                            selectedValue={selectedValue}
                            onValueChange={(itemValue) => onValueChange(itemValue as string)}
                            style={{ height: 200 }}
                            itemStyle={{ color: theme.text, fontSize: 18 }}
                        >
                            {items.map((item) => (
                                <Picker.Item key={item.value} label={item.label} value={item.value} />
                            ))}
                        </Picker>
                    </View>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    pickerTrigger: {
        borderRadius: 12,
        borderWidth: 1.5,
        height: 54,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        marginBottom: 8,
    },
    pickerIcon: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        paddingHorizontal: 20,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
        maxHeight: '80%',
    },
    modalIndicator: {
        width: 36,
        height: 4,
        borderRadius: 2,
        alignSelf: 'center',
        marginTop: 10,
        marginBottom: 20,
        opacity: 0.3,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '800',
    },
    modalCloseBtn: {
        padding: 4,
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderRadius: 12,
        marginBottom: 4,
    },
    optionInfo: {
        flex: 1,
    },
    optionText: {
        fontSize: 15,
        fontWeight: '500',
    },
});
