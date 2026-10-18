import React, {useState} from 'react';
import {
  View, Text, SafeAreaView, TouchableOpacity,
  ScrollView, TextInput, Alert, ActivityIndicator, Platform,
} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {ReportsStackParamList} from '../navigation/ReportsStackNavigator';
import {CategoryIcon, CategoryIconKey} from '../components/CategoryIconPickerModal';
import {addCheckupReport} from '../database/services';
import {computeStatus} from '../data/categoryDefinitions';
import DateTimePicker from '@react-native-community/datetimepicker';

type Nav = NativeStackNavigationProp<ReportsStackParamList>;
type Route = RouteProp<ReportsStackParamList, 'VerifyResult'>;

export default function VerifyResultScreen() {
  const navigation = useNavigation<Nav>();
  const {params} = useRoute<Route>();
  const {categoryId, categoryLabel, categoryIcon, entries, date, isOCR} = params;

  const [editableEntries, setEditableEntries] = useState(entries.map(e => ({...e})));
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Editable checkup date — initialized from the passed-in date string
  const parseDateString = (s: string): Date => {
    const d = new Date(s);
    return isNaN(d.getTime()) ? new Date() : d;
  };
  const [checkupDate, setCheckupDate] = useState<Date>(() => parseDateString(date));
  const [showDatePicker, setShowDatePicker] = useState(false);

  const formattedDate = checkupDate.toLocaleDateString('en-US', {
    month: 'short', day: '2-digit', year: 'numeric',
  });

  const updateValue = (index: number, value: string) => {
    setEditableEntries(prev => prev.map((e, i) => i === index ? {...e, value} : e));
  };

  // Confidence logic — OCR only
  const detectedCount = editableEntries.filter(e => e.value.trim() !== '').length;
  const totalCount = editableEntries.length;
  const detectionRatio = totalCount > 0 ? detectedCount / totalCount : 1;
  const isLowConfidence = isOCR && detectionRatio < 0.5;

  const handleProceed = async () => {
    const filled = editableEntries.filter(e => e.value.trim() !== '');
    if (filled.length === 0) {
      Alert.alert('No values', 'Please enter at least one test result before saving.');
      return;
    }

    setSaving(true);
    try {
      await addCheckupReport({
        categoryId,
        checkupDate,     // use the editable state, not the raw param string
        results: filled.map(e => ({
          testName: e.fieldName,
          unit: e.unit ?? '',
          normalRange: (e as any).normalRange ?? '',
          value: e.value.trim(),
          status: computeStatus(e.value.trim(), (e as any).normalRange ?? ''),
        })),
      });
      navigation.navigate('ReportsMain', {savedCategoryId: categoryId} as any);
    } catch (err) {
      Alert.alert('Error', 'Failed to save results. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center px-4 pt-10 pb-3 border-b border-gray-100">
        <TouchableOpacity onPress={() => navigation.goBack()} className="p-2 mr-2">
          <Text className="text-gray-600 text-xl">‹</Text>
        </TouchableOpacity>
        <Text className="flex-1 text-center text-gray-800 text-base font-semibold mr-8">
          Verify and Confirm
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-4">

        {/* Low confidence warning */}
        {isLowConfidence && (
          <View className="flex-row items-start gap-3 bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3 mt-4">
            <Text className="text-orange-500 text-base mt-0.5">⚠️</Text>
            <View className="flex-1">
              <Text className="text-orange-700 text-sm font-semibold mb-0.5">Low OCR Confidence</Text>
              <Text className="text-orange-600 text-xs">
                We could only detect {detectedCount} of {totalCount} fields. Please provide a clearer image or switch to Manual Entry.
              </Text>
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                className="mt-2 self-start bg-orange-100 rounded-xl px-3 py-1.5">
                <Text className="text-orange-700 text-xs font-semibold">Use Manual Entry instead</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Category header */}
        <View className="items-center mt-4 mb-4">
          <View className="w-14 h-14 rounded-2xl bg-teal-50 items-center justify-center mb-2">
            <CategoryIcon iconKey={categoryIcon as CategoryIconKey} size={28} color="#14B8A6" />
          </View>
          <Text className="text-gray-800 font-bold text-base">{categoryLabel}</Text>
        </View>

        {/* Date — tappable to change */}
        <Text className="text-gray-700 text-sm font-medium mb-2">Date</Text>
        <TouchableOpacity
          onPress={() => setShowDatePicker(true)}
          className="flex-row items-center gap-2 border border-gray-200 rounded-xl px-4 py-3 mb-4">
          <Text className="text-gray-400">📅</Text>
          <Text className="text-gray-700 text-sm font-medium flex-1">{formattedDate}</Text>
          <Text className="text-teal-500 text-xs font-medium">Change</Text>
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={checkupDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={new Date()}
            onChange={(_, selected) => {
              setShowDatePicker(false);
              if (selected) setCheckupDate(selected);
            }}
          />
        )}

        {/* OCR detection summary */}
        {isOCR && (
          <View className="flex-row items-center gap-2 mb-3 flex-wrap">
            <View className="flex-row items-center gap-1 bg-teal-50 rounded-full px-3 py-1">
              <Text className="text-teal-600 text-xs font-semibold">✓ {detectedCount} detected</Text>
            </View>
            {totalCount - detectedCount > 0 && (
              <View className="flex-row items-center gap-1 bg-yellow-50 rounded-full px-3 py-1">
                <Text className="text-yellow-600 text-xs font-semibold">? {totalCount - detectedCount} not detected</Text>
              </View>
            )}
            <Text className="text-gray-400 text-xs">Tap any value to edit</Text>
          </View>
        )}

        {!isOCR && (
          <Text className="text-gray-400 text-xs mb-3">Tap any value to edit</Text>
        )}

        {/* Results Table */}
        <View className="bg-white border border-gray-200 rounded-2xl overflow-hidden mb-6">
          <View className="flex-row bg-gray-50 px-4 py-3 border-b border-gray-200">
            <Text className="flex-1 text-gray-500 text-xs font-semibold uppercase">Fields</Text>
            {isOCR && <Text className="w-6" />}
            <Text className="w-32 text-gray-500 text-xs font-semibold uppercase text-right">Values</Text>
          </View>

          {editableEntries.map((entry, index) => {
            const isDetected = entry.value.trim() !== '';
            const isEditing = editingIndex === index;
            const status = isDetected
              ? computeStatus(entry.value, (entry as any).normalRange ?? '')
              : 'unknown';
            const statusColor = status === 'normal' ? '#14B8A6'
              : status === 'high' ? '#F97316'
              : status === 'low' ? '#EF4444'
              : '#9ca3af';

            return (
              <View
                key={entry.fieldName}
                className="flex-row items-center px-4 py-3"
                style={{
                  borderBottomWidth: index < editableEntries.length - 1 ? 1 : 0,
                  borderBottomColor: '#F3F4F6',
                  backgroundColor: isEditing ? '#F0FDFA' : 'transparent',
                }}>

                {/* Field + status dot */}
                <View className="flex-1 flex-row items-center gap-2">
                  <Text className="text-gray-700 text-sm">{entry.fieldName}</Text>
                  {isDetected && status !== 'unknown' && (
                    <View className="w-1.5 h-1.5 rounded-full" style={{backgroundColor: statusColor}} />
                  )}
                </View>

                {/* OCR confidence badge */}
                {isOCR && (
                  <View
                    className="w-5 h-5 rounded-full items-center justify-center mr-2"
                    style={{backgroundColor: isDetected ? '#CCFBF1' : '#FEF9C3'}}>
                    <Text style={{fontSize: 10, color: isDetected ? '#14B8A6' : '#CA8A04'}}>
                      {isDetected ? '✓' : '?'}
                    </Text>
                  </View>
                )}

                {/* Editable value */}
                <TouchableOpacity
                  onPress={() => setEditingIndex(isEditing ? null : index)}
                  className="w-32 items-end">
                  {isEditing ? (
                    <TextInput
                      value={entry.value}
                      onChangeText={v => updateValue(index, v)}
                      keyboardType="numeric"
                      autoFocus
                      onBlur={() => setEditingIndex(null)}
                      placeholder="Enter value"
                      placeholderTextColor="#9ca3af"
                      className="text-teal-600 text-sm font-semibold text-right border-b border-teal-400 w-full"
                    />
                  ) : (
                    <Text
                      className="text-sm font-semibold text-right"
                      style={{color: isDetected ? statusColor : '#9ca3af'}}>
                      {isDetected
                        ? `${entry.value}${entry.unit ? ` ${entry.unit}` : ''}`
                        : '—'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        <View className="h-8" />
      </ScrollView>

      {/* Bottom Buttons */}
      <View className="flex-row gap-3 px-4 py-4 border-t border-gray-100">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="flex-1 border border-gray-200 rounded-2xl py-4 items-center">
          <Text className="text-gray-600 font-semibold text-base">Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleProceed}
          disabled={saving}
          className="flex-1 bg-teal-500 rounded-2xl py-4 items-center"
          style={{opacity: saving ? 0.7 : 1}}>
          {saving
            ? <ActivityIndicator color="#ffffff" />
            : <Text className="text-white font-semibold text-base">Save Results</Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
