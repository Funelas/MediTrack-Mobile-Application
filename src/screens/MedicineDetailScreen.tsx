import React, {useState, useEffect} from 'react';
import {View, Text, SafeAreaView, TouchableOpacity, ScrollView, ActivityIndicator} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {MedsStackParamList} from '../navigation/MedsStackNavigator';
import Pills from '../assets/svg_icons/pills.svg';
import Clock from '../assets/svg_icons/clock.svg';
import Bell from '../assets/svg_icons/bell.svg';
import Stock from '../assets/svg_icons/stock.svg';
import QR from '../assets/svg_icons/qr.svg';
import {database} from '../database';
import MedicineModel from '../database/models/Medicine';

type Nav = NativeStackNavigationProp<MedsStackParamList>;
type Route = RouteProp<MedsStackParamList, 'MedicineDetail'>;

function StockBar({current, max, threshold, color}: {current: number; max: number; threshold: number; color: string}) {
  const safeMax = max > 0 ? max : 1;
  const pct = Math.min((current / safeMax) * 100, 100);
  const thresholdPct = Math.min((threshold / safeMax) * 100, 100);
  return (
    <View className="h-2 bg-gray-100 rounded-full mt-2 mb-1" style={{position: 'relative'}}>
      <View style={{width: `${pct}%`, backgroundColor: color, height: '100%', borderRadius: 999}} />
      {threshold > 0 && (
        <View style={{
          position: 'absolute', left: `${thresholdPct}%`,
          top: -3, width: 2, height: 14, backgroundColor: '#EF4444', borderRadius: 1,
        }} />
      )}
    </View>
  );
}

