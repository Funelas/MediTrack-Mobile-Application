import React, {useState, useCallback} from 'react';
import {
  View, Text, SafeAreaView, TouchableOpacity,
  TextInput, ScrollView, ActivityIndicator,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {useFocusEffect} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {ReportsStackParamList} from '../navigation/ReportsStackNavigator';
import {CategoryIcon, CategoryIconKey} from '../components/CategoryIconPickerModal';
import {getCategories} from '../database/services';
import {BUILT_IN_CATEGORIES} from '../data/categoryDefinitions';
import Category from '../database/models/Category';
import Search from '../assets/svg_icons/magnifying-glass.svg';

type Nav = NativeStackNavigationProp<ReportsStackParamList>;

interface DisplayCategory {
  id: string;
  label: string;
  icon: string;
  color: string;
  fields?: string; // JSON — only for user-created
}

export default function AddCheckupReportScreen() {
  const navigation = useNavigation<Nav>();
  const [search, setSearch] = useState('');
  const [allCategories, setAllCategories] = useState<DisplayCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        setLoading(true);
        const userCats = await getCategories();
        const builtIn: DisplayCategory[] = BUILT_IN_CATEGORIES.map(c => ({
          id: c.id, label: c.label, icon: c.icon, color: '#14B8A6',
        }));
        const userDisplay: DisplayCategory[] = userCats.map(c => ({
          id: c.id, label: c.label, icon: c.icon, color: c.color, fields: c.fields,
        }));
        setAllCategories([...builtIn, ...userDisplay]);
        setLoading(false);
      };
      load();
    }, []),
  );

  const filtered = allCategories.filter(c =>
    c.label.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSelect = (cat: DisplayCategory) => {
    navigation.navigate('InputMethod', {
      categoryId: cat.id,
      categoryLabel: cat.label,
      categoryIcon: cat.icon,
      // pass user-created fields so ManualEntryScreen can use them
      ...(cat.fields ? {fields: cat.fields} : {}),
    } as any);
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

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <View className="px-4">
          {/* Title */}
          <View className="items-center mt-8 mb-6">
            <Text className="text-gray-800 font-bold text-lg text-center">
              What type of checkup{'\n'}result is this?
            </Text>
            <Text className="text-gray-400 text-sm mt-1 text-center">
              Select the category this test belongs to.
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
          {loading ? (
            <ActivityIndicator color="#14B8A6" style={{marginTop: 20}} />
          ) : filtered.length === 0 ? (
            <Text className="text-gray-400 text-sm text-center mt-4">
              {search ? 'No categories match your search.' : 'No categories yet.'}
            </Text>
          ) : (
            <View className="gap-2">
              {filtered.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => handleSelect(cat)}
                  className="flex-row items-center justify-between bg-white border border-gray-200 rounded-2xl px-4 py-4">
                  <View className="flex-row items-center gap-3">
                    <View
                      className="w-9 h-9 rounded-xl items-center justify-center"
                      style={{backgroundColor: cat.color + '22'}}>
                      <CategoryIcon
                        iconKey={cat.icon as CategoryIconKey}
                        size={20}
                        color={cat.color}
                      />
                    </View>
                    <Text className="text-gray-800 text-sm font-medium">{cat.label}</Text>
                  </View>
                  <Text className="text-gray-400 text-lg">›</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View className="h-24" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
