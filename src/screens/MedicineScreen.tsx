import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {useFocusEffect} from '@react-navigation/native';
import FloatingAddButton from '../components/FloatingAddButton';
import Pills from '../assets/svg_icons/pills.svg';
import MagnifyingGlass from '../assets/svg_icons/magnifying-glass.svg';
import Filter from '../assets/svg_icons/filter.svg';
import Clock from '../assets/svg_icons/clock.svg';
import Stock from '../assets/svg_icons/stock.svg';
import {getMedicines} from '../database/services';
import MedicineModel from '../database/models/Medicine';

function StockBar({current, max, threshold, isLow}: {current: number; max: number; threshold: number; isLow: boolean}) {
  const safeMax = max > 0 ? max : 1;
  const fillPercent = Math.min((current / safeMax) * 100, 100);
  const thresholdPercent = Math.min((threshold / safeMax) * 100, 100);
  const barColor = isLow ? '#F97316' : '#14B8A6';
  return (
    <View className="h-2 bg-gray-100 rounded-full" style={{position: 'relative'}}>
      <View style={{width: `${fillPercent}%`, backgroundColor: barColor, height: '100%', borderRadius: 999}} />
      {threshold > 0 && (
        <View style={{
          position: 'absolute',
          left: `${thresholdPercent}%`,
          top: -3,
          width: 2,
          height: 14,
          backgroundColor: '#EF4444',
          borderRadius: 1,
        }} />
      )}
    </View>
  );
}

export default function MedicineScreen() {
  const navigation = useNavigation<any>();
  const [search, setSearch] = useState('');
  const [medicines, setMedicines] = useState<MedicineModel[]>([]);

  useFocusEffect(
    useCallback(() => {
      getMedicines().then(setMedicines);
    }, [])
  );

  const filtered = medicines.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-100" style={{position: 'relative'}}>
      {/* Header */}
      <View className="bg-teal-500 px-5 pt-10 pb-8 rounded-b-3xl">
        <Text className="text-white text-2xl font-bold">My Medicines</Text>
        <Text className="text-teal-100 text-sm mt-1">
          Manage and track all of your medicines.
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="px-4 mt-4">

          {/* Search + Filters */}
          <View className="flex-row gap-3 mb-4 items-center">
            <View className="flex-1 flex-row items-center bg-white rounded-xl px-3 gap-x-2 border border-gray-100">
              {/* Search icon placeholder */}
              <MagnifyingGlass width={25} height={25} color='black' />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search medicine..."
                placeholderTextColor="#9ca3af"
                className="flex-1 py-3 text-sm text-gray-800"
              />
            </View>
            <TouchableOpacity className="flex-row items-center gap-x-2 bg-white px-4 py-3 rounded-xl border border-gray-100">
              {/* Filter icon placeholder */}
              <Filter width={25} height={25} color='black' />
              <Text className="text-gray-600 text-sm font-medium">Filters</Text>
            </TouchableOpacity>
          </View>

          {/* Medicine Cards */}
          {filtered.map(med => {
            const isLow = med.lowStockAlert && med.currentStock <= med.lowStockThreshold;
            const iconColor = med.color;
            const iconBg = med.color + '22';
            const times = med.parsedIntakeTimes;
            const nextIntake = times.length > 0 ? times[0] : '—';
            const timesLabel = times.length === 1 ? 'Once a day' : `${times.length}x a day`;
            return (
            <TouchableOpacity
              key={med.id}
              onPress={() => navigation.navigate('MedicineDetail', {id: med.id})}
              className="bg-white rounded-2xl p-4 mb-3 shadow-sm">

              {/* Top Row: Icon + Name + Intake/Frequency */}
              <View className="flex-row gap-3">
                <View
                  className="w-12 h-12 rounded-xl items-center justify-center"
                  style={{backgroundColor: iconBg}}>
                  <Pills width={28} height={28} color={iconColor} />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-800 font-semibold text-sm">{med.name}</Text>
                  <Text className="text-gray-400 text-xs mt-0.5">{med.form}</Text>
                  <View className="flex-row gap-4 mt-2">
                    <View>
                      <Text className="text-gray-400 text-xs">Next Intake</Text>
                      <View className="flex-row items-center gap-1 mt-0.5">
                        <Clock width={15} height={15} color='black' />
                        <Text className="text-teal-600 text-xs font-semibold">{nextIntake}</Text>
                      </View>
                    </View>
                    <View>
                      <Text className="text-gray-400 text-xs">Frequency</Text>
                      <Text className="text-gray-700 text-xs font-semibold mt-0.5">{timesLabel}</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Instock Row */}
              <View className="mt-3">
                <View className="flex-row items-center justify-between mb-1">
                  <View className="flex-row items-center gap-1">
                    <Stock width={25} height={25} color='black' />
                    <Text className="text-gray-500 text-xs">Instock</Text>
                  </View>
                  <View
                    className="px-2 py-0.5 rounded-full"
                    style={{backgroundColor: isLow ? '#FFF7ED' : '#F0FDFA'}}>
                    <Text
                      className="text-xs font-semibold"
                      style={{color: isLow ? '#F97316' : '#14B8A6'}}>
                      {med.currentStock} {med.form}(s) Left
                    </Text>
                  </View>
                </View>
                <StockBar
                  current={med.currentStock}
                  max={med.maxStock}
                  threshold={med.lowStockAlert ? med.lowStockThreshold : 0}
                  isLow={isLow}
                />
                {med.lowStockAlert && (
                  <View className="flex-row items-center gap-1 mt-1">
                    <View className="w-2 h-2 rounded-full bg-red-400" />
                    <Text className="text-gray-400 text-xs">Low stock at {med.lowStockThreshold}</Text>
                  </View>
                )}
              </View>

              {/* Footer */}
              <View className="flex-row items-center gap-2 mt-2">
                <View className="w-2 h-2 rounded-full" style={{backgroundColor: isLow ? '#F97316' : '#14B8A6'}} />
                <Text className="text-xs font-medium" style={{color: isLow ? '#F97316' : '#14B8A6'}}>
                  {isLow ? 'Low Stock' : 'Good Stock'}
                </Text>
              </View>

            </TouchableOpacity>
            );
          })}

          {/* Empty state */}
          {filtered.length === 0 && (
            <View className="items-center mt-16">
              <Text className="text-gray-400 text-sm">No medicines found.</Text>
            </View>
          )}

          <View className="h-24" />
        </View>
      </ScrollView>

      <FloatingAddButton onPress={() => navigation.navigate('AddMedicine')} />
    </SafeAreaView>
  );
}
