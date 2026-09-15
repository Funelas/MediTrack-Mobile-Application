import React, {useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import FloatingAddButton from '../components/FloatingAddButton';
import Pills from '../assets/svg_icons/pills.svg';
import MagnifyingGlass from '../assets/svg_icons/magnifying-glass.svg';
import Filter from '../assets/svg_icons/filter.svg';
import Clock from '../assets/svg_icons/clock.svg';
import Stock from '../assets/svg_icons/stock.svg';
interface Medicine {
  id: string;
  name: string;
  type: string;
  nextIntake: string;
  frequency: string;
  instock: number;
  totalStock: number;
  stockStatus: 'good' | 'low';
  enoughUntil: string;
  iconColor: string;
  iconBg: string;
}

const medicines: Medicine[] = [
  {
    id: '1',
    name: 'Metformin 500g',
    type: 'Oral Tablet',
    nextIntake: '9:00 AM',
    frequency: 'Once a day',
    instock: 90,
    totalStock: 100,
    stockStatus: 'good',
    enoughUntil: 'Aug. 24 2026',
    iconColor: '#6366F1',
    iconBg: '#EEF2FF',
  },
  {
    id: '2',
    name: 'Atorvastatin 10mg',
    type: 'Oral Tablet',
    nextIntake: '9:00 PM',
    frequency: 'Once a day',
    instock: 20,
    totalStock: 100,
    stockStatus: 'low',
    enoughUntil: 'Aug. 20 2026',
    iconColor: '#F97316',
    iconBg: '#FFF7ED',
  },
  {
    id: '3',
    name: 'Amlodipine 5mg',
    type: 'Oral Tablet',
    nextIntake: '9:00 AM',
    frequency: 'Once a day',
    instock: 60,
    totalStock: 100,
    stockStatus: 'good',
    enoughUntil: 'Sept. 30 2026',
    iconColor: '#14B8A6',
    iconBg: '#F0FDFA',
  },
  {
    id: '4',
    name: 'Vitamin D3 1000 IU',
    type: 'Capsule',
    nextIntake: '8:00 AM',
    frequency: 'Once a day',
    instock: 80,
    totalStock: 100,
    stockStatus: 'good',
    enoughUntil: 'Sept. 30 2026',
    iconColor: '#EAB308',
    iconBg: '#FEFCE8',
  },
];

function StockBar({instock, total, status}: {instock: number; total: number; status: 'good' | 'low'}) {
  const percent = (instock / total) * 100;
  const barColor = status === 'good' ? '#14B8A6' : '#F97316';
  return (
    <View className="h-2 bg-gray-100 rounded-full overflow-hidden">
      <View style={{width: `${percent}%`, backgroundColor: barColor, height: '100%', borderRadius: 999}} />
    </View>
  );
}

export default function MedicineScreen() {
  const navigation = useNavigation<any>();
  const [search, setSearch] = useState('');

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
          {filtered.map(med => (
            <TouchableOpacity
              key={med.id}
              className="bg-white rounded-2xl p-4 mb-3 shadow-sm">

              {/* Top Row: Icon + Name + Intake/Frequency */}
              <View className="flex-row gap-3">
                {/* Icon */}
                <View
                  className="w-12 h-12 rounded-xl items-center justify-center"
                  style={{backgroundColor: med.iconBg}}>
                  <Pills width={28} height={28} color={med.iconColor} />
                </View>

                {/* Name + Type */}
                <View className="flex-1">
                  <Text className="text-gray-800 font-semibold text-sm">{med.name}</Text>
                  <Text className="text-gray-400 text-xs mt-0.5">{med.type}</Text>

                  {/* Next Intake + Frequency */}
                  <View className="flex-row gap-4 mt-2">
                    <View>
                      <Text className="text-gray-400 text-xs">Next Intake</Text>
                      <View className="flex-row items-center gap-1 mt-0.5">
                        {/* Clock icon placeholder */}
                        <Clock width={15} height={15} color='black' />
                        <Text className="text-teal-600 text-xs font-semibold">{med.nextIntake}</Text>
                      </View>
                    </View>
                    <View>
                      <Text className="text-gray-400 text-xs">Frequency</Text>
                      <Text className="text-gray-700 text-xs font-semibold mt-0.5">{med.frequency}</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Instock Row */}
              <View className="mt-3">
                <View className="flex-row items-center justify-between mb-1">
                  <View className="flex-row items-center gap-1">
                    {/* Pill icon placeholder */}
                    <Stock width={25} height={25} color='black' />
                    <Text className="text-gray-500 text-xs">Instock</Text>
                  </View>
                  <View
                    className="px-2 py-0.5 rounded-full"
                    style={{backgroundColor: med.stockStatus === 'good' ? '#F0FDFA' : '#FFF7ED'}}>
                    <Text
                      className="text-xs font-semibold"
                      style={{color: med.stockStatus === 'good' ? '#14B8A6' : '#F97316'}}>
                      {med.instock} Tablets Left
                    </Text>
                  </View>
                </View>
                <StockBar instock={med.instock} total={med.totalStock} status={med.stockStatus} />
              </View>

              {/* Footer: Stock Status + Enough Until */}
              <View className="flex-row items-center gap-2 mt-2">
                <View
                  className="w-2 h-2 rounded-full"
                  style={{backgroundColor: med.stockStatus === 'good' ? '#14B8A6' : '#F97316'}}
                />
                <Text
                  className="text-xs font-medium"
                  style={{color: med.stockStatus === 'good' ? '#14B8A6' : '#F97316'}}>
                  {med.stockStatus === 'good' ? 'Good Stock' : 'Low Stock'}
                </Text>
                <Text className="text-gray-300 text-xs">·</Text>
                <Text className="text-gray-400 text-xs">Enough until {med.enoughUntil}</Text>
              </View>

            </TouchableOpacity>
          ))}

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
