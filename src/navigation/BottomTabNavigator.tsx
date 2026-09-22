import React from 'react';
import {View, Text} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/HomeScreen';
import MedsStackNavigator from './MedsStackNavigator';
import MedicineScreen from '../screens/MedicineScreen';
import ReportsStackNavigator from './ReportsStackNavigator';
import CheckupScreen from '../screens/CheckupScreen';
import ScheduleStackNavigator from './ScheduleStackNavigator';
import ScheduleScreen from '../screens/ScheduleScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

// Replace these with your actual SVG imports
import HomeIcon from '../assets/svg_icons/navigation_icons/home.svg';
import ScheduleIcon from '../assets/svg_icons/navigation_icons/schedule.svg';
import MedsIcon from '../assets/svg_icons/navigation_icons/meds.svg';
import ReportsIcon from '../assets/svg_icons/navigation_icons/reports.svg';
import ProfileIcon from '../assets/svg_icons/navigation_icons/profile.svg';

function PlaceholderIcon({color}: {color: string}) {
  return <View style={{width: 24, height: 24, borderRadius: 4, backgroundColor: color, opacity: 0.5}} />;
}

function TabIcon({focused, color, label}: {focused: boolean; color: string; label: string}) {
  const renderIcon = () => {
    switch (label) {
      case 'Home':
        return <HomeIcon width={24} height={24} color={color} />;
        
      case 'Schedule':
        return <ScheduleIcon width={24} height={24} color={color} />;
        
      case 'Meds':
        return <MedsIcon width={24} height={24} color={color} />;
        
      case 'Reports':
        return <ReportsIcon width={24} height={24} color={color} />;
        
      case 'Profile':
        return <ProfileIcon width={24} height={24} color={color} />;
        
      default:
        return <PlaceholderIcon color={color} />;
    }
  };

  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: focused ? 'rgba(20, 184, 166, 0.15)' : 'transparent',
      }}>
      {renderIcon()}
    </View>
  );
}

export default function BottomTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: '#14B8A6',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#f3f4f6',
          height: 64,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarIcon: ({focused, color}) => (
          <TabIcon focused={focused} color={color} label={route.name} />
        ),
      })}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Schedule" component={ScheduleStackNavigator}
        options={({navigation}) => ({
          tabBarStyle: navigation.getState().routes[navigation.getState().index]?.state?.index > 0
            ? {display: 'none'} : {backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#f3f4f6', height: 64, paddingBottom: 8, paddingTop: 4},
        })}
      />
      <Tab.Screen name="Meds" component={MedsStackNavigator}
        options={({navigation}) => ({
          tabBarStyle: navigation.getState().routes[navigation.getState().index]?.state?.index > 0
            ? {display: 'none'} : {backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#f3f4f6', height: 64, paddingBottom: 8, paddingTop: 4},
        })}
      />
      <Tab.Screen name="Reports" component={ReportsStackNavigator}
        options={({navigation}) => ({
          tabBarStyle: navigation.getState().routes[navigation.getState().index]?.state?.index > 0
            ? {display: 'none'} : {backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: '#f3f4f6', height: 64, paddingBottom: 8, paddingTop: 4},
        })}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
