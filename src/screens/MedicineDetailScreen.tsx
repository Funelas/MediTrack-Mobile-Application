import React, {useState} from 'react';
import {View, Text, SafeAreaView, TouchableOpacity, ScrollView} from 'react-native';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {MedsStackParamList} from '../navigation/MedsStackNavigator';
import Pills from '../assets/svg_icons/pills.svg';
import Clock from '../assets/svg_icons/clock.svg';
import Bell from '../assets/svg_icons/bell.svg';
import Stock from '../assets/svg_icons/stock.svg';
import QR from '../assets/svg_icons/qr.svg';

type Nav = NativeStackNavigationProp<MedsStackParamList>;
type Route = RouteProp<MedsStackParamList, 'MedicineDetail'>;

// Placeholder — will come from real data later
const MEDICINES: Record<string, {
  id: string; name: string; dosage: string; form: string;
  color: string; iconBg: string;
  intake: {taken: boolean; time: string; trackingMethod: 'standard' | 'qr'};
  schedule: {intakeTime: string; timesPerDay: number; reminderEnabled: boolean};
  inventory: {currentStock: number; unit: string; lowStockAlert: boolean; lowStockThreshold: number; enoughUntil: string; totalStock: number};
}> = {
  '1': {
    id: '1', name: 'Metformin', dosage: '500mg', form: 'Tablet',
    color: '#6366F1', iconBg: '#EEF2FF',
    intake: {taken: false, time: '9:00 AM', trackingMethod: 'standard'},
    schedule: {intakeTime: '9:00 AM', timesPerDay: 1, reminderEnabled: true},
    inventory: {currentStock: 90, unit: 'Tablet(s)', lowStockAlert: true, lowStockThreshold: 10, enoughUntil: 'Aug. 24, 2026', totalStock: 100},
  },
  '2': {
    id: '2', name: 'Atorvastatin', dosage: '10mg', form: 'Tablet',
    color: '#F97316', iconBg: '#FFF7ED',
    intake: {taken: false, time: '9:00 PM', trackingMethod: 'standard'},
    schedule: {intakeTime: '9:00 PM', timesPerDay: 1, reminderEnabled: true},
    inventory: {currentStock: 20, unit: 'Tablet(s)', lowStockAlert: true, lowStockThreshold: 10, enoughUntil: 'Aug. 20, 2026', totalStock: 100},
  },
  '3': {
    id: '3', name: 'Amlodipine', dosage: '5mg', form: 'Tablet',
    color: '#14B8A6', iconBg: '#F0FDFA',
    intake: {taken: true, time: '8:02 AM', trackingMethod: 'qr'},
    schedule: {intakeTime: '8:00 AM', timesPerDay: 1, reminderEnabled: true},
    inventory: {currentStock: 60, unit: 'Tablet(s)', lowStockAlert: true, lowStockThreshold: 10, enoughUntil: 'Sept. 10, 2026', totalStock: 100},
  },
  '4': {
    id: '4', name: 'Vitamin D3', dosage: '1000 IU', form: 'Capsule',
    color: '#EAB308', iconBg: '#FEFCE8',
    intake: {taken: false, time: '8:00 AM', trackingMethod: 'standard'},
    schedule: {intakeTime: '8:00 AM', timesPerDay: 1, reminderEnabled: false},
    inventory: {currentStock: 80, unit: 'Capsule(s)', lowStockAlert: false, lowStockThreshold: 10, enoughUntil: 'Sept. 30, 2026', totalStock: 100},
  },
};

function StockBar({current, total, color}: {current: number; total: number; color: string}) {
  const pct = Math.min((current / total) * 100, 100);
  return (
    <View className="h-2 bg-gray-100 rounded-full overflow-hidden mt-2 mb-1">
      <View style={{width: `${pct}%`, backgroundColor: color, height: '100%', borderRadius: 999}} />
    </View>
  );
}

