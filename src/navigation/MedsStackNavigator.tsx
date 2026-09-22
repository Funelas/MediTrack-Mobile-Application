import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import MedicineScreen from '../screens/MedicineScreen';
import AddMedicineScreen from '../screens/AddMedicineScreen';
import MedicineDetailScreen from '../screens/MedicineDetailScreen';

export type MedsStackParamList = {
  MedsMain: undefined;
  AddMedicine: undefined;
  MedicineDetail: {id: string};
  EditMedicine: {id: string};
};

const Stack = createNativeStackNavigator<MedsStackParamList>();

export default function MedsStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Screen name="MedsMain" component={MedicineScreen} />
      <Stack.Screen name="AddMedicine" component={AddMedicineScreen} />
      <Stack.Screen name="MedicineDetail" component={MedicineDetailScreen} />
      <Stack.Screen name="EditMedicine" component={AddMedicineScreen} />
    </Stack.Navigator>
  );
}
