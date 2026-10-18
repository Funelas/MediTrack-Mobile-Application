import {NativeModules, Platform} from 'react-native';

const {BatteryHelper} = NativeModules;

/**
 * Returns the device manufacturer in lowercase e.g. "samsung", "xiaomi", "huawei".
 * Returns empty string on iOS or if the module isn't available.
 */
export async function getDeviceBrand(): Promise<string> {
  if (Platform.OS !== 'android' || !BatteryHelper) return '';
  try {
    return await BatteryHelper.getDeviceBrand();
  } catch {
    return '';
  }
}

/**
 * Returns true if the current device has OEM-specific battery settings
 * AND the app is currently being battery-optimized.
 *
 * Supported OEMs: Samsung, Xiaomi, Redmi, Poco, Huawei, OPPO, HTC, ZTE, Meizu, Letv.
 * Returns false on stock Android (use Notifee fallback in that case).
 */
export async function isBatterySaverPermissionAvailable(): Promise<boolean> {
  if (Platform.OS !== 'android' || !BatteryHelper) return false;
  try {
    return await BatteryHelper.isBatterySaverPermissionAvailable();
  } catch {
    return false;
  }
}

/**
 * Opens the OEM-specific battery settings page for MediTrack.
 * Returns true if it successfully opened an OEM screen,
 * false if the device isn't supported (caller should fall back to Notifee).
 */
export async function openOEMBatterySettings(): Promise<boolean> {
  if (Platform.OS !== 'android' || !BatteryHelper) return false;
  try {
    return await BatteryHelper.openBatterySettings();
  } catch {
    return false;
  }
}
