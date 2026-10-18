import notifee, {AndroidImportance, TriggerType, TimestampTrigger, EventType} from '@notifee/react-native';
import {Platform, PermissionsAndroid, Alert} from 'react-native';
import {getItemsForDateRange, getMedicines} from '../database/services';
import {isBatterySaverPermissionAvailable, openOEMBatterySettings, getDeviceBrand} from '../native/BatteryHelper';

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

// ─── Brand-aware battery prompt text ─────────────────────────────────────────

function getBatteryPromptText(brand: string, isOEM: boolean): {
  title: string;
  message: string;
  buttonLabel: string;
} {
  const b = brand.toLowerCase();

  if (b.includes('samsung')) {
    return {
      title: 'Enable Reliable Reminders',
      message:
        'Samsung\'s battery manager may delay or block your medication reminders.\n\n' +
        'On the next screen:\n' +
        '1. Tap "Device Care"\n' +
        '2. Tap "Battery"\n' +
        '3. Tap "App Power Management"\n' +
        '4. Add MediTrack to "Never sleeping apps"',
      buttonLabel: 'Open Battery Settings',
    };
  }

  if (b.includes('xiaomi') || b.includes('redmi') || b.includes('poco')) {
    return {
      title: 'Enable Reliable Reminders',
      message:
        'MIUI\'s battery saver may block your medication reminders.\n\n' +
        'On the next screen:\n' +
        '1. Find MediTrack in the list\n' +
        '2. Set battery usage to "No restrictions"',
      buttonLabel: 'Open Battery Settings',
    };
  }

  if (b.includes('huawei') || b.includes('honor')) {
    return {
      title: 'Enable Reliable Reminders',
      message:
        'Huawei\'s battery manager may stop your medication reminders.\n\n' +
        'On the next screen:\n' +
        '1. Find MediTrack\n' +
        '2. Tap "Manage manually"\n' +
        '3. Enable Auto-launch, Secondary launch, and Run in background',
      buttonLabel: 'Open Battery Settings',
    };
  }

  if (b.includes('oppo') || b.includes('realme') || b.includes('oneplus')) {
    return {
      title: 'Enable Reliable Reminders',
      message:
        'ColorOS\'s battery manager may prevent your reminders from firing.\n\n' +
        'On the next screen:\n' +
        '1. Find MediTrack\n' +
        '2. Set to "Allow auto-launch" and disable "Quick Freeze"',
      buttonLabel: 'Open Battery Settings',
    };
  }

  if (b.includes('vivo')) {
    return {
      title: 'Enable Reliable Reminders',
      message:
        'Vivo\'s battery manager may block your medication reminders.\n\n' +
        'On the next screen:\n' +
        '1. Find MediTrack\n' +
        '2. Enable background and auto-start permissions',
      buttonLabel: 'Open Battery Settings',
    };
  }

  // Stock Android or unknown OEM
  return {
    title: 'Enable Reliable Reminders',
    message:
      'To make sure you never miss a medication or appointment, allow MediTrack to run without battery restrictions.\n\n' +
      'On the next screen, find MediTrack and select "Unrestricted".',
    buttonLabel: 'Allow',
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

export async function setupNotifications() {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
  }

  // Battery optimization prompt — personalised per device brand.
  // Tries OEM-specific screen first, falls back to stock Android via Notifee.
  if (Platform.OS === 'android') {
    const batteryOptimized = await notifee.isBatteryOptimizationEnabled();
    if (batteryOptimized) {
      const brand = await getDeviceBrand();
      const isOEM = await isBatterySaverPermissionAvailable();

      const {title, message, buttonLabel} = getBatteryPromptText(brand, isOEM);

      await new Promise<void>(resolve => {
        Alert.alert(
          title,
          message,
          [
            {text: 'Not Now', style: 'cancel', onPress: resolve},
            {
              text: buttonLabel,
              onPress: async () => {
                if (isOEM) {
                  const opened = await openOEMBatterySettings();
                  if (!opened) await notifee.openBatteryOptimizationSettings();
                } else {
                  await notifee.openBatteryOptimizationSettings();
                }
                resolve();
              },
            },
          ],
          {cancelable: false},
        );
      });
    }
  }

  await notifee.deleteChannel(CHANNELS.MEDICATIONS);
  await notifee.deleteChannel(CHANNELS.APPOINTMENTS);
  await notifee.deleteChannel(CHANNELS.REMINDERS);
  await notifee.deleteChannel(CHANNELS.LOW_STOCK);

  await notifee.createChannel({id: CHANNELS.MEDICATIONS, name: 'Medications', importance: AndroidImportance.HIGH, sound: 'notification_sound', vibration: false});
  await notifee.createChannel({id: CHANNELS.APPOINTMENTS, name: 'Appointments', importance: AndroidImportance.HIGH, sound: 'notification_sound', vibration: false});
  await notifee.createChannel({id: CHANNELS.REMINDERS, name: 'Reminders', importance: AndroidImportance.HIGH, sound: 'notification_sound', vibration: false});
  await notifee.createChannel({id: CHANNELS.LOW_STOCK, name: 'Low Stock Alerts', importance: AndroidImportance.DEFAULT, sound: 'notification_sound', vibration: false});
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
          android: {
            channelId: CHANNELS.MEDICATIONS,
            pressAction: {id: 'default'},
            smallIcon: 'ic_notification',
            importance: AndroidImportance.HIGH,
            fullScreenAction: {id: 'default'},
            actions: [
              {title: '✅ Mark as Done', pressAction: {id: 'mark-done'}},
              {title: '⏰ Snooze 10 min', pressAction: {id: 'snooze'}},
            ],
          },
          data: {
            referenceId: item.referenceId,
            type: 'med',
            occurrenceDate: item.date.toISOString(),
            occurrenceTime: item.time,
          },
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
          android: {
            channelId,
            pressAction: {id: 'default'},
            smallIcon: 'ic_notification',
            importance: AndroidImportance.HIGH,
            fullScreenAction: {id: 'default'},
            actions: [
              {title: '✅ Mark as Done', pressAction: {id: 'mark-done'}},
              {title: '⏰ Snooze 10 min', pressAction: {id: 'snooze'}},
            ],
          },
          data: {
            referenceId: item.referenceId,
            type: item.type,
            occurrenceDate: item.date.toISOString(),
            occurrenceTime: item.time,
          },
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
              android: {
                channelId,
                pressAction: {id: 'default'},
                smallIcon: 'ic_notification',
                importance: AndroidImportance.HIGH,
                actions: [
                  {title: '✅ Mark as Done', pressAction: {id: 'mark-done'}},
                  {title: '⏰ Snooze 10 min', pressAction: {id: 'snooze'}},
                ],
              },
              data: {
                referenceId: item.referenceId,
                type: item.type,
                occurrenceDate: item.date.toISOString(),
                occurrenceTime: item.time,
              },
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
        android: {
          channelId: CHANNELS.LOW_STOCK,
          pressAction: {id: 'default'},
          smallIcon: 'ic_notification',
          importance: AndroidImportance.HIGH,
        },
        data: {
          referenceId: med.id,
          type: 'low-stock',
        },
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
