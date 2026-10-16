import React, {useState, useRef, useEffect} from 'react';
import {
  View, Text, SafeAreaView, TouchableOpacity,
  TextInput, ScrollView, Switch, Modal,
  PanResponder, Animated, Platform, UIManager, ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental)
  UIManager.setLayoutAnimationEnabledExperimental(false);

import {useNavigation, useRoute} from '@react-navigation/native';
import {CategoryIcon, CategoryIconKey} from '../components/CategoryIconPickerModal';
import {addCategory, updateCategory} from '../database/services';
import {database} from '../database';
import Category from '../database/models/Category';
import {Alert} from 'react-native';

// --- Types ---
type FieldType = 'numerical' | 'description';

interface Field {
  id: string;
  name: string;
  type: FieldType;
  unit?: string;
  referenceFrom?: string;
  referenceTo?: string;
  allowNote: boolean;
  aliases?: string[]; // alternative names for OCR matching
}

// --- Constants ---
const CATEGORY_COLORS = [
  '#14B8A6', '#3B82F6', '#8B5CF6', '#F97316',
  '#EF4444', '#EC4899', '#EAB308', '#6B7280',
];

const ICON_OPTIONS: CategoryIconKey[] = [
  'anatomical-heart', 'cell', 'lungs', 'heart',
  'bone', 'wellbeing', 'brain-circuit', 'ear',
  'flask', 'heart-beat-line',
];

