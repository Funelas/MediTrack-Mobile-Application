import BackgroundFetch from 'react-native-background-fetch';
import {rescheduleAllNotifications} from './notificationService';

export function setupBackgroundTask() {
  BackgroundFetch.configure(
    {
      minimumFetchInterval: 60,
      stopOnTerminate: false,
      startOnBoot: true,
      enableHeadless: true,
      requiredNetworkType: BackgroundFetch.NETWORK_TYPE_NONE,
    },
    async taskId => {
      await rescheduleAllNotifications();
      BackgroundFetch.finish(taskId);
    },
    taskId => {
      BackgroundFetch.finish(taskId);
    },
  );
}

export const backgroundFetchHeadlessTask = async (event: any) => {
  await rescheduleAllNotifications();
  BackgroundFetch.finish(event.taskId);
};
