import React, {useEffect} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {DatabaseProvider} from '@nozbe/watermelondb/DatabaseProvider';
import {database} from './src/database';
import BottomTabNavigator from './src/navigation/BottomTabNavigator';
import {setupNotifications, rescheduleAllNotifications} from './src/notifications/notificationService';
import {setupBackgroundTask, backgroundFetchHeadlessTask} from './src/notifications/backgroundTask';
import BackgroundFetch from 'react-native-background-fetch';
import notifee, {AndroidImportance, TriggerType} from '@notifee/react-native';
import {PermissionsAndroid, Platform} from 'react-native';

BackgroundFetch.registerHeadlessTask(backgroundFetchHeadlessTask);

notifee.onForegroundEvent(() => {});

async function requestAllPermissions() {
  if (Platform.OS !== 'android') return;

  const permissions: any[] = [
    PermissionsAndroid.PERMISSIONS.CAMERA,
    PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
    PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
  ];

  if (Platform.Version >= 33) {
    permissions.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    permissions.push(PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES);
  }

  await PermissionsAndroid.requestMultiple(permissions);
}

export default function App() {
  useEffect(() => {
    (async () => {
      try {
        await requestAllPermissions();
        await setupNotifications();

        // ── temporary test — remove after confirming notifications work ──
        await notifee.createTriggerNotification(
          {
            title: '✅ Scheduled Test',
            body: 'This fired 1 minute after launch!',
            android: {
              channelId: 'medications',
              smallIcon: 'ic_notification',
              pressAction: {id: 'default'},
              importance: AndroidImportance.HIGH,
              autoCancel: false,
            },
          },
          {
            type: TriggerType.TIMESTAMP,
            timestamp: Date.now() + 60 * 1000,
            alarmManager: {allowWhileIdle: true},
          },
        );

        setupBackgroundTask();
        await rescheduleAllNotifications();
      } catch (e) {
        console.error('❌ Notification error:', e);
      }
    })();
  }, []);

  return (
    <DatabaseProvider database={database}>
      <NavigationContainer>
        <BottomTabNavigator />
      </NavigationContainer>
    </DatabaseProvider>
  );
}