export default function MedicineDetailScreen() {
  const navigation = useNavigation<Nav>();
  const {params} = useRoute<Route>();
  const [med, setMed] = useState<MedicineModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [taken, setTaken] = useState<Record<number, boolean>>({});

  useEffect(() => {
    database.get<MedicineModel>('medicines').find(params.id)
      .then(result => { setMed(result); })
      .catch(() => setMed(null))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator color="#14B8A6" />
      </SafeAreaView>
    );
  }

  if (!med) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <Text className="text-gray-400">Medicine not found.</Text>
      </SafeAreaView>
    );
  }

  const intakeTimes = med.parsedIntakeTimes;
  const repeat = med.parsedRepeat;
  const repeatLabel = repeat.type === 'everyday'
    ? 'Every Day'
    : repeat.days && repeat.days.length > 0 ? repeat.days.join(', ') : 'Custom';
  const startDateLabel = new Date(med.startDate).toLocaleDateString('en-US', {month: 'long', day: 'numeric', year: 'numeric'});
  const isLow = med.lowStockAlert && med.currentStock <= med.lowStockThreshold;
  const stockColor = isLow ? '#F97316' : '#14B8A6';
  const iconBg = med.color + '22';
  const unit = med.form + '(s)';

  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-10 pb-3 bg-white border-b border-gray-100">
        <TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
          <Text className="text-gray-600 text-xl">‹</Text>
        </TouchableOpacity>
        <Text className="text-gray-800 text-base font-semibold">Medicine Details</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('EditMedicine', {id: med.id})}
          className="p-2">
          <Text className="text-teal-500 text-sm font-semibold">Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
        <View className="px-4 pt-4 pb-8 gap-4">

          {/* Medicine Identity Card */}
          <View className="bg-white rounded-2xl p-4 flex-row items-center gap-4">
            <View className="w-16 h-16 rounded-2xl items-center justify-center" style={{backgroundColor: iconBg}}>
              <Pills width={32} height={32} color={med.color} />
            </View>
            <View>
              <Text className="text-gray-800 text-xl font-bold">{med.name}</Text>
              <Text className="text-gray-400 text-sm mt-0.5">{med.dosage}</Text>
              <Text className="text-gray-400 text-sm">{med.form}</Text>
            </View>
          </View>

          {/* Today's Intake */}
          <View>
            <Text className="text-teal-500 text-sm font-bold mb-2">Today's Intake</Text>
            <View className="bg-white rounded-2xl p-4 gap-3">
              {intakeTimes.length === 0
                ? <Text className="text-gray-400 text-sm">No intake times set.</Text>
                : intakeTimes.map((t, i) => (
                  <View key={i} className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-3">
                      <TouchableOpacity
                        onPress={() => setTaken(prev => ({...prev, [i]: !prev[i]}))}
                        className="w-10 h-10 rounded-full items-center justify-center"
                        style={{backgroundColor: taken[i] ? '#14B8A6' : '#F3F4F6'}}>
                        <Text className="text-white text-base font-bold">✓</Text>
                      </TouchableOpacity>
                      <View>
                        <Text className="text-gray-800 text-sm font-semibold">
                          {taken[i] ? 'Taken' : 'Not yet taken'}
                        </Text>
                        <Text className="text-gray-400 text-xs mt-0.5">Scheduled at {t}</Text>
                      </View>
                    </View>
                    <View className="items-end gap-1">
                      <Text className="text-gray-400 text-xs">Tracking</Text>
                      {med.trackingMethod === 'qr'
                        ? <QR width={22} height={22} color="#6366F1" />
                        : <Text className="text-gray-500 text-xs font-medium">Tap to Log</Text>}
                    </View>
                  </View>
                ))
              }
            </View>
          </View>

          {/* Schedule & Reminder */}
          <View>
            <Text className="text-teal-500 text-sm font-bold mb-2">Schedule & Reminder</Text>
            <View className="bg-white rounded-2xl overflow-hidden">
              <View className="flex-row items-center gap-3 px-4 py-4 border-b border-gray-100">
                <View className="w-9 h-9 rounded-xl bg-gray-100 items-center justify-center">
                  <Clock width={18} height={18} color="#6B7280" />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-500 text-xs">Start Date</Text>
                </View>
                <Text className="text-gray-800 text-sm font-semibold">{startDateLabel}</Text>
              </View>
              <View className="flex-row items-center gap-3 px-4 py-4 border-b border-gray-100">
                <View className="w-9 h-9 rounded-xl bg-gray-100 items-center justify-center">
                  <Pills width={18} height={18} color="#6B7280" />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-500 text-xs">Repeat</Text>
                </View>
                <Text className="text-gray-800 text-sm font-semibold">{repeatLabel}</Text>
              </View>
              <View className="flex-row items-center gap-3 px-4 py-4 border-b border-gray-100">
                <View className="w-9 h-9 rounded-xl bg-gray-100 items-center justify-center">
                  <Clock width={18} height={18} color="#6B7280" />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-500 text-xs">Ends</Text>
                </View>
                <Text className="text-gray-800 text-sm font-semibold">
                  {med.endsType === 'Never' ? 'Never'
                    : med.endsType === 'On Date' && med.endDate
                    ? new Date(med.endDate).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})
                    : med.endsType === 'After Occurrences'
                    ? `After ${med.occurrences} occurrences`
                    : 'Never'}
                </Text>
              </View>
              <View className="flex-row items-center gap-3 px-4 py-4">
                <View className="w-9 h-9 rounded-xl bg-gray-100 items-center justify-center">
                  <Bell width={18} height={18} color="#6B7280" />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-500 text-xs">Medication Reminder</Text>
                </View>
                <Text className="text-sm font-bold" style={{color: med.reminderEnabled ? '#14B8A6' : '#9ca3af'}}>
                  {med.reminderEnabled ? 'ON' : 'OFF'}
                </Text>
              </View>
            </View>
          </View>

          {/* Inventory */}
          <View>
            <Text className="text-teal-500 text-sm font-bold mb-2">Inventory</Text>
            <View className="bg-white rounded-2xl overflow-hidden">
              <View className="px-4 pt-4 pb-3 border-b border-gray-100">
                <View className="flex-row items-center gap-3">
                  <View className="w-9 h-9 rounded-xl bg-gray-100 items-center justify-center">
                    <Stock width={18} height={18} color="#6B7280" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-gray-500 text-xs">Current Stock</Text>
                  </View>
                  <Text className="text-gray-800 text-sm font-semibold">{med.currentStock} {unit}</Text>
                </View>
                <StockBar current={med.currentStock} max={med.maxStock} threshold={med.lowStockAlert ? med.lowStockThreshold : 0} color={stockColor} />
                {med.lowStockAlert && (
                  <Text className="text-gray-400 text-xs">Low stock threshold: {med.lowStockThreshold} {unit}</Text>
                )}
              </View>
              <View className="flex-row items-center gap-3 px-4 py-4 border-b border-gray-100">
                <View className="w-9 h-9 rounded-xl bg-gray-100 items-center justify-center">
                  <Bell width={18} height={18} color="#6B7280" />
                </View>
                <View className="flex-1"><Text className="text-gray-500 text-xs">Low-stock alert</Text></View>
                <Text className="text-sm font-bold" style={{color: med.lowStockAlert ? '#14B8A6' : '#9ca3af'}}>
                  {med.lowStockAlert ? 'ON' : 'OFF'}
                </Text>
              </View>
              <View className="flex-row items-center gap-3 px-4 py-4">
                <View className="w-9 h-9 rounded-xl bg-gray-100 items-center justify-center">
                  <Stock width={18} height={18} color="#6B7280" />
                </View>
                <View className="flex-1"><Text className="text-gray-500 text-xs">Maximum stock</Text></View>
                <Text className="text-gray-800 text-sm font-semibold">{med.maxStock} {unit}</Text>
              </View>
            </View>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
