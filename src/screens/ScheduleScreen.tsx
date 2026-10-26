import React, {useState, useCallback, useEffect, useRef} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import FloatingAddButton from '../components/FloatingAddButton';
import ScheduleSkeleton from '../components/ScheduleSkeleton';
import AddToScheduleModal from '../components/AddToScheduleModal';
import Plus from '../assets/svg_icons/plus.svg';
import Bell from '../assets/svg_icons/bell.svg';
import Calendar from '../assets/svg_icons/calendar.svg';
import Pills from '../assets/svg_icons/pills.svg';
import Filter from '../assets/svg_icons/filter.svg';
import {getItemsForDateRange, upsertOccurrence, VirtualItem} from '../database/services';
import {markMedicineTaken} from '../database/services';
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ─── helpers ─────────────────────────────────────────────────────────────────

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

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function midnight(d: Date): Date {
  const m = new Date(d);
  m.setHours(0, 0, 0, 0);
  return m;
}

/** "HH:MM" → "9:00 AM" */
function formatTimeStr(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toLocaleTimeString('en-US', {hour: 'numeric', minute: '2-digit', hour12: true});
}

/**
 * Format the week header range.
 * Same month:       "Sep 27 – Oct 3, 2026"
 * Cross-year edge:  "Dec 28, 2025 – Jan 3, 2026"
 */
