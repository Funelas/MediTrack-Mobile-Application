import notifee, {AndroidImportance, TriggerType, TimestampTrigger, EventType} from '@notifee/react-native';
import {Platform, PermissionsAndroid, Alert} from 'react-native';
import {getItemsForDateRange, getMedicines} from '../database/services';

export const CHANNELS = {
  MEDICATIONS: 'medications',
  APPOINTMENTS: 'appointments',
  REMINDERS: 'reminders',
  LOW_STOCK: 'low-stock',
};

const REMINDER_OFFSET_MINS: Record<string, number> = {
  'At time of event': 0,
  '5 mins before': 5,
  '15 mins before': 15,
  '30 mins before': 30,
  '1 hour before': 60,
};

export async function setupNotifications() {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
  }

  // Show an in-app prompt before opening the system battery settings page,
  // so the user understands why we're asking.
  if (Platform.OS === 'android') {
    const batteryOptimized = await notifee.isBatteryOptimizationEnabled();
    if (batteryOptimized) {
      await new Promise<void>(resolve => {
        Alert.alert(
          'Enable Reliable Reminders',
          'To make sure you never miss a medication or appointment, allow MediTrack to run without battery restrictions.\n\nTap "Allow" then select "Unrestricted" on the next screen.',
          [
            {
              text: 'Not Now',
              style: 'cancel',
              onPress: resolve,
            },
            {
              text: 'Allow',
              onPress: async () => {
                await notifee.openBatteryOptimizationSettings();
                resolve();
              },
            },
          ],
          {cancelable: false},
        );
      });
    }
  }

  await notifee.createChannel({id: CHANNELS.MEDICATIONS, name: 'Medications', importance: AndroidImportance.HIGH});
  await notifee.createChannel({id: CHANNELS.APPOINTMENTS, name: 'Appointments', importance: AndroidImportance.HIGH});
  await notifee.createChannel({id: CHANNELS.REMINDERS, name: 'Reminders', importance: AndroidImportance.HIGH});
  await notifee.createChannel({id: CHANNELS.LOW_STOCK, name: 'Low Stock Alerts', importance: AndroidImportance.DEFAULT});
}

function buildNotificationId(referenceId: string, date: Date, time: string, suffix = ''): string {
  const str = `${referenceId}-${date.toDateString()}-${time}${suffix}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return String(Math.abs(hash));
}

function buildFireDate(date: Date, timeStr: string, offsetMins = 0): Date {
  const [h, m] = timeStr.split(':').map(Number);
  const fire = new Date(date);
  fire.setHours(h, m, 0, 0);
  fire.setMinutes(fire.getMinutes() - offsetMins);
  return fire;
}

export async function scheduleNotificationsForRange(rangeStart: Date, rangeEnd: Date) {
  const items = await getItemsForDateRange(rangeStart, rangeEnd);
  const now = new Date();

  for (const item of items) {
    if (item.isDone || item.isCancelled) continue;

    const fireDate = buildFireDate(item.date, item.time);
    if (fireDate <= now) continue;

    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: fireDate.getTime(),
      alarmManager: {allowWhileIdle: true},
    };

    if (item.type === 'med') {
      await notifee.createTriggerNotification(
        {
          id: buildNotificationId(item.referenceId, item.date, item.time),
          title: '💊 Time to take your medicine',
          body: `${item.title}${item.dosage ? ` · ${item.dosage}` : ''}`,
          android: {channelId: CHANNELS.MEDICATIONS, pressAction: {id: 'default'}, smallIcon: 'ic_notification'},
          data: {referenceId: item.referenceId, type: 'med'},
        },
        trigger,
      );
    } else {
      const offsetMins = REMINDER_OFFSET_MINS[item.reminder ?? ''] ?? 0;
      const channelId = item.type === 'appointment' ? CHANNELS.APPOINTMENTS : CHANNELS.REMINDERS;
      const emoji = item.type === 'appointment' ? '📅' : '🔔';
      const label = item.type === 'appointment' ? 'Appointment' : 'Reminder';

      await notifee.createTriggerNotification(
        {
          id: buildNotificationId(item.referenceId, item.date, item.time),
          title: `${emoji} ${label}`,
          body: item.title,
          android: {channelId, pressAction: {id: 'default'}, smallIcon: 'ic_notification'},
          data: {referenceId: item.referenceId, type: item.type},
        },
        trigger,
      );

      if (offsetMins > 0) {
        const beforeDate = buildFireDate(item.date, item.time, offsetMins);
        if (beforeDate > now) {
          await notifee.createTriggerNotification(
            {
              id: buildNotificationId(item.referenceId, item.date, item.time, '-before'),
              title: `${emoji} Coming up: ${item.title}`,
              body: `In ${offsetMins < 60 ? `${offsetMins} minutes` : '1 hour'}`,
              android: {channelId, pressAction: {id: 'default'}, smallIcon: 'ic_notification'},
              data: {referenceId: item.referenceId, type: item.type},
            },
            {
              type: TriggerType.TIMESTAMP,
              timestamp: beforeDate.getTime(),
              alarmManager: {allowWhileIdle: true},
            },
          );
        }
      }
    }
  }
}

export async function checkLowStockNotifications() {
  const medicines = await getMedicines();
  for (const med of medicines) {
    if (!med.lowStockAlert) continue;
    if (med.currentStock <= med.lowStockThreshold) {
      await notifee.displayNotification({
        title: '⚠️ Low Stock Alert',
        body: `${med.name} is running low — only ${med.currentStock} ${med.form}(s) left`,
        android: {channelId: CHANNELS.LOW_STOCK, pressAction: {id: 'default'}, smallIcon: 'ic_notification'},
        data: {referenceId: med.id, type: 'low-stock'},
      });
    }
  }
}

export async function rescheduleAllNotifications() {
  await notifee.cancelAllNotifications();
  const today = new Date();
  const sevenDaysLater = new Date();
  sevenDaysLater.setDate(today.getDate() + 7);
  await scheduleNotificationsForRange(today, sevenDaysLater);
  await checkLowStockNotifications();
}