// --- Add/Edit Field Modal ---
function AddFieldModal({visible, onClose, onAdd, editField}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (field: Field) => void;
  editField?: Field | null;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<FieldType>('numerical');
  const [unit, setUnit] = useState('');
  const [refFrom, setRefFrom] = useState('');
  const [refTo, setRefTo] = useState('');
  const [allowNote, setAllowNote] = useState(false);
  const [aliasInput, setAliasInput] = useState('');
  const [aliases, setAliases] = useState<string[]>([]);
  const [errors, setErrors] = useState<{name?: string; unit?: string; refRange?: string}>({});
  useEffect(() => {
    if (editField) {
      setName(editField.name);
      setType(editField.type);
      setUnit(editField.unit ?? '');
      setRefFrom(editField.referenceFrom ?? '');
      setRefTo(editField.referenceTo ?? '');
      setAllowNote(editField.allowNote);
      setAliases(editField.aliases ?? []);
      setAliasInput('');
    } else {
      reset();
    }
  }, [editField, visible]);

  const reset = () => {
  setName(''); setType('numerical'); setUnit('');
  setRefFrom(''); setRefTo(''); setAllowNote(false);
  setAliasInput(''); setAliases([]);
  setErrors({});
};

  const handleAddAlias = () => {
    const trimmed = aliasInput.trim();
    if (!trimmed || aliases.includes(trimmed)) return;
    setAliases(prev => [...prev, trimmed]);
    setAliasInput('');
  };

const handleAdd = () => {
    if (!name.trim()) {
      setErrors(e => ({...e, name: 'Field name is required.'}));
      return;
    }
    if (type === 'numerical') {
      const newErrors: {unit?: string; refRange?: string} = {};
      if (!unit.trim()) newErrors.unit = 'Unit is required.';
      if (!refFrom.trim() || !refTo.trim()) newErrors.refRange = 'Both From and To values are required.';
      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }
    }
    setErrors({});
    onAdd({
      id: editField ? editField.id : Date.now().toString(),
      name: name.trim(), type,
      unit: unit.trim() || undefined,
      referenceFrom: refFrom.trim() || undefined,
      referenceTo: refTo.trim() || undefined,
      allowNote,
      aliases: aliases.length > 0 ? aliases : undefined,
    });
    reset();
    onClose();
  };

  const dragY = useRef(new Animated.Value(0)).current;
  const overlayOpacity = dragY.interpolate({
    inputRange: [0, 300],
    outputRange: [0.5, 0],
    extrapolate: 'clamp',
  });
  const dragPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) dragY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 80) {
          Animated.timing(dragY, {toValue: 600, duration: 200, useNativeDriver: true}).start(() => {
            dragY.setValue(0);
            reset();
            onClose();
          });
        } else {
          Animated.spring(dragY, {toValue: 0, useNativeDriver: true}).start();
        }
      },
    })
  ).current;

  const isEditing = !!editField;

  return (
     <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{flex: 1, justifyContent: 'flex-end'}}>
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: '#000',
            opacity: overlayOpacity,
          }}
        />
        {/* Tap outside to close */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => { reset(); onClose(); }}
          style={{flex: 1}}
        />
        <Animated.View
          style={{
            transform: [{translateY: dragY}],
            backgroundColor: 'white',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            overflow: 'hidden',
          }}>
          {/* Drag handle */}
          <View
            {...dragPan.panHandlers}
            style={{alignItems: 'center', paddingTop: 12, paddingBottom: 4}}>
            <View style={{width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB'}} />
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{paddingHorizontal: 20, paddingBottom: 32}}>
            <Text className="text-gray-800 font-bold text-base mb-4">{isEditing ? 'Edit Field' : 'Add Field'}</Text>

            <Text className="text-gray-700 text-sm font-medium mb-1">Fields Name</Text>
            <Text className="text-gray-400 text-xs mb-2">Enter the name of this field</Text>
            <TextInput
              value={name}
              onChangeText={v => { setName(v); setErrors(e => ({...e, name: undefined})); }}
              placeholder={type === 'numerical' ? 'e.g. Hemoglobin' : 'e.g. Metformin'}
              placeholderTextColor="#9ca3af"
              className={`border rounded-xl px-4 py-3 text-gray-800 text-sm ${errors.name ? 'border-red-400 mb-1' : 'border-gray-200 mb-4'}`}
            />
            {errors.name && (
              <Text className="text-red-400 text-xs mb-4">{errors.name}</Text>
            )}

            <Text className="text-gray-700 text-sm font-medium mb-2">Fields Type</Text>
            <View className="flex-row gap-3 mb-4">
              {(['numerical', 'description'] as FieldType[]).map(t => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setType(t)}
                  className="flex-1 py-3 rounded-xl items-center border"
                  style={{
                    backgroundColor: type === t ? '#F3F0FF' : 'transparent',
                    borderColor: type === t ? '#8B5CF6' : '#E5E7EB',
                  }}>
                  <Text style={{color: type === t ? '#8B5CF6' : '#6B7280'}} className="text-sm font-medium">
                    {t === 'numerical' ? 'Numerical' : 'Description'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {type === 'numerical' && (
              <>
                <Text className="text-gray-700 text-sm font-medium mb-1">Unit</Text>
                <TextInput
                  value={unit}
                  onChangeText={v => { setUnit(v); setErrors(e => ({...e, unit: undefined})); }}
                  placeholder="e.g mg/dL"
                  placeholderTextColor="#9ca3af"
                  className={`border rounded-xl px-4 py-3 text-gray-800 text-sm ${errors.unit ? 'border-red-400 mb-1' : 'border-gray-200 mb-4'}`}
                />
                {errors.unit && (
                  <Text className="text-red-400 text-xs mb-4">{errors.unit}</Text>
                )}
                <Text className="text-gray-700 text-sm font-medium mb-2">Reference Range</Text>
                <View className={`flex-row gap-3 ${errors.refRange ? 'mb-1' : 'mb-4'}`}>
                  <TextInput
                    value={refFrom}
                    onChangeText={v => { setRefFrom(v); setErrors(e => ({...e, refRange: undefined})); }}
                    placeholder="From"
                    placeholderTextColor="#9ca3af"
                    keyboardType="numeric"
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-sm"
                  />
                  <View className="justify-center"><Text className="text-gray-400">to</Text></View>
                  <TextInput
                    value={refTo}
                    onChangeText={v => { setRefTo(v); setErrors(e => ({...e, refRange: undefined})); }}
                    placeholder="To"
                    placeholderTextColor="#9ca3af"
                    keyboardType="numeric"
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-sm"
                  />
                </View>
                {errors.refRange && (
                  <Text className="text-red-400 text-xs mb-4">{errors.refRange}</Text>
                )}
              </>
            )}

            <Text className="text-gray-700 text-sm font-medium mb-1">Alternative Names <Text className="text-gray-400 font-normal">(Optional)</Text></Text>
            <Text className="text-gray-400 text-xs mb-2">Add other names this field may appear as on lab reports (e.g. "Red Blood Cell" for RBC)</Text>
            <View className="flex-row gap-2 mb-2">
              <TextInput
                value={aliasInput}
                onChangeText={setAliasInput}
                onSubmitEditing={handleAddAlias}
                placeholder="e.g. Red Blood Cell"
                placeholderTextColor="#9ca3af"
                returnKeyType="done"
                className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-sm"
              />
              <TouchableOpacity
                onPress={handleAddAlias}
                className="bg-teal-500 rounded-xl px-4 items-center justify-center">
                <Text className="text-white text-sm font-semibold">Add</Text>
              </TouchableOpacity>
            </View>
            {aliases.length > 0 && (
              <View className="flex-row flex-wrap gap-2 mb-4">
                {aliases.map(alias => (
                  <TouchableOpacity
                    key={alias}
                    onPress={() => setAliases(prev => prev.filter(a => a !== alias))}
                    className="flex-row items-center gap-1 bg-teal-50 border border-teal-200 rounded-full px-3 py-1">
                    <Text className="text-teal-700 text-xs">{alias}</Text>
                    <Text className="text-teal-400 text-xs">✕</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View className="flex-row items-center justify-between mb-5">
              <View className="flex-1">
                <Text className="text-gray-700 text-sm font-medium">Allow additional note <Text className="text-gray-400 font-normal">(Optional)</Text></Text>
                <Text className="text-gray-400 text-xs mt-0.5">Users can add comments or notes for this result.</Text>
              </View>
              <Switch
                value={allowNote}
                onValueChange={setAllowNote}
                trackColor={{false: '#E5E7EB', true: '#14B8A6'}}
                thumbColor="#ffffff"
              />
            </View>

            <TouchableOpacity onPress={handleAdd} className="bg-teal-500 rounded-2xl py-4 items-center">
              <Text className="text-white font-semibold text-base">{isEditing ? 'Save Field' : 'Add Field'}</Text>
            </TouchableOpacity>
            </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// --- Draggable Field List ---
const ROW_HEIGHT = 72;

function FieldRow({field, dotColor = '#9ca3af', borderColor = '#E5E7EB', bgColor = '#ffffff', onEdit, onDelete, panHandlers}: {
  field: Field; dotColor?: string; borderColor?: string; bgColor?: string;
  onEdit?: (field: Field) => void;
  onDelete?: (field: Field) => void;
  panHandlers?: any;
}) {
  return (
    <View
      className="flex-row items-center rounded-2xl px-2 py-4 gap-x-3 border"
      style={{backgroundColor: bgColor, borderColor}}>
      {/* drag handle only — pan responder attached here */}
      <View {...panHandlers} className="p-2">
        <View className="gap-1">
          {[0, 1, 2].map(r => (
            <View key={r} className="flex-row gap-1">
              {[0, 1].map(c => (
                <View key={c} style={{width: 5, height: 5, borderRadius: 3, backgroundColor: dotColor}} />
              ))}
            </View>
          ))}
        </View>
      </View>
      {/* tappable content area */}
      <TouchableOpacity className="flex-1 flex-row items-center" onPress={() => onEdit?.(field)} activeOpacity={onEdit ? 0.7 : 1}>
        <View className="flex-1">
          <Text className="text-gray-800 text-sm font-semibold">{field.name}</Text>
          <Text className="text-gray-400 text-xs mt-0.5">
            {field.type === 'numerical' ? `Numerical${field.unit ? ` · ${field.unit}` : ''}` : 'Description'}
            {field.aliases && field.aliases.length > 0 ? ` · ${field.aliases.length} alias${field.aliases.length > 1 ? 'es' : ''}` : ''}
          </Text>
        </View>
        <Text className="text-gray-400 text-lg">{onEdit ? '✎' : '›'}</Text>
      </TouchableOpacity>
      {onDelete && (
        <TouchableOpacity
          onPress={() => onDelete(field)}
          className="pl-2 pr-1">
          <Text className="text-red-400 text-lg">✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function DraggableFieldList({fields, setFields, onEdit, onDelete}: {
  fields: Field[];
  setFields: (f: Field[]) => void;
  onEdit?: (field: Field) => void;
  onDelete?: (field: Field) => void;
}) {
  const fieldsRef = useRef(fields);
  const setFieldsRef = useRef(setFields);
  fieldsRef.current = fields;
  setFieldsRef.current = setFields;

  const activeRef = useRef<number | null>(null);
  const ghostRef = useRef<number | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [ghostIndex, setGhostIndex] = useState<number | null>(null);
  const dragY = useRef(new Animated.Value(0)).current;
  const dragX = useRef(new Animated.Value(0)).current;
  const cardTopRef = useRef(0);

  const panResponders = useRef<{[key: number]: ReturnType<typeof PanResponder.create>}>({});
  const prevLengthRef = useRef(fields.length);
  if (prevLengthRef.current !== fields.length) {
    panResponders.current = {};
    prevLengthRef.current = fields.length;
  }

  const getPanResponder = (index: number) => {
    if (panResponders.current[index]) return panResponders.current[index];
    panResponders.current[index] = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        activeRef.current = index;
        ghostRef.current = index;
        cardTopRef.current = index * ROW_HEIGHT;
        dragY.setValue(0);
        dragX.setValue(0);
        setTimeout(() => { setActiveIndex(index); setGhostIndex(index); }, 0);
      },
      onPanResponderMove: (_, gs) => {
        dragY.setValue(gs.dy);
        dragX.setValue(gs.dx);
        const next = Math.max(0, Math.min(
          fieldsRef.current.length - 1,
          index + Math.round(gs.dy / ROW_HEIGHT),
        ));
        if (next !== ghostRef.current) {
          ghostRef.current = next;
          setGhostIndex(next);
        }
      },
      onPanResponderRelease: () => {
        const from = activeRef.current!;
        const to = ghostRef.current!;
        dragY.setValue(0);
        dragX.setValue(0);
        activeRef.current = null;
        ghostRef.current = null;
        setActiveIndex(null);
        setGhostIndex(null);
        if (from !== to) {
          const reordered = [...fieldsRef.current];
          const [moved] = reordered.splice(from, 1);
          reordered.splice(to, 0, moved);
          setFieldsRef.current(reordered);
        }
      },
    });
    return panResponders.current[index];
  };

  const activeField = activeIndex !== null ? fields[activeIndex] : null;

  return (
    <View style={{marginBottom: 16}}>
      {fields.map((field, index) => {
        const isActive = activeIndex === index;
        const pr = getPanResponder(index);
        const showGhostBefore = ghostIndex === index && activeIndex !== null && ghostIndex < activeIndex!;
        const showGhostAfter = ghostIndex === index && activeIndex !== null && ghostIndex > activeIndex!;

        return (
            <View key={field.id} style={{marginBottom: 8}}>
            {showGhostBefore && (
              <View style={{
                height: ROW_HEIGHT - 8, marginBottom: 8,
                borderRadius: 16, borderWidth: 2, borderStyle: 'dashed',
                borderColor: '#14B8A6', backgroundColor: '#F0FDFA',
              }} />
            )}
            <View style={{opacity: isActive ? 0 : 1, height: isActive ? 0 : undefined}}>
              <FieldRow
                field={field}
                onEdit={onEdit}
                onDelete={onDelete}
                panHandlers={pr.panHandlers}
              />
            </View>
            {showGhostAfter && (
              <View style={{
                height: ROW_HEIGHT - 8, marginBottom: 8,
                borderRadius: 16, borderWidth: 2, borderStyle: 'dashed',
                borderColor: '#14B8A6', backgroundColor: '#F0FDFA',
              }} />
            )}
          </View>
        );
      })}

      {/* Floating copy that follows the finger */}
      {activeField && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: cardTopRef.current,
            transform: [{translateY: dragY}, {translateX: dragX}],
            zIndex: 999,
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: {width: 0, height: 6},
            shadowOpacity: 0.2,
            shadowRadius: 8,
          }}>
          <FieldRow field={activeField} dotColor="#14B8A6" borderColor="#14B8A6" bgColor="#F0FDFA" />
        </Animated.View>
      )}
    </View>
  );
}

// --- Presets ---

interface Preset {
  id: string;
  label: string;
  description: string;
  icon: CategoryIconKey;
  color: string;
  fields: Field[];
}

const PRESETS: Preset[] = [
  {
    id: 'magic10',
    label: 'Magic 10',
    description: '10 core blood chemistry tests for a standard annual checkup',
    icon: 'flask',
    color: '#14B8A6',
    fields: [
      {id: 'p1',  name: 'FBS',           type: 'numerical', unit: 'mg/dL',    referenceFrom: '70',  referenceTo: '100',  allowNote: false},
      {id: 'p2',  name: 'HbA1C',         type: 'numerical', unit: '%',         referenceFrom: '4.0', referenceTo: '5.6',  allowNote: false},
      {id: 'p3',  name: 'Total Cholesterol', type: 'numerical', unit: 'mg/dL', referenceFrom: '0',   referenceTo: '200',  allowNote: false},
      {id: 'p4',  name: 'HDL',           type: 'numerical', unit: 'mg/dL',    referenceFrom: '40',  referenceTo: '999',  allowNote: false},
      {id: 'p5',  name: 'LDL',           type: 'numerical', unit: 'mg/dL',    referenceFrom: '0',   referenceTo: '100',  allowNote: false},
      {id: 'p6',  name: 'Triglycerides', type: 'numerical', unit: 'mg/dL',    referenceFrom: '0',   referenceTo: '150',  allowNote: false},
      {id: 'p7',  name: 'Creatinine',    type: 'numerical', unit: 'mg/dL',    referenceFrom: '0.6', referenceTo: '1.2',  allowNote: false},
      {id: 'p8',  name: 'BUN',           type: 'numerical', unit: 'mg/dL',    referenceFrom: '7',   referenceTo: '20',   allowNote: false},
      {id: 'p9',  name: 'SGPT (ALT)',    type: 'numerical', unit: 'U/L',      referenceFrom: '7',   referenceTo: '56',   allowNote: false},
      {id: 'p10', name: 'SGOT (AST)',    type: 'numerical', unit: 'U/L',      referenceFrom: '10',  referenceTo: '40',   allowNote: false},
    ],
  },
  {
    id: 'magic12',
    label: 'Magic 12',
    description: '12-panel test including CBC markers for a comprehensive checkup',
    icon: 'cell',
    color: '#3B82F6',
    fields: [
      {id: 'q1',  name: 'FBS',           type: 'numerical', unit: 'mg/dL',      referenceFrom: '70',  referenceTo: '100',  allowNote: false},
      {id: 'q2',  name: 'HbA1C',         type: 'numerical', unit: '%',           referenceFrom: '4.0', referenceTo: '5.6',  allowNote: false},
      {id: 'q3',  name: 'Total Cholesterol', type: 'numerical', unit: 'mg/dL',  referenceFrom: '0',   referenceTo: '200',  allowNote: false},
      {id: 'q4',  name: 'HDL',           type: 'numerical', unit: 'mg/dL',      referenceFrom: '40',  referenceTo: '999',  allowNote: false},
      {id: 'q5',  name: 'LDL',           type: 'numerical', unit: 'mg/dL',      referenceFrom: '0',   referenceTo: '100',  allowNote: false},
      {id: 'q6',  name: 'Triglycerides', type: 'numerical', unit: 'mg/dL',      referenceFrom: '0',   referenceTo: '150',  allowNote: false},
      {id: 'q7',  name: 'Creatinine',    type: 'numerical', unit: 'mg/dL',      referenceFrom: '0.6', referenceTo: '1.2',  allowNote: false},
      {id: 'q8',  name: 'BUN',           type: 'numerical', unit: 'mg/dL',      referenceFrom: '7',   referenceTo: '20',   allowNote: false},
      {id: 'q9',  name: 'SGPT (ALT)',    type: 'numerical', unit: 'U/L',        referenceFrom: '7',   referenceTo: '56',   allowNote: false},
      {id: 'q10', name: 'SGOT (AST)',    type: 'numerical', unit: 'U/L',        referenceFrom: '10',  referenceTo: '40',   allowNote: false},
      {id: 'q11', name: 'WBC',           type: 'numerical', unit: 'x10³/µL',    referenceFrom: '4.5', referenceTo: '11.0', allowNote: false},
      {id: 'q12', name: 'RBC',           type: 'numerical', unit: 'x10⁶/µL',    referenceFrom: '4.5', referenceTo: '5.5',  allowNote: false},
    ],
  },
];

// --- Step 0: Preset Picker ---
function StepPreset({onSelect, onSkip}: {
  onSelect: (preset: Preset) => void;
  onSkip: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-4">
      {/* Header text */}
      <View className="items-center mt-6 mb-6">
        <Text className="text-gray-800 font-bold text-lg text-center">
          Start with a template
        </Text>
        <Text className="text-gray-400 text-sm mt-1 text-center">
          Pick a preset to auto-fill the fields, or start from scratch.
        </Text>
      </View>

      {/* Preset cards */}
      {PRESETS.map(preset => {
        const isSelected = selected === preset.id;
        return (
          <TouchableOpacity
            key={preset.id}
            onPress={() => setSelected(isSelected ? null : preset.id)}
            activeOpacity={0.8}
            className="rounded-2xl border-2 p-4 mb-3"
            style={{
              borderColor: isSelected ? preset.color : '#E5E7EB',
              backgroundColor: isSelected ? preset.color + '11' : '#ffffff',
            }}>
            <View className="flex-row items-center gap-3 mb-3">
              {/* Icon bubble */}
              <View
                className="w-12 h-12 rounded-xl items-center justify-center"
                style={{backgroundColor: preset.color + '22'}}>
                <CategoryIcon iconKey={preset.icon} size={24} color={preset.color} />
              </View>
              <View className="flex-1">
                <Text className="text-gray-800 font-bold text-sm">{preset.label}</Text>
                <Text className="text-gray-400 text-xs mt-0.5">{preset.description}</Text>
              </View>
              {/* Selection indicator */}
              <View
                className="w-6 h-6 rounded-full border-2 items-center justify-center"
                style={{borderColor: isSelected ? preset.color : '#D1D5DB'}}>
                {isSelected && (
                  <View
                    className="w-3 h-3 rounded-full"
                    style={{backgroundColor: preset.color}}
                  />
                )}
              </View>
            </View>

            {/* Field preview pills */}
            <View className="flex-row flex-wrap gap-1.5">
              {preset.fields.map(f => (
                <View
                  key={f.id}
                  className="rounded-full px-2.5 py-1"
                  style={{backgroundColor: preset.color + '18'}}>
                  <Text className="text-xs font-medium" style={{color: preset.color}}>
                    {f.name}
                  </Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        );
      })}

      {/* Use preset button */}
      <TouchableOpacity
        onPress={() => {
          const preset = PRESETS.find(p => p.id === selected);
          if (preset) onSelect(preset);
        }}
        disabled={!selected}
        className="rounded-2xl py-4 items-center mb-3 mt-1"
        style={{
          backgroundColor: selected ? '#14B8A6' : '#E5E7EB',
        }}>
        <Text
          className="font-semibold text-base"
          style={{color: selected ? '#ffffff' : '#9ca3af'}}>
          Use This Template
        </Text>
      </TouchableOpacity>

      {/* Skip / start from scratch */}
      <TouchableOpacity
        onPress={onSkip}
        className="py-4 items-center mb-8">
        <Text className="text-gray-400 text-sm font-medium">
          Start from scratch instead
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// --- Step 1: Create Category ---
function StepCreate({data, setData, onContinue}: {
  data: any; setData: (d: any) => void; onContinue: () => void;
}) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-4">
      <Text className="text-gray-800 font-bold text-sm mt-4 mb-1">Category Name</Text>
      <Text className="text-gray-400 text-xs mb-2">Enter a name for this checkup category.</Text>
      <TextInput
        value={data.name}
        onChangeText={v => setData({...data, name: v})}
        placeholder="e.g Metformin"
        placeholderTextColor="#9ca3af"
        className="border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-sm mb-5"
      />

      <Text className="text-gray-800 font-bold text-sm mb-1">Choose Icon</Text>
      <Text className="text-gray-400 text-xs mb-3">Select an icon that represents this category.</Text>
      <View className="flex-row flex-wrap gap-3 mb-5">
        {ICON_OPTIONS.map(key => {
          const isSelected = data.icon === key;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => setData({...data, icon: key})}
              className="w-14 h-14 rounded-2xl items-center justify-center border-2"
              style={{
                backgroundColor: isSelected ? '#F0FDFA' : '#F9FAFB',
                borderColor: isSelected ? '#14B8A6' : '#E5E7EB',
              }}>
              <CategoryIcon iconKey={key} size={26} color={isSelected ? data.color : '#6B7280'} />
            </TouchableOpacity>
          );
        })}
      </View>

      <Text className="text-gray-800 font-bold text-sm mb-1">Choose Color</Text>
      <Text className="text-gray-400 text-xs mb-3">Select a color for this category</Text>
      <View className="flex-row gap-3 mb-8 flex-wrap">
        {CATEGORY_COLORS.map(color => (
          <TouchableOpacity
            key={color}
            onPress={() => setData({...data, color})}
            className="w-9 h-9 rounded-full items-center justify-center"
            style={{backgroundColor: color}}>
            {data.color === color && <Text className="text-white text-sm font-bold">✓</Text>}
          </TouchableOpacity>
        ))}
        <TouchableOpacity className="w-9 h-9 rounded-full border-2 border-dashed border-gray-300 items-center justify-center">
          <Text className="text-gray-400 text-lg">+</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={onContinue} className="bg-teal-500 rounded-2xl py-4 items-center mb-8">
        <Text className="text-white font-semibold text-base">Continue</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// --- Step 2: Add Fields ---
function StepFields({fields, setFields, onContinue}: {
  fields: Field[]; setFields: (f: Field[]) => void; onContinue: () => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [editingField, setEditingField] = useState<Field | null>(null);

  const handleEdit = (field: Field) => {
    setEditingField(field);
    setShowModal(true);
  };

  const handleDelete = (field: Field) => {
    setFields(fields.filter(f => f.id !== field.id));
  };
  const handleSave = (updated: Field) => {
    if (editingField) {
      setFields(fields.map(f => f.id === updated.id ? updated : f));
    } else {
      setFields([...fields, updated]);
    }
  };

  return (
    <View className="flex-1">
      <View className="px-4">
        <Text className="text-gray-800 font-bold text-sm mt-4 mb-1">Fields</Text>
        <Text className="text-gray-400 text-xs mb-4">These will be used to record your results{'\n'}e.g (RBC, WBC, Magnesium)</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <View className="px-5">
          <DraggableFieldList fields={fields} setFields={setFields} onEdit={handleEdit} onDelete={handleDelete} />

          <TouchableOpacity
            onPress={() => { setEditingField(null); setShowModal(true); }}
            className="flex-row items-center justify-center gap-x-2 border border-gray-200 rounded-2xl py-4 mb-4">
            <Text className="text-teal-500 text-lg font-bold">+</Text>
            <Text className="text-teal-500 text-sm font-semibold">Add Field</Text>
          </TouchableOpacity>

          <View className="h-24" />
        </View>
      </ScrollView>

      <View className="px-4 py-4 border-t border-gray-100">
        <TouchableOpacity onPress={onContinue} className="bg-teal-500 rounded-2xl py-4 items-center">
          <Text className="text-white font-semibold text-base">Continue</Text>
        </TouchableOpacity>
      </View>

      <AddFieldModal
        visible={showModal}
        editField={editingField}
        onClose={() => { setShowModal(false); setEditingField(null); }}
        onAdd={handleSave}
      />
    </View>
  );
}

// --- Step 3: Review ---
function StepReview({categoryData, fields, onContinue}: {
  categoryData: any; fields: Field[]; onContinue: () => void;
}) {
  return (
    <View className="flex-1">
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <View className="px-5">
          <View className="bg-white border border-gray-200 rounded-2xl px-4 py-4 mt-4 mb-5 flex-row items-center gap-x-3">
            <View
              className="w-12 h-12 rounded-2xl items-center justify-center"
              style={{backgroundColor: categoryData.color + '22'}}>
              <CategoryIcon iconKey={categoryData.icon} size={26} color={categoryData.color} />
            </View>
            <View className="flex-1">
              <Text className="text-gray-800 font-bold text-sm">{categoryData.name || 'Unnamed Category'}</Text>
              <View className="flex-row items-center gap-x-2 mt-1">
                <Text className="text-gray-400 text-xs">Category Color:</Text>
                <View className="w-4 h-4 rounded-full" style={{backgroundColor: categoryData.color}} />
              </View>
            </View>
          </View>

          <Text className="text-gray-800 font-bold text-sm mb-1">Fields ({fields.length})</Text>
          <Text className="text-gray-400 text-xs mb-3">The following are the fields you plan to add under this category.</Text>
          <DraggableFieldList fields={fields} setFields={() => {}} />
          <View className="h-24" />
        </View>
      </ScrollView>

      <View className="px-4 py-4 border-t border-gray-100">
        <TouchableOpacity onPress={onContinue} className="bg-teal-500 rounded-2xl py-4 items-center">
          <Text className="text-white font-semibold text-base">Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// --- Main Screen ---
export default function CreateCategoryScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const editCategoryId = route.params?.categoryId as string | undefined;
  const isEditing = !!editCategoryId;

  const [step, setStep] = useState<0 | 1 | 2 | 3>(isEditing ? 1 : 0);
  const [loading, setLoading] = useState(isEditing);
  const [existingCategory, setExistingCategory] = useState<Category | null>(null);
  const [categoryData, setCategoryData] = useState({
    name: '', icon: 'flask' as CategoryIconKey, color: '#14B8A6',
  });
  const [fields, setFields] = useState<Field[]>([]);

  useEffect(() => {
    if (!editCategoryId) return;
    database.get<Category>('categories').find(editCategoryId).then(cat => {
      setExistingCategory(cat);
      setCategoryData({name: cat.label, icon: cat.icon as CategoryIconKey, color: cat.color});
      const parsed = cat.parsedFields.map((f: any, i: number) => ({
        id: String(i),
        name: f.name,
        type: (f.type === 'descriptive' ? 'description' : 'numerical') as FieldType,
        unit: f.unit || undefined,
        referenceFrom: f.normalRange ? f.normalRange.split('-')[0] : undefined,
        referenceTo: f.normalRange ? f.normalRange.split('-')[1] : undefined,
        allowNote: f.allowNote ?? false,
        aliases: f.aliases ?? [],
      }));
      setFields(parsed);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [editCategoryId]);

  const stepTitle = step === 0
    ? 'New Category'
    : step === 1
    ? (isEditing ? 'Edit Category' : 'Create Category')
    : step === 2 ? 'Edit Fields'
    : 'Review Category';

  const handleBack = () => {
    if (step === 0) navigation.goBack();
    else if (step === 1 && !isEditing) setStep(0); // back to preset picker
    else if (step === 1) navigation.goBack();
    else setStep((step - 1) as 0 | 1 | 2 | 3);
  };

  const handleFinish = async () => {
    if (!categoryData.name.trim()) {
      Alert.alert('Required', 'Please enter a category name.');
      setStep(1);
      return;
    }
    try {
      const categoryFields = fields.map(f => ({
        name: f.name,
        unit: f.unit ?? '',
        normalRange: f.referenceFrom && f.referenceTo
          ? `${f.referenceFrom}-${f.referenceTo}`
          : '',
        required: false,
        type: f.type === 'description' ? 'descriptive' : 'numerical',
        aliases: f.aliases ?? [],
      }));
      if (isEditing && existingCategory) {
        await updateCategory(existingCategory, {
          label: categoryData.name.trim(),
          icon: categoryData.icon,
          color: categoryData.color,
          fields: JSON.stringify(categoryFields),
        });
      } else {
        await addCategory({
          label: categoryData.name.trim(),
          icon: categoryData.icon,
          color: categoryData.color,
          fields: JSON.stringify(categoryFields),
        });
      }
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Failed to save category. Please try again.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator color="#14B8A6" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center px-4 pt-10 pb-3 border-b border-gray-100">
        <TouchableOpacity onPress={handleBack} className="p-2 mr-2">
          <Text className="text-gray-600 text-xl">‹</Text>
        </TouchableOpacity>
        <Text className="flex-1 text-center text-gray-800 text-base font-semibold mr-8">
          {stepTitle}
        </Text>
      </View>

      {step === 0 && (
        <StepPreset
          onSelect={preset => {
            // Pre-fill from preset then jump to step 1 for review/tweaking
            setCategoryData({
              name: preset.label,
              icon: preset.icon as CategoryIconKey,
              color: preset.color,
            });
            setFields(preset.fields);
            setStep(1);
          }}
          onSkip={() => {
            setCategoryData({name: '', icon: 'flask' as CategoryIconKey, color: '#14B8A6'});
            setFields([]);
            setStep(1);
          }}
        />
      )}
      {step === 1 && <StepCreate data={categoryData} setData={setCategoryData} onContinue={() => setStep(2)} />}
      {step === 2 && <StepFields fields={fields} setFields={setFields} onContinue={() => setStep(3)} />}
      {step === 3 && <StepReview categoryData={categoryData} fields={fields} onContinue={handleFinish} />}
    </SafeAreaView>
  );
}