function formatWeekRange(weekStart: Date): string {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const sameYear = weekStart.getFullYear() === weekEnd.getFullYear();

  const startStr = weekStart.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : {year: 'numeric'}),
  });
  const endStr = weekEnd.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${startStr} – ${endStr}`;
}

function rruleToLabel(rrule: string): string {
  if (!rrule) return '—';
  const parts: Record<string, string> = {};
  rrule.split(';').forEach(seg => {
    const [k, v] = seg.split('=');
    if (k && v !== undefined) parts[k.trim()] = v.trim();
  });
  const freq = parts['FREQ'] ?? '';
  const interval = parts['INTERVAL'] ? parseInt(parts['INTERVAL']) : 1;
  if (parts['COUNT'] === '1') return 'Does not repeat';
  const BYDAY_MAP: Record<string, string> = {
    SU: 'Sun', MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat',
  };
  const NUM_TO_WEEK: Record<string, string> = {
    '1': '1st', '2': '2nd', '3': '3rd', '4': '4th', '-1': 'Last',
  };
  let base = '';
  if (freq === 'DAILY') {
    base = interval === 1 ? 'Every Day' : `Every ${interval} Days`;
  } else if (freq === 'WEEKLY') {
    if (parts['BYDAY']) {
      const match = parts['BYDAY'].match(/^(-?\d+)([A-Z]{2})$/);
      if (match) {
        base = `Every ${NUM_TO_WEEK[match[1]] ?? ''} ${BYDAY_MAP[match[2]] ?? ''}`;
        if (interval > 1) base += ` (every ${interval} months)`;
      } else {
        const days = parts['BYDAY'].split(',').map(d => BYDAY_MAP[d.trim()] ?? d).join(', ');
        base = interval === 1 ? `Every Week on ${days}` : `Every ${interval} Weeks on ${days}`;
      }
    } else {
      base = interval === 1 ? 'Every Week' : `Every ${interval} Weeks`;
    }
  } else if (freq === 'MONTHLY') {
    if (parts['BYMONTHDAY']) {
      base = interval === 1
        ? `Every Month on day ${parts['BYMONTHDAY']}`
        : `Every ${interval} Months on day ${parts['BYMONTHDAY']}`;
    } else {
      base = interval === 1 ? 'Every Month' : `Every ${interval} Months`;
    }
  } else {
    base = rrule;
  }
  if (parts['UNTIL']) {
    const y = parseInt(parts['UNTIL'].slice(0, 4));
    const mo = parseInt(parts['UNTIL'].slice(4, 6)) - 1;
    const dy = parseInt(parts['UNTIL'].slice(6, 8));
    base += ` until ${new Date(y, mo, dy).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}`;
  } else if (parts['COUNT'] && parts['COUNT'] !== '1') {
    base += ` · ${parts['COUNT']} times`;
  }
  return base;
}

// ─── ScheduleScreen ───────────────────────────────────────────────────────────

export default function ScheduleScreen() {
  const today = new Date();
  const navigation = useNavigation<any>();

  const [activeTab, setActiveTab] = useState<'Month' | 'Week'>('Month');
  const [displayedTab, setDisplayedTab] = useState<'Month' | 'Week'>('Month');
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [isLoading, setIsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPriorDays, setShowPriorDays] = useState(false);

  const [allItems, setAllItems] = useState<VirtualItem[]>([]);

  const scrollRef = useRef<ScrollView>(null);
  const dayOffsets = useRef<Record<string, number>>({});

  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    return d;
  });

  const loadItems = useCallback(() => {
    const rangeStart = new Date(currentYear, currentMonth - 1, 1);
    const rangeEnd = new Date(currentYear, currentMonth + 2, 0);
    getItemsForDateRange(rangeStart, rangeEnd).then(setAllItems);
  }, [currentYear, currentMonth]);

  // Reload data whenever this screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadItems);
    return unsubscribe;
  }, [navigation, loadItems]);
  // ── derived data ──

  const itemsForDay = (d: Date): VirtualItem[] =>
    allItems.filter(item => isSameDay(item.date, d));

  // dot = appointments only
  const daysWithAppointments = new Set(
    allItems
      .filter(item =>
        item.type === 'appointment' &&
        item.date.getFullYear() === currentYear &&
        item.date.getMonth() === currentMonth,
      )
      .map(item => item.date.getDate()),
  );

  const weekDates = getWeekDates(currentWeekStart);
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  const calendarCells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({length: daysInMonth}, (_, i) => i + 1),
  ];

  const weekDayItems = weekDates.map(date => ({date, items: itemsForDay(date)}));
  const visibleWeekDays = showPriorDays
    ? weekDayItems
    : weekDayItems.filter(({date}) => midnight(date) >= midnight(today));

  // ── actions ──

  const switchTab = (tab: 'Month' | 'Week') => {
    if (tab === activeTab) return;
    setDisplayedTab(tab);
    setIsLoading(true);
    setTimeout(() => { setActiveTab(tab); setIsLoading(false); }, 600);
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

  const handleToggleDone = async (item: VirtualItem) => {
  if (item.referenceType === 'med') {
    await markMedicineTaken(item.referenceId, item.date, item.time, !item.isDone);
  } else {
    await upsertOccurrence(item.referenceId, item.referenceType, item.date, item.time, {isDone: !item.isDone});
  }
  loadItems();
};

  // ── overdue check (today only) ──
  function isItemOverdue(item: VirtualItem): boolean {
    if (item.isDone) return false;
    if (!isSameDay(item.date, today)) return false;
    const [h, m] = item.time.split(':').map(Number);
    const target = new Date();
    target.setHours(h, m, 0, 0);
    return target.getTime() < Date.now();
  }

  // ── icons ──
  const cardIcon = (type: string, isDone: boolean) => {
    const done = '#139880';
    switch (type) {
      case 'med':         return <Pills    width={25} height={25} color={isDone ? done : '#14B8A6'} />;
      case 'reminder':    return <Bell     width={25} height={25} color={isDone ? done : '#E2EA00'} />;
      case 'appointment': return <Calendar width={25} height={25} color={isDone ? done : '#F15C5C'} />;
      default:            return <Plus     width={25} height={25} color="#FFFFFC" />;
    }
  };

  const subLabel = (item: VirtualItem) => {
    if (item.type === 'appointment') return item.doctorClinic || 'Appointment';
    if (item.type === 'med') return item.notes ?? 'Medication';
    return 'Reminder';
  };

  // ── ScheduleItem row ──
  const ScheduleItem = ({
    item, rowKey, showDivider,
  }: {item: VirtualItem; rowKey: string; showDivider: boolean}) => {
    const overdue = isItemOverdue(item);
    return (
      <View>
        <TouchableOpacity
          onPress={() => {
            if (item.referenceType === 'task') {
              navigation.navigate('ScheduleDetail', {
                id: item.referenceId,
                type: item.type as any,
                occurrenceDate: item.date.toISOString(),
                occurrenceTime: item.time,
              });
            } else if (item.referenceType === 'med') {
              navigation.navigate('MedicineDetail', {id: item.referenceId});
            }
          }}
          className={`flex-row items-center px-4 py-3 gap-3 rounded-xl ${overdue ? 'bg-red-50' : ''}`}>
          <View
            className={`w-1 h-10 rounded-full ${
              item.type === 'appointment' ? 'bg-blue-400' : overdue ? 'bg-red-300' : 'bg-transparent'
            }`}
          />
          <View className="w-16">
            <Text className={`text-xs ${overdue ? 'text-red-400 font-medium' : 'text-gray-400'}`}>
              {formatTimeStr(item.time)}
            </Text>
            {overdue && <Text className="text-red-400 text-xs">Missed</Text>}
          </View>
          <View className="flex justify-center items-center rounded-full">
            {cardIcon(item.type, item.isDone)}
          </View>
          <View className="flex-1">
            <Text className="text-gray-800 text-sm font-medium">{item.title}</Text>
            <Text className="text-gray-400 text-xs mt-0.5">{subLabel(item)}</Text>
          </View>
          <TouchableOpacity
            onPress={() => handleToggleDone(item)}
            className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
              item.isDone ? 'bg-teal-500 border-teal-500' : overdue ? 'border-red-300' : 'border-gray-300'
            }`}>
            {item.isDone && <Text className="text-white text-xs font-bold">✓</Text>}
          </TouchableOpacity>
        </TouchableOpacity>
        {showDivider && <View className="h-px bg-gray-100 ml-4" />}
      </View>
    );
  };

  // ─── render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-gray-100" style={{position: 'relative'}}>
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="bg-teal-500 px-5 pt-10 pb-8 rounded-b-3xl">
          <Text className="text-white text-2xl font-bold">Schedule</Text>
          <Text className="text-teal-100 text-sm mt-1">
            Manage your medications, appointments and health tasks.
          </Text>
        </View>

        <View className="px-4 mt-4">

          {/* Tab toggle + filters */}
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
              <Filter width={18} height={18} color="#4B5563" />
              <Text className="text-gray-600 text-sm font-medium">Filters</Text>
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <ScheduleSkeleton tab={displayedTab} />
          ) : (
            <>
              {/* Calendar card */}
              <View className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
                {activeTab === 'Month' ? (
                  <>
                    {/* month nav */}
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
                    {/* day headers */}
                    <View className="flex-row mb-2">
                      {DAYS.map(day => (
                        <View key={day} className="flex-1 items-center">
                          <Text className="text-gray-400 text-xs">{day}</Text>
                        </View>
                      ))}
                    </View>
                    {/* grid */}
                    <View className="flex-row flex-wrap">
                      {calendarCells.map((day, index) => {
                        const isToday =
                          day === today.getDate() &&
                          currentMonth === today.getMonth() &&
                          currentYear === today.getFullYear();
                        const isSelected = day === selectedDay;
                        const hasDot = day ? daysWithAppointments.has(day) : false;
                        return (
                          <View key={index} className="w-[14.28%] items-center mb-1">
                            {day ? (
                              <TouchableOpacity onPress={() => setSelectedDay(day)} className="items-center">
                                <View className={`w-8 h-8 items-center justify-center rounded-full ${
                                  isSelected ? 'bg-teal-500' : isToday ? 'border border-teal-500' : ''
                                }`}>
                                  <Text className={`text-sm ${
                                    isSelected ? 'text-white font-bold' : isToday ? 'text-teal-500 font-bold' : 'text-gray-700'
                                  }`}>
                                    {day}
                                  </Text>
                                </View>
                                {hasDot && (
                                  <View className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isSelected ? 'bg-teal-200' : 'bg-teal-400'}`} />
                                )}
                              </TouchableOpacity>
                            ) : (
                              <View className="w-8 h-8" />
                            )}
                          </View>
                        );
                      })}
                    </View>
                  </>
                ) : (
                  <>
                    {/* week nav — shows date range instead of just month */}
                    <View className="flex-row justify-between items-center mb-3">
                      <TouchableOpacity onPress={prevWeek} className="p-1">
                        <Text className="text-gray-500 text-lg">‹</Text>
                      </TouchableOpacity>
                      <Text className="text-gray-800 font-semibold text-xs">
                        {formatWeekRange(currentWeekStart)}
                      </Text>
                      <TouchableOpacity onPress={nextWeek} className="p-1">
                        <Text className="text-gray-500 text-lg">›</Text>
                      </TouchableOpacity>
                    </View>
                    {/* day headers */}
                    <View className="flex-row mb-2">
                      {DAYS.map(day => (
                        <View key={day} className="flex-1 items-center">
                          <Text className="text-gray-400 text-xs">{day}</Text>
                        </View>
                      ))}
                    </View>
                    {/* week day cells */}
                    <View className="flex-row">
                      {weekDates.map((date, i) => {
                        const isToday = date.toDateString() === today.toDateString();
                        const isSelected =
                          date.toDateString() ===
                          new Date(currentYear, currentMonth, selectedDay).toDateString();
                        const hasDot = allItems.some(
                          item => item.type === 'appointment' && isSameDay(item.date, date),
                        );
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
                              <View className={`w-8 h-8 items-center justify-center rounded-full ${
                                isSelected ? 'bg-teal-500' : isToday ? 'border border-teal-500' : ''
                              }`}>
                                <Text className={`text-sm ${
                                  isSelected ? 'text-white font-bold' : isToday ? 'text-teal-500 font-bold' : 'text-gray-700'
                                }`}>
                                  {date.getDate()}
                                </Text>
                              </View>
                              {hasDot && (
                                <View className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isSelected ? 'bg-teal-200' : 'bg-teal-400'}`} />
                              )}
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                  </>
                )}

                {/* legend */}
                <View className="flex-row justify-center mt-3 gap-1 items-center">
                  <View className="w-2 h-2 rounded-full bg-teal-400" />
                  <Text className="text-gray-400 text-xs">Has appointment</Text>
                </View>
              </View>

              {/* Schedule list */}
              {activeTab === 'Month' ? (
                (() => {
                  const selected = new Date(currentYear, currentMonth, selectedDay);
                  const items = itemsForDay(selected);
                  const label = isSameDay(selected, today)
                    ? 'Today'
                    : selected.toLocaleDateString('en-US', {weekday: 'long'});
                  const dateLabel = selected.toLocaleDateString('en-US', {
                    month: 'long', day: 'numeric', year: 'numeric',
                  });
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
                              <ScheduleItem
                                key={item.key}
                                item={item}
                                rowKey={item.key}
                                showDivider={index < items.length - 1}
                              />
                            ))
                        }
                        
                      </View>
                    </>
                  );
                })()
              ) : (
                <>
                  <TouchableOpacity
                    onPress={() => setShowPriorDays(p => !p)}
                    className="flex-row items-center gap-2 mb-3">
                    <View className={`w-4 h-4 rounded border-2 items-center justify-center ${
                      showPriorDays ? 'bg-teal-500 border-teal-500' : 'border-gray-300'
                    }`}>
                      {showPriorDays && <Text className="text-white text-xs font-bold">✓</Text>}
                    </View>
                    <Text className="text-gray-600 text-sm">Show Prior Days</Text>
                  </TouchableOpacity>
                  {visibleWeekDays.map(({date, items}) => {
                    const isToday = date.toDateString() === today.toDateString();
                    const dayLabel = isToday
                      ? 'Today'
                      : date.toLocaleDateString('en-US', {weekday: 'long'});
                    const dateLabel = date.toLocaleDateString('en-US', {
                      month: 'long', day: 'numeric', year: 'numeric',
                    });
                    const key = date.toDateString();
                    return (
                      <View
                        key={key}
                        className="mb-4"
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
                                  key={item.key}
                                  item={item}
                                  rowKey={`${key}-${item.key}`}
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
        <View className="h-24" />
        </View>
      </ScrollView>

      <FloatingAddButton onPress={() => setShowAddModal(true)} />
      <AddToScheduleModal visible={showAddModal} onClose={() => setShowAddModal(false)} />
    </SafeAreaView>
  );
}
