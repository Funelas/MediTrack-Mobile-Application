import React, {useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import FloatingAddButton from '../components/FloatingAddButton';
import Plus from '../assets/svg_icons/plus.svg';
import Bell from "../assets/svg_icons/bell.svg"
import Calendar from "../assets/svg_icons/calendar.svg"
import Pills from "../assets/svg_icons/pills.svg"
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const appointmentDays = new Set([8, 12, 13, 15, 22]);

const scheduleItems = [
  {id: '1', time: '8:00 AM', title: 'Amlodipine 5mg', subtitle: '1 tablet', color: '#14B8A6', type: 'med'},
  {id: '2', time: '1:00 PM', title: 'Check Blood Pressure', subtitle: 'Task', color: '#F97316', type: 'task'},
  {id: '3', time: '3:00 PM', title: "Doctor's Appointment", subtitle: 'Dr. Maria Gaston · Cardiology Clinics', color: 'bg-teal-400', type: 'appointment'},
  {id: '4', time: '5:00 PM', title: 'Restock Medicine', subtitle: 'Task', color: '#F97316', type: 'task'},
  {id: '5', time: '9:00 PM', title: 'Atorvastatin 10mg', subtitle: '1 tablet', color: '#14B8A6', type: 'med'},
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function ScheduleScreen() {
  const today = new Date();
  const [activeTab, setActiveTab] = useState<'Month' | 'Week'>('Month');
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [checked, setChecked] = useState<string[]>([]);

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const calendarCells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({length: daysInMonth}, (_, i) => i + 1),
  ];

  const toggleCheck = (id: string) => {
    setChecked(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id],
    );
  };

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(y => y - 1);
    } else {
      setCurrentMonth(m => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(y => y + 1);
    } else {
      setCurrentMonth(m => m + 1);
    }
  };

  const todayLabel = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const cardIcon = (cardType : string) => {
    switch (cardType) {
      case 'med': return <Pills width={25} height={25} color="#139880" />;
      case 'task': return <Bell width={25} height={25} color="#E2EA00" />;
      case 'appointment': return <Calendar width={25} height={25} color="#F15C5C" />;
      default: return <Plus width={25} height={25} color="#FFFFFC" />;

    }
  }
  return (
    <SafeAreaView className="flex-1 bg-gray-100" style={{position: 'relative'}}>
      {/* Header */}
      <View className="bg-teal-500 px-5 pt-10 pb-8 rounded-b-3xl">
        <Text className="text-white text-2xl font-bold">Schedule</Text>
        <Text className="text-teal-100 text-sm mt-1">
          Manage your medications, appointments and health tasks.
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="px-4 mt-4">

          {/* Month / Week Toggle + Filters */}
          <View className="flex-row justify-between items-center mb-4">
            <View className="flex-row bg-white rounded-xl p-1">
              {(['Month', 'Week'] as const).map(tab => (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  className={`px-5 py-2 rounded-lg ${activeTab === tab ? 'bg-teal-500' : ''}`}>
                  <Text className={`text-sm font-medium ${activeTab === tab ? 'text-white' : 'text-gray-500'}`}>
                    {tab}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity className="flex-row items-center gap-2 bg-white px-4 py-2 rounded-xl">
              {/* Filter icon placeholder */}
              <View className="w-4 h-4 bg-gray-300 rounded" />
              <Text className="text-gray-600 text-sm font-medium">Filters</Text>
            </TouchableOpacity>
          </View>

          {/* Calendar */}
          <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
            {/* Month Navigation */}
            <View className="flex-row justify-between items-center mb-3">
              <TouchableOpacity onPress={prevMonth} className="p-1">
                <Text className="text-gray-500 text-lg">‹</Text>
              </TouchableOpacity>
              <Text className="text-gray-800 font-semibold">
                {MONTH_NAMES[currentMonth]} {currentYear}
              </Text>
              <TouchableOpacity onPress={nextMonth} className="p-1">
                <Text className="text-gray-500 text-lg">›</Text>
              </TouchableOpacity>
            </View>

            {/* Day Headers */}
            <View className="flex-row mb-2">
              {DAYS.map(day => (
                <View key={day} className="flex-1 items-center">
                  <Text className="text-gray-400 text-xs">{day}</Text>
                </View>
              ))}
            </View>

            {/* Calendar Grid */}
            <View className="flex-row flex-wrap">
              {calendarCells.map((day, index) => {
                const isToday =
                  day === today.getDate() &&
                  currentMonth === today.getMonth() &&
                  currentYear === today.getFullYear();
                const isSelected = day === selectedDay;

                const hasAppointment = day ? appointmentDays.has(day) : false;

                return (
                  <View key={index} className="w-[14.28%] items-center mb-1">
                    {day ? (
                      <TouchableOpacity
                        onPress={() => setSelectedDay(day)}
                        className="items-center">
                        <View className={`w-8 h-8 items-center justify-center rounded-full ${
                          isSelected ? 'bg-teal-500' : isToday ? 'border border-teal-500' : ''
                        }`}>
                          <Text
                            className={`text-sm ${
                              isSelected ? 'text-white font-bold' : isToday ? 'text-teal-500 font-bold' : 'text-gray-700'
                            }`}>
                            {day}
                          </Text>
                        </View>
                        {hasAppointment && (
                          <View className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                            isSelected ? 'bg-white' : 'bg-teal-400'
                          }`} />
                        )}
                      </TouchableOpacity>
                    ) : (
                      <View className="w-8 h-8" />
                    )}
                  </View>
                );
              })}
            </View>

            {/* Appointment indicator */}
            <View className="flex-row justify-center mt-2 gap-1 items-center">
              <View className="w-2 h-2 rounded-full bg-teal-400" />
              <Text className="text-gray-400 text-xs">Appointment</Text>
            </View>
          </View>

          {/* Today Label */}
          <View className="flex-row items-center gap-2 mb-3">
            <Text className="text-gray-800 font-semibold">Today</Text>
            <Text className="text-gray-400 text-sm">· {todayLabel}</Text>
          </View>

          {/* Schedule List */}
          <View className="bg-white rounded-2xl shadow-sm mb-6 overflow-hidden">
            {scheduleItems.map((item, index) => (
              <View key={item.id}>
                <View className="flex-row items-center px-4 py-3 gap-3">
                  {/* Colored left border indicator */}
                  {<View
                    className={`w-1 h-10 rounded-full ${item.type === 'appointment' ? item.color : 'bg-transparent'}`}
                  />}
                  <Text className="text-gray-400 text-xs w-16">{item.time}</Text>
                  <View className= 'flex justify-center items-center rounded-full'>
                    {cardIcon(item.type)}
                  </View>
                  <View className="flex-1">
                    <Text className="text-gray-800 text-sm font-medium">{item.title}</Text>
                    <Text className="text-gray-400 text-xs mt-0.5">{item.subtitle}</Text>
                  </View>
                  {/* Checkbox */}
                  <TouchableOpacity
                    onPress={() => toggleCheck(item.id)}
                    className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                      checked.includes(item.id) ? 'bg-teal-500 border-teal-500' : 'border-gray-300'
                    }`}>
                    {checked.includes(item.id) && (
                      <Text className="text-white text-xs font-bold">✓</Text>
                    )}
                  </TouchableOpacity>
                </View>
                {index < scheduleItems.length - 1 && (
                  <View className="h-px bg-gray-100 ml-4" />
                )}
              </View>
            ))}
          </View>

        </View>
      </ScrollView>

      <FloatingAddButton onPress={() => {}} />
    </SafeAreaView>
  );
}
