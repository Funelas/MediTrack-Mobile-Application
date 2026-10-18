import React from 'react';
import {View} from 'react-native';
import SkeletonBox from './SkeletonBox';

interface ScheduleSkeletonProps {
  tab: 'Month' | 'Week';
}

export default function ScheduleSkeleton({tab}: ScheduleSkeletonProps) {
  return (
    <View>
      {/* Calendar skeleton */}
      <View className="bg-white rounded-2xl p-4 mb-4">
        <View className="flex-row justify-between items-center mb-4">
          <SkeletonBox width={16} height={16} borderRadius={8} />
          <SkeletonBox width={120} height={16} />
          <SkeletonBox width={16} height={16} borderRadius={8} />
        </View>
        <View className="flex-row justify-between mb-3">
          {Array.from({length: 7}).map((_, i) => (
            <SkeletonBox key={i} width={28} height={12} borderRadius={4} />
          ))}
        </View>
        {tab === 'Month' ? (
          Array.from({length: 5}).map((_, row) => (
            <View key={row} className="flex-row justify-between mb-2">
              {Array.from({length: 7}).map((_, col) => (
                <SkeletonBox key={col} width={28} height={28} borderRadius={14} />
              ))}
            </View>
          ))
        ) : (
          <View className="flex-row justify-between">
            {Array.from({length: 7}).map((_, i) => (
              <SkeletonBox key={i} width={28} height={28} borderRadius={14} />
            ))}
          </View>
        )}
      </View>

      {/* Day label skeleton */}
      <SkeletonBox width={180} height={14} style={{marginBottom: 12}} />

      {/* Schedule items skeleton */}
      <View className="bg-white rounded-2xl overflow-hidden mb-4">
        {Array.from({length: 4}).map((_, i) => (
          <View key={i}>
            <View className="flex-row items-center px-4 py-3 gap-3">
              <SkeletonBox width={40} height={12} borderRadius={4} />
              <SkeletonBox width={32} height={32} borderRadius={16} />
              <View className="flex-1 gap-2">
                <SkeletonBox width="70%" height={12} />
                <SkeletonBox width="40%" height={10} />
              </View>
              <SkeletonBox width={24} height={24} borderRadius={12} />
            </View>
            {i < 3 && <View className="h-px bg-gray-100 ml-4" />}
          </View>
        ))}
      </View>
    </View>
  );
}
