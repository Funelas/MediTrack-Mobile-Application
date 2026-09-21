import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import CheckupScreen from '../screens/CheckupScreen';
import AddCheckupReportScreen from '../screens/AddCheckupReportScreen';
import CreateCategoryScreen from '../screens/CreateCategoryScreen';

export type ReportsStackParamList = {
  ReportsMain: undefined;
  AddCheckupReport: undefined;
  CreateCategory: undefined;
};

const Stack = createNativeStackNavigator<ReportsStackParamList>();

export default function ReportsStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="ReportsMain" component={CheckupScreen} />
      <Stack.Screen name="AddCheckupReport" component={AddCheckupReportScreen} />
      <Stack.Screen name="CreateCategory" component={CreateCategoryScreen} />
    </Stack.Navigator>
  );
}
