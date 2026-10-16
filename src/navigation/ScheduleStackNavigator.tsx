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
    source?: 'home';
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

import {useNavigationState, useNavigation} from '@react-navigation/native';

function ScheduleStackWithReset() {
  const navigation = useNavigation<any>();

  // Whenever this stack comes into focus, pop everything back to ScheduleMain
  React.useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      navigation.reset({
        index: 0,
        routes: [{name: 'ScheduleMain'}],
      });
    });
    return unsubscribe;
  }, [navigation]);

  return null; // just the side-effect
}

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
