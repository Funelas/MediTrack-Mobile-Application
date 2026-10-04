import React, {useState, useCallback} from 'react';
import {View, Text, SafeAreaView, TouchableOpacity, ScrollView, ActivityIndicator} from 'react-native';
import {useNavigation, useRoute, RouteProp, useFocusEffect} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {MedsStackParamList} from '../navigation/MedsStackNavigator';
import Pills from '../assets/svg_icons/pills.svg';
import Clock from '../assets/svg_icons/clock.svg';
import Bell from '../assets/svg_icons/bell.svg';
import Stock from '../assets/svg_icons/stock.svg';
import QR from '../assets/svg_icons/qr.svg';
import {database} from '../database';
import MedicineModel from '../database/models/Medicine';
import {upsertOccurrence} from '../database/services';
import Check from '../assets/svg_icons/check.svg';
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
  const route = useRoute<Route>();
  const params = route.params;
  const [med, setMed] = useState<MedicineModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [taken, setTaken] = useState<Record<string, boolean>>({});

  // Load today's occurrence state on focus
  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      database.get<MedicineModel>('medicines').find(params.id)
        .then(async result => {
          setMed(result);
          // Load today's done state from occurrences
          const {getItemsForDay} = require('../database/services');
          const todayItems = await getItemsForDay(new Date());
          const initialTaken: Record<string, boolean> = {};
          todayItems
            .filter((i: any) => i.referenceId === params.id)
            .forEach((i: any) => { initialTaken[i.time] = i.isDone; });
          setTaken(initialTaken);
        })
        .catch(() => setMed(null))
        .finally(() => setLoading(false));
    }, [params.id])
  );


  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator color="#14B8A6" />
      </SafeAreaView>
    );
  }

  if (!med) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-8">
        <Text className="text-gray-400 text-center">Medicine not found.</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} className="mt-4">
          <Text className="text-teal-500 font-semibold">Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const intakeTimes = med.parsedIntakeTimes;

  // Parse rrule for display — "FREQ=DAILY" → "Every Day", "FREQ=WEEKLY;BYDAY=MO,WE" → "Mon, Wed"
  const rruleParts: Record<string, string> = {};
  med.rrule.split(';').forEach(part => {
    const [k, v] = part.split('=');
    if (k && v) rruleParts[k] = v;
  });
  const repeatLabel = (() => {
    if (rruleParts['COUNT'] === '1') return 'Does not repeat';
    if (rruleParts['BYDAY']) {
      const dayMap: Record<string, string> = {
        SU: 'Sun', MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat',
      };
      return rruleParts['BYDAY'].split(',').map(d => dayMap[d] ?? d).join(', ');
    }
    if (rruleParts['FREQ'] === 'WEEKLY') return 'Every Week';
    if (rruleParts['FREQ'] === 'MONTHLY') return 'Every Month';
    return 'Every Day';
  })();

  const endsLabel = (() => {
    if (med.endsType === 'on_date' && med.endDate)
      return new Date(med.endDate).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'});
    if (med.endsType === 'after_occurrences')
      return `After ${med.occurrencesCount} occurrences`;
    return 'Never';
  })();

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
          <View className="bg-white rounded-2xl p-4 flex-row items-center gap-x-4">
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
            <View className="bg-white rounded-2xl p-4">
              {intakeTimes.length === 0
                ? <Text className="text-gray-400 text-sm">No intake times set.</Text>
                : intakeTimes.map((t, i) => (
                    <View key={i} className={`flex-row items-center justify-between py-3 ${i < intakeTimes.length - 1 ? 'border-b border-gray-100' : ''}`}>
                      <View className="flex-row items-center gap-3">
                        <View className={`w-10 h-10 rounded-full items-center justify-center`}
                          style={{backgroundColor: taken[t] ? '#CCFBF1' : '#F3F4F6'}}>
                          <Clock width={18} height={18} color={taken[t] ? '#14B8A6' : '#9ca3af'} />
                        </View>
                        <View>
                          <Text className="text-gray-800 text-sm font-semibold">
                            {taken[t] ? 'Taken' : 'Not yet taken'}
                          </Text>
                          <Text className="text-gray-400 text-xs mt-0.5">Scheduled at {t}</Text>
                        </View>
                      </View>

                      {/* Action button */}
                      {med.trackingMethod === 'qr' ? (
                        <TouchableOpacity
                          className="flex-row items-center gap-1.5 bg-purple-50 px-3 py-2 rounded-xl"
                          onPress={() => {/* camera placeholder */}}>
                          <QR width={16} height={16} color="#6366F1" />
                          <Text className="text-purple-500 text-xs font-semibold">Scan</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          onPress={async () => {
                            if (!med) return;
                            const newVal = !taken[t];
                            setTaken(prev => ({...prev, [t]: newVal}));
                            await upsertOccurrence(med.id, 'med', new Date(), t, {isDone: newVal});
                          }}
                          className="flex-row items-center gap-1.5 px-3 py-2 rounded-xl"
                          style={{backgroundColor: taken[t] ? '#CCFBF1' : '#F0FDFA'}}>
                          <Check width={16} height={16} color={taken[t] ? '#14B8A6' : '#14B8A6'} />
                          <Text className="text-xs font-semibold" style={{color: '#14B8A6'}}>
                            {taken[t] ? 'Taken' : 'Mark Done'}
                          </Text>
                        </TouchableOpacity>
                      )}
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
                <Text className="text-gray-800 text-sm font-semibold">{endsLabel}</Text>
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
