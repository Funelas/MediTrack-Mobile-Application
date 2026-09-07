import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/HomeScreen';
import MedicineScreen from '../screens/MedicineScreen';
import CheckupScreen from '../screens/CheckupScreen';
import ScheduleScreen from '../screens/ScheduleScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

export default function BottomTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#f3f4f6',
          height: 60,
          paddingBottom: 8,
        },
      }}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Medicine" component={MedicineScreen} />
      <Tab.Screen name="Checkup" component={CheckupScreen} />
      <Tab.Screen name="Schedule" component={ScheduleScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
