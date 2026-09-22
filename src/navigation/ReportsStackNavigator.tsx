import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import CheckupScreen from '../screens/CheckupScreen';
import AddCheckupReportScreen from '../screens/AddCheckupReportScreen';
import CreateCategoryScreen from '../screens/CreateCategoryScreen';
import InputMethodScreen from '../screens/InputMethodScreen';
import ManualEntryScreen from '../screens/ManualEntryScreen';
import VerifyResultScreen from '../screens/VerifyResultScreen';

export type ReportsStackParamList = {
  ReportsMain: undefined;
  AddCheckupReport: undefined;
  CreateCategory: undefined;
  InputMethod: {categoryId: string; categoryLabel: string; categoryIcon: string};
  ManualEntry: {categoryId: string; categoryLabel: string; categoryIcon: string};
  VerifyResult: {categoryId: string; categoryLabel: string; categoryIcon: string; entries: {fieldName: string; value: string; unit?: string}[]; date: string; isOCR?: boolean};
};

const Stack = createNativeStackNavigator<ReportsStackParamList>();

export default function ReportsStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="ReportsMain" component={CheckupScreen} />
      <Stack.Screen name="AddCheckupReport" component={AddCheckupReportScreen} />
      <Stack.Screen name="CreateCategory" component={CreateCategoryScreen} />
      <Stack.Screen name="InputMethod" component={InputMethodScreen} />
      <Stack.Screen name="ManualEntry" component={ManualEntryScreen} />
      <Stack.Screen name="VerifyResult" component={VerifyResultScreen} />
    </Stack.Navigator>
  );
}
