import React, {useState, useRef} from 'react';
import {
  View, Text, SafeAreaView, TouchableOpacity,
  TextInput, ScrollView, Switch, Modal,
  PanResponder, Platform, UIManager,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental)
  UIManager.setLayoutAnimationEnabledExperimental(false);
import {useNavigation} from '@react-navigation/native';
import {CategoryIcon, CategoryIconKey} from '../components/CategoryIconPickerModal';

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

// --- Add Field Modal ---
function AddFieldModal({
  visible, onClose, onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (field: Field) => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<FieldType>('numerical');
  const [unit, setUnit] = useState('');
  const [refFrom, setRefFrom] = useState('');
  const [refTo, setRefTo] = useState('');
  const [allowNote, setAllowNote] = useState(false);

  const reset = () => {
    setName(''); setType('numerical'); setUnit('');
    setRefFrom(''); setRefTo(''); setAllowNote(false);
  };

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd({
      id: Date.now().toString(),
      name: name.trim(),
      type,
      unit: unit.trim() || undefined,
      referenceFrom: refFrom.trim() || undefined,
      referenceTo: refTo.trim() || undefined,
      allowNote,
    });
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => { reset(); onClose(); }}
        style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end'}}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View className="bg-white rounded-t-3xl px-5 pt-5 pb-8">
            {/* Header */}
            <Text className="text-gray-800 font-bold text-base mb-4">Add Fields</Text>

            {/* Field Name */}
            <Text className="text-gray-700 text-sm font-medium mb-1">Fields Name</Text>
            <Text className="text-gray-400 text-xs mb-2">Enter the name of this field</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={type === 'numerical' ? 'e.g. Hemoglobin' : 'e.g. Metformin'}
              placeholderTextColor="#9ca3af"
              className="border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-sm mb-4"
            />

            {/* Field Type */}
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
                  <Text style={{color: type === t ? '#8B5CF6' : '#6B7280'}} className="text-sm font-medium capitalize">
                    {t === 'numerical' ? 'Numerical' : 'Description'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Numerical-only fields */}
            {type === 'numerical' && (
              <>
                <Text className="text-gray-700 text-sm font-medium mb-1">Unit <Text className="text-gray-400 font-normal">(Optional)</Text></Text>
                <TextInput
                  value={unit}
                  onChangeText={setUnit}
                  placeholder="e.g mg/dL"
                  placeholderTextColor="#9ca3af"
                  className="border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-sm mb-4"
                />
                <Text className="text-gray-700 text-sm font-medium mb-2">Reference Range <Text className="text-gray-400 font-normal">(Optional)</Text></Text>
                <View className="flex-row gap-3 mb-4">
                  <TextInput
                    value={refFrom}
                    onChangeText={setRefFrom}
                    placeholder="From"
                    placeholderTextColor="#9ca3af"
                    keyboardType="numeric"
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-sm"
                  />
                  <View className="justify-center"><Text className="text-gray-400">to</Text></View>
                  <TextInput
                    value={refTo}
                    onChangeText={setRefTo}
                    placeholder="To"
                    placeholderTextColor="#9ca3af"
                    keyboardType="numeric"
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-sm"
                  />
                </View>
              </>
            )}

            {/* Allow Note */}
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

            {/* Add Button */}
            <TouchableOpacity
              onPress={handleAdd}
              className="bg-teal-500 rounded-2xl py-4 items-center">
              <Text className="text-white font-semibold text-base">Add Field</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// --- Draggable Field List ---
const ROW_HEIGHT = 72;

function FieldRow({field, dotColor = '#9ca3af', borderColor = '#E5E7EB', bgColor = '#ffffff'}: {
  field: Field; dotColor?: string; borderColor?: string; bgColor?: string;
}) {
  return (
    <View
      className="flex-row items-center rounded-2xl px-4 py-4 gap-3 border"
      style={{backgroundColor: bgColor, borderColor}}>
      <View className="gap-1">
        {[0, 1, 2].map(r => (
          <View key={r} className="flex-row gap-1">
            {[0, 1].map(c => (
              <View key={c} style={{width: 5, height: 5, borderRadius: 3, backgroundColor: dotColor}} />
            ))}
          </View>
        ))}
      </View>
      <View className="flex-1">
        <Text className="text-gray-800 text-sm font-semibold">{field.name}</Text>
        <Text className="text-gray-400 text-xs mt-0.5">
          {field.type === 'numerical' ? `Numerical${field.unit ? ` · ${field.unit}` : ''}` : 'Description'}
        </Text>
      </View>
      <Text className="text-gray-400 text-lg">›</Text>
    </View>
  );
}

function DraggableFieldList({fields, setFields}: {fields: Field[]; setFields: (f: Field[]) => void}) {
  const fieldsRef = useRef(fields);
  const setFieldsRef = useRef(setFields);
  fieldsRef.current = fields;
  setFieldsRef.current = setFields;

  const activeRef = useRef<number | null>(null);
  const ghostRef = useRef<number | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [ghostIndex, setGhostIndex] = useState<number | null>(null);

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
        setTimeout(() => { setActiveIndex(index); setGhostIndex(index); }, 0);
      },
      onPanResponderMove: (_, gs) => {
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

  return (
    <View style={{marginBottom: 16}}>
      {fields.map((field, index) => {
        const isActive = activeIndex === index;
        const pr = getPanResponder(index);

        // Render blank placeholder at ghost target position
        const showGhostBefore = ghostIndex === index
          && activeIndex !== null
          && ghostIndex < activeIndex!;
        const showGhostAfter = ghostIndex === index
          && activeIndex !== null
          && ghostIndex > activeIndex!;

        return (
          <View key={field.id}>
            {showGhostBefore && (
              <View style={{
                height: ROW_HEIGHT - 8, marginBottom: 8,
                borderRadius: 16, borderWidth: 2, borderStyle: 'dashed',
                borderColor: '#14B8A6', backgroundColor: '#F0FDFA',
              }} />
            )}
            <View
              style={{marginBottom: 8, opacity: isActive ? 0.3 : 1}}
              {...pr.panHandlers}>
              <FieldRow field={field} />
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
    </View>
  );
}
function StepCreate({
  data, setData, onContinue,
}: {
  data: any; setData: (d: any) => void; onContinue: () => void;
}) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-4">
      {/* Category Name */}
      <Text className="text-gray-800 font-bold text-sm mt-4 mb-1">Category Name</Text>
      <Text className="text-gray-400 text-xs mb-2">Enter a name for this checkup category.</Text>
      <TextInput
        value={data.name}
        onChangeText={v => setData({...data, name: v})}
        placeholder="e.g Metformin"
        placeholderTextColor="#9ca3af"
        className="border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-sm mb-5"
      />

      {/* Choose Icon */}
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

      {/* Choose Color */}
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

      {/* Continue */}
      <TouchableOpacity
        onPress={onContinue}
        className="bg-teal-500 rounded-2xl py-4 items-center mb-8">
        <Text className="text-white font-semibold text-base">Continue</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// --- Step 2: Add Fields ---
function StepFields({
  fields, setFields, onContinue,
}: {
  fields: Field[]; setFields: (f: Field[]) => void; onContinue: () => void;
}) {
  const [showModal, setShowModal] = useState(false);

  return (
    <View className="flex-1 px-4">
      <Text className="text-gray-800 font-bold text-sm mt-4 mb-1">Fields</Text>
      <Text className="text-gray-400 text-xs mb-4">These will be used to record your results{'\n'}e.g (RBC, WBC, Magnesium)</Text>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <DraggableFieldList fields={fields} setFields={setFields} />

        {/* Add Field Button */}
        <TouchableOpacity
          onPress={() => setShowModal(true)}
          className="flex-row items-center justify-center gap-2 border border-gray-200 rounded-2xl py-4 mb-4">
          <Text className="text-teal-500 text-lg font-bold">+</Text>
          <Text className="text-teal-500 text-sm font-semibold">Add Field</Text>
        </TouchableOpacity>

        <View className="h-24" />
      </ScrollView>

      {/* Continue */}
      <View className="py-4 border-t border-gray-100">
        <TouchableOpacity
          onPress={onContinue}
          className="bg-teal-500 rounded-2xl py-4 items-center">
          <Text className="text-white font-semibold text-base">Continue</Text>
        </TouchableOpacity>
      </View>

      <AddFieldModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onAdd={field => setFields([...fields, field])}
      />
    </View>
  );
}

// --- Step 3: Review ---
function StepReview({
  categoryData, fields, onContinue,
}: {
  categoryData: any; fields: Field[]; onContinue: () => void;
}) {
  return (
    <View className="flex-1 px-4">
      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        {/* Category Card */}
        <View className="bg-white border border-gray-200 rounded-2xl px-4 py-4 mt-4 mb-5 flex-row items-center gap-3">
          <View
            className="w-12 h-12 rounded-2xl items-center justify-center"
            style={{backgroundColor: categoryData.color + '22'}}>
            <CategoryIcon iconKey={categoryData.icon} size={26} color={categoryData.color} />
          </View>
          <View className="flex-1">
            <Text className="text-gray-800 font-bold text-sm">{categoryData.name || 'Unnamed Category'}</Text>
            <View className="flex-row items-center gap-2 mt-1">
              <Text className="text-gray-400 text-xs">Category Color:</Text>
              <View className="w-4 h-4 rounded-full" style={{backgroundColor: categoryData.color}} />
            </View>
          </View>
        </View>

        {/* Fields */}
        <Text className="text-gray-800 font-bold text-sm mb-1">Fields ({fields.length})</Text>
        <Text className="text-gray-400 text-xs mb-3">The following are the fields you plan to add under this category.</Text>
        <DraggableFieldList fields={fields} setFields={() => {}} />
        <View className="h-24" />
      </ScrollView>

      {/* Continue */}
      <View className="py-4 border-t border-gray-100">
        <TouchableOpacity
          onPress={onContinue}
          className="bg-teal-500 rounded-2xl py-4 items-center">
          <Text className="text-white font-semibold text-base">Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// --- Main Screen ---
export default function CreateCategoryScreen() {
  const navigation = useNavigation();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [categoryData, setCategoryData] = useState({
    name: '', icon: 'flask' as CategoryIconKey, color: '#14B8A6',
  });
  const [fields, setFields] = useState<Field[]>([]);

  const stepTitle = step === 1 ? 'Create Category' : step === 2 ? 'Add Fields' : 'Review Category';

  const handleBack = () => {
    if (step === 1) navigation.goBack();
    else setStep((step - 1) as 1 | 2 | 3);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center px-4 pt-10 pb-3 border-b border-gray-100">
        <TouchableOpacity onPress={handleBack} className="p-2 mr-2">
          <Text className="text-gray-600 text-xl">‹</Text>
        </TouchableOpacity>
        <Text className="flex-1 text-center text-gray-800 text-base font-semibold mr-8">
          {stepTitle}
        </Text>
      </View>

      {step === 1 && (
        <StepCreate
          data={categoryData}
          setData={setCategoryData}
          onContinue={() => setStep(2)}
        />
      )}
      {step === 2 && (
        <StepFields
          fields={fields}
          setFields={setFields}
          onContinue={() => setStep(3)}
        />
      )}
      {step === 3 && (
        <StepReview
          categoryData={categoryData}
          fields={fields}
          onContinue={() => navigation.goBack()}
        />
      )}
    </SafeAreaView>
  );
}
