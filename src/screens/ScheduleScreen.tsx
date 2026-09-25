import React, {useState, useCallback, useRef} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {useFocusEffect} from '@react-navigation/native';
import FloatingAddButton from '../components/FloatingAddButton';
import ScheduleSkeleton from '../components/ScheduleSkeleton';
import AddToScheduleModal from '../components/AddToScheduleModal';
import Plus from '../assets/svg_icons/plus.svg';
import Bell from '../assets/svg_icons/bell.svg';
import Calendar from '../assets/svg_icons/calendar.svg';
import Pills from '../assets/svg_icons/pills.svg';
import Filter from '../assets/svg_icons/filter.svg';
import {getSchedules} from '../database/services';
import Schedule from '../database/models/Schedule';
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

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
  const navigation = useNavigation<any>();
  const [activeTab, setActiveTab] = useState<'Month' | 'Week'>('Month');
  const [displayedTab, setDisplayedTab] = useState<'Month' | 'Week'>('Month');
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [checked, setChecked] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPriorDays, setShowPriorDays] = useState(false);
  const [allSchedules, setAllSchedules] = useState<Schedule[]>([]);
  const scrollRef = useRef<ScrollView>(null);
  const dayOffsets = useRef<Record<string, number>>({});

  useFocusEffect(
    useCallback(() => {
      getSchedules().then(setAllSchedules);
    }, [])
  );

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const schedulesForDay = (d: Date) =>
    allSchedules
      .filter(s => isSameDay(new Date(s.date), d))
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  const daysWithSchedules = new Set(
    allSchedules
      .filter(s => {
        const d = new Date(s.date);
        return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
      })
      .map(s => new Date(s.date).getDate())
  );
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

  const weekDaySchedule = weekDates.map(date => ({date, items: schedulesForDay(date)}));
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
      case 'reminder': return <Bell width={25} height={25} color="#E2EA00" />;
      case 'appointment': return <Calendar width={25} height={25} color="#F15C5C" />;
      default: return <Plus width={25} height={25} color="#FFFFFC" />;
    }
  };

  const ScheduleItem = ({item, id, showDivider}: {item: Schedule; id: string; showDivider: boolean}) => (
    <View>
      <TouchableOpacity
        onPress={() => navigation.navigate('ScheduleDetail', {id: item.id, type: item.type as any})}
        className="flex-row items-center px-4 py-3 gap-3">
        <View className={`w-1 h-10 rounded-full ${item.type === 'appointment' ? 'bg-blue-400' : 'bg-transparent'}`} />
        <Text className="text-gray-400 text-xs w-16">
          {new Date(item.time).toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit', hour12: true})}
        </Text>
        <View className="flex justify-center items-center rounded-full">{cardIcon(item.type)}</View>
        <View className="flex-1">
          <Text className="text-gray-800 text-sm font-medium">{item.title}</Text>
          <Text className="text-gray-400 text-xs mt-0.5">{item.type === 'appointment' ? item.doctorClinic || 'Appointment' : 'Reminder'}</Text>
        </View>
        <TouchableOpacity
          onPress={() => toggleCheck(id)}
          className={`w-6 h-6 rounded-full border-2 items-center justify-center ${checked.includes(id) ? 'bg-teal-500 border-teal-500' : 'border-gray-300'}`}>
          {checked.includes(id) && <Text className="text-white text-xs font-bold">✓</Text>}
        </TouchableOpacity>
      </TouchableOpacity>
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

      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}>
        <View className="px-4 mt-4">

          {/* Month / Week Toggle + Filters */}
          <View className="flex-row justify-between items-center mb-4 gap-3">
            <View className="flex-row bg-white rounded-xl p-1">
              {(['Month', 'Week'] as const).map(tab => (
                <TouchableOpacity
                  key={tab}
                  onPress={() => switchTab(tab)}
                  className={`px-4 py-2 rounded-lg ${displayedTab === tab ? 'bg-teal-500' : ''}`}>
                  <Text className={`text-sm font-medium ${displayedTab === tab ? 'text-white' : 'text-gray-500'}`}>
                    {tab}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity className="flex-row items-center gap-1.5 bg-white py-2 px-3 rounded-xl">
              <Filter width={18} height={18} color='#4B5563'/>
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
                        const hasAppointment = day ? daysWithSchedules.has(day) : false;
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
                        const hasAppt = allSchedules.some(s => isSameDay(new Date(s.date), date));
                        return (
                          <View key={i} className="flex-1 items-center">
                            <TouchableOpacity
                              onPress={() => {
                              setSelectedDay(date.getDate());
                              setCurrentMonth(date.getMonth());
                              setCurrentYear(date.getFullYear());
                              const key = date.toDateString();
                              const offset = dayOffsets.current[key];
                              if (offset !== undefined) {
                                scrollRef.current?.scrollTo({y: offset, animated: true});
                              }
                            }}
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
                  {(() => {
                    const selected = new Date(currentYear, currentMonth, selectedDay);
                    const items = schedulesForDay(selected);
                    const label = isSameDay(selected, today) ? 'Today' : selected.toLocaleDateString('en-US', {weekday: 'long'});
                    const dateLabel = selected.toLocaleDateString('en-US', {month: 'long', day: 'numeric', year: 'numeric'});
                    return (
                      <>
                        <View className="flex-row items-center gap-2 mb-3">
                          <Text className="text-gray-800 font-semibold">{label}</Text>
                          <Text className="text-gray-400 text-sm">· {dateLabel}</Text>
                        </View>
                        <View className="bg-white rounded-2xl shadow-sm mb-6 overflow-hidden">
                          {items.length === 0
                            ? <Text className="text-gray-400 text-sm text-center py-6">No schedules for this day.</Text>
                            : items.map((item, index) => (
                                <ScheduleItem key={item.id} item={item} id={item.id} showDivider={index < items.length - 1} />
                              ))
                          }
                        </View>
                      </>
                    );
                  })()}
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
                    const key = date.toDateString();
                    return (
                      <View key={key} className="mb-4"
                        onLayout={e => { dayOffsets.current[key] = e.nativeEvent.layout.y; }}>
                        <View className="flex-row items-center gap-2 mb-2">
                          <Text className="text-gray-800 font-semibold">{dayLabel}</Text>
                          <Text className="text-gray-400 text-sm">· {dateLabel}</Text>
                        </View>
                        <View className="bg-white rounded-2xl shadow-sm overflow-hidden">
                          {items.length === 0
                            ? <Text className="text-gray-400 text-sm text-center py-6">No schedules for this day.</Text>
                            : items.map((item, index) => (
                                <ScheduleItem
                                  key={item.id}
                                  item={item}
                                  id={`${date.toDateString()}-${item.id}`}
                                  showDivider={index < items.length - 1}
                                />
                              ))
                          }
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

      <FloatingAddButton onPress={() => setShowAddModal(true)} />

      <AddToScheduleModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
      />
    </SafeAreaView>
  );
}
