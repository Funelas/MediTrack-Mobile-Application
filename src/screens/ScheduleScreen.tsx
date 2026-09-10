import React, {useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import FloatingAddButton from '../components/FloatingAddButton';
import ScheduleSkeleton from '../components/ScheduleSkeleton';
import Plus from '../assets/svg_icons/plus.svg';
import Bell from '../assets/svg_icons/bell.svg';
import Calendar from '../assets/svg_icons/calendar.svg';
import Pills from '../assets/svg_icons/pills.svg';
import Filter from '../assets/svg_icons/filter.svg';
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const appointmentDays = new Set([8, 12, 13, 15, 22]);

const scheduleItems = [
  {id: '1', time: '8:00 AM', title: 'Amlodipine 5mg', subtitle: '1 tablet', color: '#14B8A6', type: 'med'},
  {id: '2', time: '1:00 PM', title: 'Check Blood Pressure', subtitle: 'Task', color: '#F97316', type: 'task'},
  {id: '3', time: '3:00 PM', title: "Doctor's Appointment", subtitle: 'Dr. Maria Gaston · Cardiology Clinics', color: '#3B82F6', type: 'appointment'},
  {id: '4', time: '5:00 PM', title: 'Restock Medicine', subtitle: 'Task', color: '#F97316', type: 'task'},
  {id: '5', time: '9:00 PM', title: 'Atorvastatin 10mg', subtitle: '1 tablet', color: '#14B8A6', type: 'med'},
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function getWeekDates(date: Date): Date[] {
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  return Array.from({length: 7}, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export default function ScheduleScreen() {
  const today = new Date();
  const [activeTab, setActiveTab] = useState<'Month' | 'Week'>('Month');
  const [displayedTab, setDisplayedTab] = useState<'Month' | 'Week'>('Month');
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [checked, setChecked] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPriorDays, setShowPriorDays] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    return d;
  });

  const weekDates = getWeekDates(currentWeekStart);
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  const calendarCells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({length: daysInMonth}, (_, i) => i + 1),
  ];

  const weekDaySchedule = weekDates.map(date => ({date, items: scheduleItems}));
  const visibleWeekDays = showPriorDays
    ? weekDaySchedule
    : weekDaySchedule.filter(({date}) => {
        const d = new Date(date); d.setHours(0,0,0,0);
        const t = new Date(today); t.setHours(0,0,0,0);
        return d >= t;
      });

  const switchTab = (tab: 'Month' | 'Week') => {
    if (tab === activeTab) return;
    setDisplayedTab(tab);
    setIsLoading(true);
    setTimeout(() => { setActiveTab(tab); setIsLoading(false); }, 600);
  };

  const toggleCheck = (id: string) => {
    setChecked(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  };

  const prevWeek = () => {
    const d = new Date(currentWeekStart); d.setDate(d.getDate() - 7); setCurrentWeekStart(d);
  };

  const nextWeek = () => {
    const d = new Date(currentWeekStart); d.setDate(d.getDate() + 7); setCurrentWeekStart(d);
  };

  const todayLabel = today.toLocaleDateString('en-US', {weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'});

  const cardIcon = (type: string) => {
    switch (type) {
      case 'med': return <Pills width={25} height={25} color="#139880" />;
      case 'task': return <Bell width={25} height={25} color="#E2EA00" />;
      case 'appointment': return <Calendar width={25} height={25} color="#F15C5C" />;
      default: return <Plus width={25} height={25} color="#FFFFFC" />;
    }
  };

  const ScheduleItem = ({item, id, showDivider}: {item: typeof scheduleItems[0]; id: string; showDivider: boolean}) => (
    <View>
      <View className="flex-row items-center px-4 py-3 gap-3">
        <View className={`w-1 h-10 rounded-full ${item.type === 'appointment' ? '' : 'bg-transparent'}`}
          style={item.type === 'appointment' ? {backgroundColor: item.color} : undefined} />
        <Text className="text-gray-400 text-xs w-16">{item.time}</Text>
        <View className="flex justify-center items-center rounded-full">{cardIcon(item.type)}</View>
        <View className="flex-1">
          <Text className="text-gray-800 text-sm font-medium">{item.title}</Text>
          <Text className="text-gray-400 text-xs mt-0.5">{item.subtitle}</Text>
        </View>
        <TouchableOpacity
          onPress={() => toggleCheck(id)}
          className={`w-6 h-6 rounded-full border-2 items-center justify-center ${checked.includes(id) ? 'bg-teal-500 border-teal-500' : 'border-gray-300'}`}>
          {checked.includes(id) && <Text className="text-white text-xs font-bold">✓</Text>}
        </TouchableOpacity>
      </View>
      {showDivider && <View className="h-px bg-gray-100 ml-4" />}
    </View>
  );

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
                  onPress={() => switchTab(tab)}
                  className={`px-5 py-2 rounded-lg ${displayedTab === tab ? 'bg-teal-500' : ''}`}>
                  <Text className={`text-sm font-medium ${displayedTab === tab ? 'text-white' : 'text-gray-500'}`}>
                    {tab}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity className="flex-row items-center justify-around bg-white py-2 px-4 w-[18%] rounded-xl">
              <Filter width={25} height={25} color='text-gray-600'/>
              <Text className="text-gray-600 text-sm font-medium">Filters</Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <ScheduleSkeleton tab={displayedTab} />
          ) : (
            <>
              {/* Calendar */}
              <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
                {activeTab === 'Month' ? (
                  <>
                    <View className="flex-row justify-between items-center mb-3">
                      <TouchableOpacity onPress={prevMonth} className="p-1">
                        <Text className="text-gray-500 text-lg">‹</Text>
                      </TouchableOpacity>
                      <Text className="text-gray-800 font-semibold">{MONTH_NAMES[currentMonth]} {currentYear}</Text>
                      <TouchableOpacity onPress={nextMonth} className="p-1">
                        <Text className="text-gray-500 text-lg">›</Text>
                      </TouchableOpacity>
                    </View>
                    <View className="flex-row mb-2">
                      {DAYS.map(day => (
                        <View key={day} className="flex-1 items-center">
                          <Text className="text-gray-400 text-xs">{day}</Text>
                        </View>
                      ))}
                    </View>
                    <View className="flex-row flex-wrap">
                      {calendarCells.map((day, index) => {
                        const isToday = day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
                        const isSelected = day === selectedDay;
                        const hasAppointment = day ? appointmentDays.has(day) : false;
                        return (
                          <View key={index} className="w-[14.28%] items-center mb-1">
                            {day ? (
                              <TouchableOpacity onPress={() => setSelectedDay(day)} className="items-center">
                                <View className={`w-8 h-8 items-center justify-center rounded-full ${isSelected ? 'bg-teal-500' : isToday ? 'border border-teal-500' : ''}`}>
                                  <Text className={`text-sm ${isSelected ? 'text-white font-bold' : isToday ? 'text-teal-500 font-bold' : 'text-gray-700'}`}>{day}</Text>
                                </View>
                                {hasAppointment && <View className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isSelected ? 'bg-white' : 'bg-teal-400'}`} />}
                              </TouchableOpacity>
                            ) : <View className="w-8 h-8" />}
                          </View>
                        );
                      })}
                    </View>
                  </>
                ) : (
                  <>
                    <View className="flex-row justify-between items-center mb-3">
                      <TouchableOpacity onPress={prevWeek} className="p-1">
                        <Text className="text-gray-500 text-lg">‹</Text>
                      </TouchableOpacity>
                      <Text className="text-gray-800 font-semibold">{MONTH_NAMES[currentWeekStart.getMonth()]} {currentWeekStart.getFullYear()}</Text>
                      <TouchableOpacity onPress={nextWeek} className="p-1">
                        <Text className="text-gray-500 text-lg">›</Text>
                      </TouchableOpacity>
                    </View>
                    <View className="flex-row mb-2">
                      {DAYS.map(day => (
                        <View key={day} className="flex-1 items-center">
                          <Text className="text-gray-400 text-xs">{day}</Text>
                        </View>
                      ))}
                    </View>
                    <View className="flex-row">
                      {weekDates.map((date, i) => {
                        const isToday = date.toDateString() === today.toDateString();
                        const isSelected = date.toDateString() === new Date(currentYear, currentMonth, selectedDay).toDateString();
                        const hasAppt = appointmentDays.has(date.getDate());
                        return (
                          <View key={i} className="flex-1 items-center">
                            <TouchableOpacity
                              onPress={() => { setSelectedDay(date.getDate()); setCurrentMonth(date.getMonth()); setCurrentYear(date.getFullYear()); }}
                              className="items-center">
                              <View className={`w-8 h-8 items-center justify-center rounded-full ${isSelected ? 'bg-teal-500' : isToday ? 'border border-teal-500' : ''}`}>
                                <Text className={`text-sm ${isSelected ? 'text-white font-bold' : isToday ? 'text-teal-500 font-bold' : 'text-gray-700'}`}>{date.getDate()}</Text>
                              </View>
                              {hasAppt && <View className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isSelected ? 'bg-white' : 'bg-teal-400'}`} />}
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                  </>
                )}
                <View className="flex-row justify-center mt-3 gap-1 items-center">
                  <View className="w-2 h-2 rounded-full bg-teal-400" />
                  <Text className="text-gray-400 text-xs">Appointment</Text>
                </View>
              </View>

              {/* Schedule List */}
              {activeTab === 'Month' ? (
                <>
                  <View className="flex-row items-center gap-2 mb-3">
                    <Text className="text-gray-800 font-semibold">Today</Text>
                    <Text className="text-gray-400 text-sm">· {todayLabel}</Text>
                  </View>
                  <View className="bg-white rounded-2xl shadow-sm mb-6 overflow-hidden">
                    {scheduleItems.map((item, index) => (
                      <ScheduleItem key={item.id} item={item} id={item.id} showDivider={index < scheduleItems.length - 1} />
                    ))}
                  </View>
                </>
              ) : (
                <>
                  <TouchableOpacity onPress={() => setShowPriorDays(p => !p)} className="flex-row items-center gap-2 mb-3">
                    <View className={`w-4 h-4 rounded border-2 items-center justify-center ${showPriorDays ? 'bg-teal-500 border-teal-500' : 'border-gray-300'}`}>
                      {showPriorDays && <Text className="text-white text-xs font-bold">✓</Text>}
                    </View>
                    <Text className="text-gray-600 text-sm">Unhide Prior Days</Text>
                  </TouchableOpacity>
                  {visibleWeekDays.map(({date, items}) => {
                    const isToday = date.toDateString() === today.toDateString();
                    const dayLabel = isToday ? 'Today' : date.toLocaleDateString('en-US', {weekday: 'long'});
                    const dateLabel = date.toLocaleDateString('en-US', {month: 'long', day: 'numeric', year: 'numeric'});
                    return (
                      <View key={date.toDateString()} className="mb-4">
                        <View className="flex-row items-center gap-2 mb-2">
                          <Text className="text-gray-800 font-semibold">{dayLabel}</Text>
                          <Text className="text-gray-400 text-sm">· {dateLabel}</Text>
                        </View>
                        <View className="bg-white rounded-2xl shadow-sm overflow-hidden">
                          {items.map((item, index) => (
                            <ScheduleItem
                              key={item.id}
                              item={item}
                              id={`${date.toDateString()}-${item.id}`}
                              showDivider={index < items.length - 1}
                            />
                          ))}
                        </View>
                      </View>
                    );
                  })}
                </>
              )}
            </>
          )}

        </View>
      </ScrollView>

      <FloatingAddButton onPress={() => {}} />
    </SafeAreaView>
  );
}
