import React, {useEffect, useRef} from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {syncDatabase} from './src/sync/syncService';
import {useAuth} from './src/context/AuthContext';
import {supabase} from './src/lib/supabase';
import {AuthProvider} from './src/context/AuthContext';
import {DatabaseProvider} from '@nozbe/watermelondb/DatabaseProvider';
import {database} from './src/database';
import BottomTabNavigator from './src/navigation/BottomTabNavigator';
import {setupNotifications, rescheduleAllNotifications} from './src/notifications/notificationService';
import {setupBackgroundTask, backgroundFetchHeadlessTask} from './src/notifications/backgroundTask';
import BackgroundFetch from 'react-native-background-fetch';
import notifee, {TriggerType, EventType} from '@notifee/react-native';
import {upsertOccurrence} from './src/database/services';
import {AppState, PermissionsAndroid, Platform} from 'react-native';
import NetInfo from '@react-native-community/netinfo';

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
        id: detail.notification!.id,
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
        id: detail.notification!.id,
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

function SyncManager() {
  const {user} = useAuth();
  const syncTimeout = useRef<any>(null);

  const debouncedSync = (userId: string) => {
    if (syncTimeout.current) clearTimeout(syncTimeout.current);
    syncTimeout.current = setTimeout(() => {
      syncDatabase(userId).catch(console.warn);
    }, 2000);
  };

  // Sync on foreground resume
  useEffect(() => {
    if (!user) return;

    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        debouncedSync(user.id);
      }
    });

    // Sync immediately when user logs in
    syncDatabase(user.id).catch(console.warn);

    return () => subscription.remove();
  }, [user]);

  // Sync when local database changes (any write operation)
  useEffect(() => {
    if (!user) return;

    const subscription = database.withChangesForTables([
      'medicines', 'intake_logs', 'tasks', 'occurrences',
      'checkup_reports', 'test_results', 'categories',
    ]).subscribe(changes => {
      if (changes && changes.length > 0) {
        debouncedSync(user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [user]);

  // Supabase Realtime — pull when remote changes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', {event: '*', schema: 'public'}, () => {
        debouncedSync(user.id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

    useEffect(() => {
    if (!user) return;

    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable) {
        debouncedSync(user.id);
      }
    });

    return () => unsubscribe();
  }, [user]);

  return null;

}
  

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
      <AuthProvider>
        <SyncManager/>
        <NavigationContainer>
          <BottomTabNavigator />
        </NavigationContainer>
      </AuthProvider>
    </DatabaseProvider>
  );
}
