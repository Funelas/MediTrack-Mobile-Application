import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import ScheduleDetailScreen from '../screens/ScheduleDetailScreen';
import MedicineDetailScreen from '../screens/MedicineDetailScreen';
import AddScheduleScreen from '../screens/AddScheduleScreen';

export type HomeStackParamList = {
  HomeMain: undefined;
  HomeScheduleDetail: {        // renamed
    id: string;
    type: 'reminder' | 'appointment' | 'med';
    occurrenceDate?: string;
    occurrenceTime?: string;
    source?: 'home';
  };
  HomeEditSchedule: {          // renamed
    id: string;
    type: 'reminder' | 'appointment';
    editScope: 'this' | 'this_and_following' | 'all';
    occurrenceDate?: string;
    occurrenceTime?: string;
  };
  HomeMedicineDetail: {id: string};  // renamed
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

export default function HomeStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="HomeScheduleDetail" component={ScheduleDetailScreen} />
      <Stack.Screen name="HomeEditSchedule" component={AddScheduleScreen} />
      <Stack.Screen name="HomeMedicineDetail" component={MedicineDetailScreen} />
    </Stack.Navigator>
  );
}