export default function MedicineDetailScreen() {
  const navigation = useNavigation<Nav>();
  const {params} = useRoute<Route>();
  const med = MEDICINES[params.id];
  const [taken, setTaken] = useState(med.intake.taken);

  if (!med) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <Text className="text-gray-400">Medicine not found.</Text>
      </SafeAreaView>
    );
  }

  const stockColor = med.inventory.currentStock / med.inventory.totalStock > 0.2 ? '#14B8A6' : '#F97316';

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
            <View className="w-16 h-16 rounded-2xl items-center justify-center" style={{backgroundColor: med.iconBg}}>
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
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                  <TouchableOpacity
                    onPress={() => setTaken(t => !t)}
                    className="w-10 h-10 rounded-full items-center justify-center"
                    style={{backgroundColor: taken ? '#14B8A6' : '#F3F4F6'}}>
                    <Text className="text-white text-base font-bold">✓</Text>
                  </TouchableOpacity>
                  <View>
                    <Text className="text-gray-800 text-sm font-semibold">
                      {taken ? 'Taken' : 'Not yet taken'}
                    </Text>
                    <Text className="text-gray-400 text-xs mt-0.5">
                      {taken ? `Today at ${med.intake.time}` : `Scheduled at ${med.intake.time}`}
                    </Text>
                  </View>
                </View>
                <View className="items-end gap-1">
                  <Text className="text-gray-400 text-xs">Tracking method</Text>
                  {med.intake.trackingMethod === 'qr'
                    ? <QR width={22} height={22} color="#6366F1" />
                    : <Text className="text-gray-500 text-xs font-medium">Tap to Log</Text>}
                </View>
              </View>
            </View>
          </View>

          {/* Schedule & Reminder */}
          <View>
            <Text className="text-teal-500 text-sm font-bold mb-2">Schedule & Reminder</Text>
            <View className="bg-white rounded-2xl overflow-hidden">
              {/* Time of Intake */}
              <View className="flex-row items-center gap-3 px-4 py-4 border-b border-gray-100">
                <View className="w-9 h-9 rounded-xl bg-gray-100 items-center justify-center">
                  <Clock width={18} height={18} color="#6B7280" />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-500 text-xs">Time of Intake</Text>
                </View>
                <Text className="text-gray-800 text-sm font-semibold">{med.schedule.intakeTime}</Text>
              </View>

              {/* Times per day */}
              <View className="flex-row items-center gap-3 px-4 py-4 border-b border-gray-100">
                <View className="w-9 h-9 rounded-xl bg-gray-100 items-center justify-center">
                  <Pills width={18} height={18} color="#6B7280" />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-500 text-xs">How many times per day</Text>
                </View>
                <Text className="text-gray-800 text-sm font-semibold">
                  {med.schedule.timesPerDay} {med.schedule.timesPerDay === 1 ? 'time a day' : 'times a day'}
                </Text>
              </View>

              {/* Reminder */}
              <View className="flex-row items-center gap-3 px-4 py-4">
                <View className="w-9 h-9 rounded-xl bg-gray-100 items-center justify-center">
                  <Bell width={18} height={18} color="#6B7280" />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-500 text-xs">Medication Reminder</Text>
                  {med.schedule.reminderEnabled && (
                    <Text className="text-gray-400 text-xs mt-0.5">
                      You will be reminded every {med.schedule.intakeTime}
                    </Text>
                  )}
                </View>
                <Text
                  className="text-sm font-bold"
                  style={{color: med.schedule.reminderEnabled ? '#14B8A6' : '#9ca3af'}}>
                  {med.schedule.reminderEnabled ? 'ON' : 'OFF'}
                </Text>
              </View>
            </View>
          </View>

          {/* Inventory */}
          <View>
            <Text className="text-teal-500 text-sm font-bold mb-2">Inventory</Text>
            <View className="bg-white rounded-2xl overflow-hidden">
              {/* Current Stock */}
              <View className="px-4 pt-4 pb-3 border-b border-gray-100">
                <View className="flex-row items-center gap-3">
                  <View className="w-9 h-9 rounded-xl bg-gray-100 items-center justify-center">
                    <Stock width={18} height={18} color="#6B7280" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-gray-500 text-xs">Current Stock</Text>
                  </View>
                  <Text className="text-gray-800 text-sm font-semibold">
                    {med.inventory.currentStock} {med.inventory.unit}
                  </Text>
                </View>
                <StockBar current={med.inventory.currentStock} total={med.inventory.totalStock} color={stockColor} />
                <Text className="text-gray-400 text-xs">Enough until {med.inventory.enoughUntil}</Text>
              </View>

              {/* Low Stock Alert */}
              <View className="flex-row items-center gap-3 px-4 py-4 border-b border-gray-100">
                <View className="w-9 h-9 rounded-xl bg-gray-100 items-center justify-center">
                  <Bell width={18} height={18} color="#6B7280" />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-500 text-xs">Low-stock alert</Text>
                </View>
                <Text
                  className="text-sm font-bold"
                  style={{color: med.inventory.lowStockAlert ? '#14B8A6' : '#9ca3af'}}>
                  {med.inventory.lowStockAlert ? 'ON' : 'OFF'}
                </Text>
              </View>

              {/* Low Stock Threshold */}
              <View className="flex-row items-center gap-3 px-4 py-4">
                <View className="w-9 h-9 rounded-xl bg-gray-100 items-center justify-center">
                  <Stock width={18} height={18} color="#6B7280" />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-500 text-xs">Low-stock threshold</Text>
                </View>
                <Text className="text-gray-800 text-sm font-semibold">
                  {med.inventory.lowStockThreshold} {med.inventory.unit}
                </Text>
              </View>
            </View>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
