import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import MedicineScreen from '../screens/MedicineScreen';
import AddMedicineScreen from '../screens/AddMedicineScreen';

export type MedsStackParamList = {
  MedsMain: undefined;
  AddMedicine: undefined;
};

const Stack = createNativeStackNavigator<MedsStackParamList>();

export default function MedsStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="MedsMain" component={MedicineScreen} />
      <Stack.Screen name="AddMedicine" component={AddMedicineScreen} />
    </Stack.Navigator>
  );
}
