import React, {useState} from 'react';
import {
  View, Text, SafeAreaView, TouchableOpacity,
  TextInput, ScrollView,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {ReportsStackParamList} from '../navigation/ReportsStackNavigator';
import {CategoryIcon, CategoryIconKey} from '../components/CategoryIconPickerModal';
import Search from '../assets/svg_icons/magnifying-glass.svg'
type Nav = NativeStackNavigationProp<ReportsStackParamList>;

const EXISTING_CATEGORIES: {id: string; label: string; icon: CategoryIconKey}[] = [
  {id: 'clinical', label: 'Clinical Chemistry', icon: 'flask'},
  {id: 'cbc',      label: 'Complete Blood Count', icon: 'cell'},
];

export default function AddCheckupReportScreen() {
  const navigation = useNavigation<Nav>();
  const [search, setSearch] = useState('');

  const filtered = EXISTING_CATEGORIES.filter(c =>
    c.label.toLowerCase().includes(search.toLowerCase())
  );

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

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <View className="px-4">
        {/* Title */}
        <View className="items-center mt-8 mb-6">
          <Text className="text-gray-800 font-bold text-lg text-center">
            What type of checkup{'\n'}result is this?
          </Text>
          <Text className="text-gray-400 text-sm mt-1 text-center">
            Select on what type the test will be under.
          </Text>
        </View>

        {/* Search */}
        <View className="flex-row items-center bg-gray-100 rounded-xl px-3 py-2 gap-x-2 mb-3">
          <Search width={20} height={20} color="#9ca3af" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search categories..."
            placeholderTextColor="#9ca3af"
            className="flex-1 text-gray-700 text-sm"
          />
        </View>

        {/* Create new category */}
        <TouchableOpacity
          onPress={() => navigation.navigate('CreateCategory')}
          className="flex-row items-center justify-center gap-x-2 bg-teal-500 rounded-xl px-4 py-3 mb-5">
          <Text className="text-white text-sm font-semibold">+ Create New Category</Text>
        </TouchableOpacity>

        {/* Category List */}
        <View className="gap-2">
          {filtered.map(cat => (
            <TouchableOpacity
              key={cat.id}
              onPress={() => navigation.navigate('InputMethod', {
                categoryId: cat.id,
                categoryLabel: cat.label,
                categoryIcon: cat.icon,
              })}
              className="flex-row items-center justify-between bg-white border border-gray-200 rounded-2xl px-4 py-4">
              <View className="flex-row items-center gap-3">
                <View className="w-9 h-9 rounded-xl bg-gray-100 items-center justify-center">
                  <CategoryIcon iconKey={cat.icon} size={20} color="#6B7280" />
                </View>
                <Text className="text-gray-800 text-sm font-medium">{cat.label}</Text>
              </View>
              <Text className="text-gray-400 text-lg">›</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View className="h-24" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
