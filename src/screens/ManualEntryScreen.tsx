import React, {useState} from 'react';
import {
  View, Text, SafeAreaView, TouchableOpacity,
  TextInput, ScrollView, Platform,
} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import DateTimePicker from '@react-native-community/datetimepicker';
import {ReportsStackParamList} from '../navigation/ReportsStackNavigator';

type Nav = NativeStackNavigationProp<ReportsStackParamList>;
type Route = RouteProp<ReportsStackParamList, 'ManualEntry'>;

// Mirrors the category fields from CheckupScreen placeholder data
const CATEGORY_FIELDS: Record<string, {name: string; unit?: string; required?: boolean}[]> = {
  clinical: [
    {name: 'HbA1C',            unit: '%',      required: true},
    {name: 'Magnesium',        unit: 'mg/dL'},
    {name: 'FBS',              unit: 'mg/dL',  required: true},
    {name: 'Total Cholesterol',unit: 'mg/dL'},
    {name: 'HDL',              unit: 'mg/dL'},
    {name: 'LDL',              unit: 'mg/dL'},
    {name: 'VLDL',             unit: 'mg/dL'},
    {name: 'Triglycerides',    unit: 'mg/dL'},
    {name: 'BUN',              unit: 'mg/dL'},
    {name: 'BUA',              unit: 'mg/dL'},
    {name: 'Creatinine',       unit: 'mg/dL'},
    {name: 'SGPT (ALT)',       unit: 'U/L'},
    {name: 'SGOT (AST)',       unit: 'U/L'},
    {name: 'Sodium',           unit: 'mEq/L'},
    {name: 'Potassium',        unit: 'mEq/L'},
    {name: 'Ionized Calcium',  unit: 'mEq/L'},
  ],
  cbc: [
    {name: 'WBC',  unit: 'x10³/µL', required: true},
    {name: 'RBC',  unit: 'x10⁶/µL', required: true},
    {name: 'HGB',  unit: 'g/dL'},
    {name: 'HCT',  unit: '%'},
    {name: 'MCV',  unit: 'fL'},
    {name: 'MCH',  unit: 'pg'},
    {name: 'MCHC', unit: 'g/dL'},
    {name: 'PLT',  unit: 'x10³/µL'},
  ],
};

export default function ManualEntryScreen() {
  const navigation = useNavigation<Nav>();
  const {params} = useRoute<Route>();
  const {categoryId, categoryLabel, categoryIcon} = params;

  const fields = CATEGORY_FIELDS[categoryId] ?? [];
  const [values, setValues] = useState<Record<string, string>>({});
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-US', {month: 'short', day: '2-digit', year: 'numeric'});

  const handleProceed = () => {
    const entries = fields.map(f => ({
      fieldName: f.name,
      value: values[f.name] ?? '',
      unit: f.unit,
    }));
    navigation.navigate('VerifyResult', {
      categoryId,
      categoryLabel,
      categoryIcon,
      entries,
      date: formatDate(date),
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center px-4 pt-10 pb-3 border-b border-gray-100">
        <TouchableOpacity onPress={() => navigation.goBack()} className="p-2 mr-2">
          <Text className="text-gray-600 text-xl">‹</Text>
        </TouchableOpacity>
        <Text className="flex-1 text-center text-gray-800 text-base font-semibold mr-8">
          Manual Entry
        </Text>
      </View>

      {/* Category label */}
      <View className="items-center py-3 border-b border-gray-100">
        <Text className="text-gray-600 text-sm font-medium">{categoryLabel}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-4">
        {/* Date */}
        <Text className="text-gray-700 text-sm font-medium mt-4 mb-2">Date</Text>
        <TouchableOpacity
          onPress={() => setShowDatePicker(true)}
          className="flex-row items-center gap-2 border border-gray-200 rounded-xl px-4 py-3 mb-4">
          <Text className="text-gray-400">📅</Text>
          <Text className="text-gray-700 text-sm">{formatDate(date)}</Text>
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={new Date()}
            onChange={(_, selected) => {
              setShowDatePicker(false);
              if (selected) setDate(selected);
            }}
          />
        )}

        {/* Fields */}
        {fields.map(field => (
          <View key={field.name} className="mb-3">
            <Text className="text-gray-700 text-sm font-medium mb-1">
              {field.name}
              {field.required && <Text className="text-red-400"> *</Text>}
            </Text>
            <View className="flex-row gap-2">
              <TextInput
                value={values[field.name] ?? ''}
                onChangeText={v => setValues(prev => ({...prev, [field.name]: v}))}
                placeholder="Enter value"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
                className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-sm"
              />
              {field.unit && (
                <View className="border border-gray-200 rounded-xl px-3 py-3 justify-center">
                  <Text className="text-gray-500 text-sm">{field.unit}</Text>
                </View>
              )}
            </View>
          </View>
        ))}

        <View className="h-24" />
      </ScrollView>

      {/* Proceed */}
      <View className="px-4 py-4 border-t border-gray-100">
        <TouchableOpacity
          onPress={handleProceed}
          className="bg-teal-500 rounded-2xl py-4 items-center">
          <Text className="text-white font-semibold text-base">Proceed</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
