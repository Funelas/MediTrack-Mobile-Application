import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import Bell from "../assets/svg_icons/bell.svg"
import Arrow from "../assets/svg_icons/arrow.svg"
import Calendar from "../assets/svg_icons/calendar.svg"
import Pills from "../assets/svg_icons/pills.svg"
import Heart from "../assets/svg_icons/heart.svg"
import Clock from "../assets/svg_icons/clock.svg"
import Check from "../assets/svg_icons/check.svg"
import CircularProgress from '../components/CircularProgress';
const nextMedication = {
  name: 'Metformin 500g',
  time: '9:00 AM',
  minsLeft: 12,
};

const scheduleItems = [
  {id: '1', time: '9:00 AM', label: 'Metformin 500g', status: 'inprogress', icon: <Pills width={35} height={35} color="#787878"/>},
  {id: '2', time: '1:00 PM', label: 'Check Blood Pressure', status: 'inprogress', icon:<Bell width={35} height={35} color="#787878"/>},
  {id: '3', time: '3:00 PM', label: "Doctor's Appointment", status: 'inprogress', icon: <Calendar width={35} height={35} color="#787878"/>},
  {id: '4', time: '5:00 PM', label: 'Restock Medicine', status: 'inprogress', icon: <Bell width={35} height={35} color="#787878"/>},
  {id: '5', time: '9:00 PM', label: 'Atorvastatin 10mg', status: 'inprogress', icon: <Pills width={35} height={35} color="#787878"/>},
  {id: '6', time: '8:00 AM', label: 'Amlodipine 10mg', status: 'done', icon: <Pills width={35} height={35} color="#139880"/>}
];

const healthSummary = {
  status: 'Good',
  statusDetail: '8 of 10 results within normal range.',
  lastCheckup: 'June 6, 2026',
  improved: ['HbA1C', 'LDL Cholesterol'],
  needsAttention: ['SGPT (ALT)', 'SGOT (AST)'],
};

export default function HomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-gray-100">
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View className="bg-teal-500 px-5 pt-10 pb-8 rounded-b-3xl">
          <View className="flex-row justify-between items-center mb-4">
            <View className="flex-row items-center gap-2">
              <Heart width={60} height={60} color="#FFFFFF" />
              <Text className="text-white text-2xl font-bold">
                Medi<Text className="text-teal-200">Track</Text>
              </Text>
            </View>
            <View className='mr-2 rounded-full bg-[#BDCCDA] flex justify-center items-center p-1'>
                <Bell width={36} height={36} color="#26292C"/>
            </View>
          </View>
          <Text className="text-white text-2xl font-bold">Welcome back, User!</Text>
          <Text className="text-teal-100 text-sm mt-1">
            Today: {new Date().toLocaleDateString('en-US', {month: 'long', day: 'numeric', year: 'numeric'})}
          </Text>
        </View>

        <View className="px-4 mt-4 gap-4">

          {/* Next Medication Card */}
          <View className="bg-white rounded-2xl p-4 shadow-sm">
            <Text className="text-gray-800 font-semibold text-base mb-3">
              Next Medication:
            </Text>
            <View className="flex-row items-center gap-3">
              {/* Medicine icon placeholder */}
              <View className="w-12 h-12 bg-teal-100 rounded-xl flex justify-center items-center">
                <Pills width={30} height={30} color="#0D9488" />
              </View>
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className="text-gray-800 font-semibold">{nextMedication.name}</Text>
                  <Text className="text-gray-400 text-sm">· {nextMedication.time}</Text>
                </View>
                <View className="flex-row items-center mt-1 gap-1">
                 
                  <Clock width={18} height={18} color="#F15C5C"/>
                  <Text className="text-orange-500 text-sm font-medium">
                    {nextMedication.minsLeft} mins
                  </Text>
                </View>
              </View>
              <TouchableOpacity className="bg-teal-500 px-4 py-2 rounded-xl">
                <Text className="text-white text-sm font-semibold">Log Intake</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Today's Schedule */}
          <View className="bg-white rounded-2xl p-4 shadow-sm">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-gray-800 font-semibold text-base">
                Today's Schedule{' '}
                <Text className="text-gray-400 font-normal text-sm">(1/6 taken)</Text>
              </Text>
              <TouchableOpacity>
                <Text className="text-teal-500 text-sm font-medium">View All</Text>
              </TouchableOpacity>
            </View>

            {scheduleItems.map((item, index) => (
              <View key={item.id} className={`border rounded-xl border-1 my-1 p-1 ${item.status === 'done' ? 'border-[#C2DDD8] bg-[#DBE7E5]' : 'border-gray-200 bg-white'}`}>
                <View className="flex-row items-center py-3 gap-3">
                  <View className={`w-8 h-8 border border-1  rounded-full  flex justify-center items-center ${item.status === 'done' ? 'border-[#139880] bg-[#C2DDD8]' : 'border-[#787878] bg-transparent'}`}>
                    {item.status === 'done' ? <Check width={25} height={25} color='#139880'/> : ''}
                  </View>

                  {item.icon}
                  
                  <Text className="text-gray-400 text-sm w-16">{item.time}</Text>
                  <Text className="flex-1 text-gray-800 text-sm font-medium">
                    {item.label}
                  </Text>
                  {/* Arrow placeholder */}
                  <View style={{transform: [{rotate: '270deg'}]}}>
                    <Arrow width={20} height={20} />
                  </View>
                </View>
                {index < scheduleItems.length - 1 && (
                  <View className="h-px bg-gray-100" />
                )}
              </View>
            ))}
          </View>

          {/* Health Summary Card */}
          <View className="bg-white rounded-2xl p-4 shadow-sm mb-4">
            <View className="flex-row gap-3">
              {/* Left - Status */}
              <View className="flex-1 bg-teal-50 rounded-xl p-3 items-center justify-center">
                {/* Heart icon placeholder */}
                <CircularProgress progress={80} size={80} strokeWidth={8}>
                  <Heart width={36} height={36} color="#14B8A6" />
                </CircularProgress>
                <Text className="text-teal-600 font-bold text-lg">
                  {healthSummary.status}
                </Text>
                <Text className="text-gray-500 text-xs text-center mt-1">
                  {healthSummary.statusDetail}
                </Text>
                <View className="flex-row items-center mt-2 gap-1">
                  {/* Calendar icon placeholder */}
                  <View className="w-3 h-3 bg-gray-300 rounded" />
                  <Text className="text-gray-400 text-xs">
                    Latest checkup {healthSummary.lastCheckup}
                  </Text>
                </View>
              </View>

              {/* Right - Improved / Needs Attention */}
              <View className="flex-1 gap-3">
                <View className="bg-teal-50 rounded-xl p-3">
                  <Text className="text-teal-600 font-semibold text-xs mb-1">
                    Improved:
                  </Text>
                  {healthSummary.improved.map(item => (
                    <Text key={item} className="text-gray-600 text-xs">• {item}</Text>
                  ))}
                </View>
                <View className="bg-red-50 rounded-xl p-3">
                  <Text className="text-red-500 font-semibold text-xs mb-1">
                    Needs Attention:
                  </Text>
                  {healthSummary.needsAttention.map(item => (
                    <Text key={item} className="text-gray-600 text-xs">• {item}</Text>
                  ))}
                </View>
              </View>
            </View>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
