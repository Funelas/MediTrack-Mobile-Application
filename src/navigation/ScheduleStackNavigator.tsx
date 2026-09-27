import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import ScheduleScreen from '../screens/ScheduleScreen';
import AddScheduleScreen from '../screens/AddScheduleScreen';
import ScheduleDetailScreen from '../screens/ScheduleDetailScreen';
import MedicineDetailScreen from '../screens/MedicineDetailScreen';

export type ScheduleStackParamList = {
  ScheduleMain: undefined;
  AddSchedule: {type: 'reminder' | 'appointment'; id?: string};
  ScheduleDetail: {
    id: string;
    type: 'reminder' | 'appointment' | 'med';
    occurrenceDate?: string;
    occurrenceTime?: string;
  };
  EditSchedule: {
    id: string;
    type: 'reminder' | 'appointment';
    /** "this" = edit one occurrence, "this_and_following" = split series, "all" = edit rule */
    editScope: 'this' | 'this_and_following' | 'all';
    occurrenceDate?: string;
    occurrenceTime?: string;
  };
  MedicineDetail: {id: string};
};

const Stack = createNativeStackNavigator<ScheduleStackParamList>();

export default function ScheduleStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="ScheduleMain" component={ScheduleScreen} />
      <Stack.Screen name="AddSchedule" component={AddScheduleScreen} />
      <Stack.Screen name="ScheduleDetail" component={ScheduleDetailScreen} />
      <Stack.Screen name="EditSchedule" component={AddScheduleScreen} />
      <Stack.Screen name="MedicineDetail" component={MedicineDetailScreen} />
    </Stack.Navigator>
  );
}
