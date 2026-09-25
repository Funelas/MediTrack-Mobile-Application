import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {DatabaseProvider} from '@nozbe/watermelondb/DatabaseProvider';
import {database} from './src/database';
import BottomTabNavigator from './src/navigation/BottomTabNavigator';

export default function App() {
  return (
    <DatabaseProvider database={database}>
      <NavigationContainer>
        <BottomTabNavigator />
      </NavigationContainer>
    </DatabaseProvider>
  );
}
