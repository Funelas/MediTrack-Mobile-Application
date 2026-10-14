import React, {useState} from 'react';
import {
  View, Text, SafeAreaView, TouchableOpacity,
  TextInput, ScrollView, Platform,
} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import DateTimePicker from '@react-native-community/datetimepicker';
import {ReportsStackParamList} from '../navigation/ReportsStackNavigator';
import Calendar from '../assets/svg_icons/calendar.svg';

type Nav = NativeStackNavigationProp<ReportsStackParamList>;
type Route = RouteProp<ReportsStackParamList, 'ManualEntry'>;

export default function ManualEntryScreen() {
  const navigation = useNavigation<Nav>();
  const {params} = useRoute<Route>();
  const {categoryId, categoryLabel, categoryIcon} = params;

  // All categories now pass their fields as JSON through params
  const fields = (params as any).fields
    ? JSON.parse((params as any).fields)
    : [];

  const [values, setValues] = useState<Record<string, string>>({});
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-US', {month: 'short', day: '2-digit', year: 'numeric'});

  const handleProceed = () => {
    // Include normalRange so VerifyResultScreen can compute status at save time
    const entries = fields.map((f: any) => ({
      fieldName: f.name,
      value: values[f.name] ?? '',
      unit: f.unit ?? '',
      normalRange: f.normalRange ?? '',
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
          <Calendar width={20} height={20} color="black" />
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
        {fields.length === 0 && (
          <Text className="text-gray-400 text-sm text-center mt-8">
            No fields defined for this category.
          </Text>
        )}
        {fields.map((field: any) => (
          <View key={field.name} className="mb-3">
            <View className="flex-row items-center gap-1 mb-1">
              <Text className="text-gray-700 text-sm font-medium">{field.name}</Text>
              {field.required && <Text className="text-red-400 text-sm">*</Text>}
              {field.normalRange ? (
                <Text className="text-gray-400 text-xs ml-1">({field.normalRange})</Text>
              ) : null}
            </View>
            <View className="flex-row gap-2">
              <TextInput
                value={values[field.name] ?? ''}
                onChangeText={v => setValues(prev => ({...prev, [field.name]: v}))}
                placeholder="Enter value"
                placeholderTextColor="#9ca3af"
                keyboardType={field.type === 'descriptive' ? 'default' : 'numeric'}
                className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-gray-800 text-sm"
              />
              {field.unit ? (
                <View className="border border-gray-200 rounded-xl px-3 py-3 justify-center">
                  <Text className="text-gray-500 text-sm">{field.unit}</Text>
                </View>
              ) : null}
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
