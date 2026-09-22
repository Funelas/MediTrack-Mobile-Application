import React, {useState} from 'react';
import {View, Text, SafeAreaView, TouchableOpacity, ActivityIndicator, Alert} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';
import {ReportsStackParamList} from '../navigation/ReportsStackNavigator';
import {recognizeText, parseOCRText} from '../utils/ocrUtils';
import QR from '../assets/svg_icons/qr.svg';
import Tap from '../assets/svg_icons/tap.svg';

type Nav = NativeStackNavigationProp<ReportsStackParamList>;
type Route = RouteProp<ReportsStackParamList, 'InputMethod'>;

// Must match ManualEntryScreen's CATEGORY_FIELDS
const CATEGORY_FIELDS: Record<string, {name: string; unit?: string}[]> = {
  clinical: [
    {name: 'HbA1C',             unit: '%'},
    {name: 'Magnesium',         unit: 'mg/dL'},
    {name: 'FBS',               unit: 'mg/dL'},
    {name: 'Total Cholesterol', unit: 'mg/dL'},
    {name: 'HDL',               unit: 'mg/dL'},
    {name: 'LDL',               unit: 'mg/dL'},
    {name: 'VLDL',              unit: 'mg/dL'},
    {name: 'Triglycerides',     unit: 'mg/dL'},
    {name: 'BUN',               unit: 'mg/dL'},
    {name: 'BUA',               unit: 'mg/dL'},
    {name: 'Creatinine',        unit: 'mg/dL'},
    {name: 'SGPT (ALT)',        unit: 'U/L'},
    {name: 'SGOT (AST)',        unit: 'U/L'},
    {name: 'Sodium',            unit: 'mEq/L'},
    {name: 'Potassium',         unit: 'mEq/L'},
    {name: 'Ionized Calcium',   unit: 'mEq/L'},
  ],
  cbc: [
    {name: 'WBC',  unit: 'x10³/µL'},
    {name: 'RBC',  unit: 'x10⁶/µL'},
    {name: 'HGB',  unit: 'g/dL'},
    {name: 'HCT',  unit: '%'},
    {name: 'MCV',  unit: 'fL'},
    {name: 'MCH',  unit: 'pg'},
    {name: 'MCHC', unit: 'g/dL'},
    {name: 'PLT',  unit: 'x10³/µL'},
  ],
};

export default function InputMethodScreen() {
  const navigation = useNavigation<Nav>();
  const {params} = useRoute<Route>();
  const {categoryId, categoryLabel, categoryIcon} = params;
  const [loading, setLoading] = useState(false);

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-US', {month: 'short', day: '2-digit', year: 'numeric'});

  const runOCR = async (imageUri: string) => {
    setLoading(true);
    try {
      const rawText = await recognizeText(imageUri);
      const fields = CATEGORY_FIELDS[categoryId] ?? [];
      const entries = parseOCRText(rawText, fields);
      navigation.navigate('VerifyResult', {
        categoryId,
        categoryLabel,
        categoryIcon,
        entries,
        date: formatDate(new Date()),
        isOCR: true,
      });
    } catch (e) {
      Alert.alert('OCR Failed', 'Could not read the image. Please try again or use Manual Entry.');
    } finally {
      setLoading(false);
    }
  };

  const handleOCRCamera = () => {
    launchCamera(
      {mediaType: 'photo', quality: 1, saveToPhotos: false},
      response => {
        if (response.didCancel || response.errorCode) return;
        const uri = response.assets?.[0]?.uri;
        if (uri) runOCR(uri);
      },
    );
  };

  const handleOCRGallery = () => {
    launchImageLibrary(
      {mediaType: 'photo', quality: 1},
      response => {
        if (response.didCancel || response.errorCode) return;
        const uri = response.assets?.[0]?.uri;
        if (uri) runOCR(uri);
      },
    );
  };

  const handleOCRPress = () => {
    Alert.alert(
      'OCR Scan',
      'Choose image source',
      [
        {text: 'Camera', onPress: handleOCRCamera},
        {text: 'Gallery', onPress: handleOCRGallery},
        {text: 'Cancel', style: 'cancel'},
      ],
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center px-4 pt-10 pb-3 border-b border-gray-100">
        <TouchableOpacity onPress={() => navigation.goBack()} className="p-2 mr-2">
          <Text className="text-gray-600 text-xl">‹</Text>
        </TouchableOpacity>
        <Text className="flex-1 text-center text-gray-800 text-base font-semibold mr-8">
          Add Checkup Report
        </Text>
      </View>

      <View className="flex-1 px-4 justify-center">
        {/* Title */}
        <View className="items-center mb-8">
          <Text className="text-gray-800 font-bold text-lg text-center">Choose Input Method</Text>
          <Text className="text-gray-400 text-sm mt-1 text-center">
            Select how you want to add your checkup result.
          </Text>
        </View>

        {/* OCR Option */}
        <TouchableOpacity
          onPress={handleOCRPress}
          disabled={loading}
          className="border border-gray-200 rounded-2xl p-4 mb-3 flex-row items-center gap-4">
          <View className="w-12 h-12 bg-purple-100 rounded-xl items-center justify-center">
            {loading
              ? <ActivityIndicator color="#634DD2" />
              : <QR width={24} height={24} color="#634DD2" />}
          </View>
          <View className="flex-1">
            <Text className="text-gray-800 text-sm font-semibold">OCR Scan (Recommended)</Text>
            <Text className="text-gray-400 text-xs mt-1">
              Scan your lab report or checkup result. We'll extract the values automatically using OCR technology.
            </Text>
          </View>
          <Text className="text-gray-400 text-lg">›</Text>
        </TouchableOpacity>

        {/* Manual Option */}
        <TouchableOpacity
          onPress={() => navigation.navigate('ManualEntry', params)}
          disabled={loading}
          className="border border-gray-200 rounded-2xl p-4 mb-6 flex-row items-center gap-4">
          <View className="w-12 h-12 bg-teal-100 rounded-xl items-center justify-center">
            <Tap width={24} height={24} color="#14B8A6" />
          </View>
          <View className="flex-1">
            <Text className="text-gray-800 text-sm font-semibold">Manual Entry</Text>
            <Text className="text-gray-400 text-xs mt-1">
              Enter your checkup result manually by filling in the values.
            </Text>
          </View>
          <Text className="text-gray-400 text-lg">›</Text>
        </TouchableOpacity>

        {/* Info note */}
        <View className="flex-row items-center gap-3 bg-purple-50 rounded-xl px-4 py-3">
          <View className="w-8 h-8 bg-purple-100 rounded-full items-center justify-center">
            <Text className="text-purple-500 text-sm">✓</Text>
          </View>
          <Text className="text-purple-700 text-xs flex-1">
            OCR works best with clear, well-lit photos of printed lab reports.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
