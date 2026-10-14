import React, {useEffect} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {DatabaseProvider} from '@nozbe/watermelondb/DatabaseProvider';
import {database} from './src/database';
import BottomTabNavigator from './src/navigation/BottomTabNavigator';
import {setupNotifications, rescheduleAllNotifications} from './src/notifications/notificationService';
import {setupBackgroundTask, backgroundFetchHeadlessTask} from './src/notifications/backgroundTask';
import BackgroundFetch from 'react-native-background-fetch';
import notifee, {TriggerType, EventType} from '@notifee/react-native';
import {upsertOccurrence} from './src/database/services';
import {PermissionsAndroid, Platform} from 'react-native';

BackgroundFetch.registerHeadlessTask(backgroundFetchHeadlessTask);

// handles actions when app is open
notifee.onForegroundEvent(async ({type, detail}) => {
  if (type !== EventType.ACTION_PRESS) return;

  const referenceId = detail.notification?.data?.referenceId as string;
  const refType = detail.notification?.data?.type as string;
  const actionId = detail.pressAction?.id;

  if (!referenceId) return;

  if (actionId === 'mark-done') {
    const date = new Date(detail.notification?.data?.occurrenceDate as string);
    const time = detail.notification?.data?.occurrenceTime as string;
    await upsertOccurrence(
      referenceId,
      refType === 'med' ? 'med' : 'task',
      date,
      time,
      {isDone: true},
    );
    await notifee.cancelNotification(detail.notification!.id!);
  }

  if (actionId === 'snooze') {
    await notifee.cancelNotification(detail.notification!.id!);
    await notifee.createTriggerNotification(
      {
        title: detail.notification!.title,
        body: detail.notification!.body,
        android: detail.notification!.android!,
        data: detail.notification!.data,
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: Date.now() + 10 * 60 * 1000, // 10 mins
        alarmManager: {allowWhileIdle: true},
      },
    );
  }
});

// handles actions when app is closed/background
notifee.onBackgroundEvent(async ({type, detail}) => {
  if (type !== EventType.ACTION_PRESS) return;

  const referenceId = detail.notification?.data?.referenceId as string;
  const refType = detail.notification?.data?.type as string;
  const actionId = detail.pressAction?.id;

  if (!referenceId) return;

  if (actionId === 'mark-done') {
    const date = new Date(detail.notification?.data?.occurrenceDate as string);
    const time = detail.notification?.data?.occurrenceTime as string;
    await upsertOccurrence(
      referenceId,
      refType === 'med' ? 'med' : 'task',
      date,
      time,
      {isDone: true},
    );
    await notifee.cancelNotification(detail.notification!.id!);
  }

  if (actionId === 'snooze') {
    await notifee.cancelNotification(detail.notification!.id!);
    await notifee.createTriggerNotification(
      {
        title: detail.notification!.title,
        body: detail.notification!.body,
        android: detail.notification!.android!,
        data: detail.notification!.data,
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: Date.now() + 10 * 60 * 1000,
        alarmManager: {allowWhileIdle: true},
      },
    );
  }
});


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
