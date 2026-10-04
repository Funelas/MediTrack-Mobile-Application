import React from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import Bell from '../assets/svg_icons/bell.svg';
import Arrow from '../assets/svg_icons/arrow.svg';
import Calendar from '../assets/svg_icons/calendar.svg';
import Pills from '../assets/svg_icons/pills.svg';
import Check from '../assets/svg_icons/check.svg';
import {VirtualItem} from '../database/services';

interface Props {
  item: VirtualItem;
  index: number;
  total: number;
  iconSm: number;
  iconMd: number;
  isOverdue: boolean;
  onMarkDone: (item: VirtualItem) => void;
  formatTimeStr: (time: string) => string;
}

function getItemIcon(item: VirtualItem, size: number) {
  if (item.type === 'appointment')
    return <Calendar width={size} height={size} color={item.isDone ? '#139880' : '#787878'} />;
  if (item.type === 'med')
    return <Pills width={size} height={size} color={item.isDone ? '#139880' : '#787878'} />;
  return <Bell width={size} height={size} color={item.isDone ? '#139880' : '#787878'} />;
}

export default function ScheduleItemCard({
  item,
  index,
  total,
  iconSm,
  iconMd,
  isOverdue,
  onMarkDone,
  formatTimeStr,
}: Props) {
  return (
    <View
      className={`border rounded-xl border-1 my-1 p-1 ${
        item.isDone
          ? 'border-[#C2DDD8] bg-[#DBE7E5]'
          : isOverdue
          ? 'border-red-200 bg-red-50'
          : 'border-gray-200 bg-white'
      }`}>
      <View className="flex-row items-center py-3 gap-3">
        {/* Check button */}
        <TouchableOpacity
          onPress={() => onMarkDone(item)}
          className={`w-7 h-7 border rounded-full flex justify-center items-center ${
            item.isDone
              ? 'border-[#139880] bg-[#C2DDD8]'
              : isOverdue
              ? 'border-red-400 bg-transparent'
              : 'border-[#787878] bg-transparent'
          }`}>
          {item.isDone ? <Check width={iconSm} height={iconSm} color="#139880" /> : null}
        </TouchableOpacity>

        {/* Type icon */}
        {getItemIcon(item, iconMd)}

        {/* Time — fixed width, never wraps */}
        <Text
          numberOfLines={1}
          style={{flexShrink: 0}}
          className={`text-sm ${isOverdue && !item.isDone ? 'text-red-400' : 'text-gray-400'}`}>
          {formatTimeStr(item.time)}
        </Text>

        {/* Title + overdue label */}
        <View className="flex-1">
          <Text className="text-gray-800 text-sm font-medium" numberOfLines={1}>
            {item.title}
          </Text>
          {isOverdue && !item.isDone && (
            <Text className="text-red-400 text-xs mt-0.5">Missed</Text>
          )}
        </View>

        {/* Arrow */}
        <View style={{transform: [{rotate: '270deg'}]}}>
          <Arrow width={20} height={20} />
        </View>
      </View>

      {index < total - 1 && <View className="h-px bg-gray-100" />}
    </View>
  );
}
