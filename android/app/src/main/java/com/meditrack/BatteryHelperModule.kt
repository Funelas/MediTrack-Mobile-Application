package com.meditrack

import android.os.Build
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.waseemsabir.betterypermissionhelper.BatteryPermissionHelper

class BatteryHelperModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "BatteryHelper"

    private val helper = BatteryPermissionHelper.getInstance()

    /**
     * Returns the device manufacturer in lowercase e.g. "samsung", "xiaomi", "huawei".
     * Uses android.os.Build.MANUFACTURER — no permission required.
     */
    @ReactMethod
    fun getDeviceBrand(promise: Promise) {
        promise.resolve(Build.MANUFACTURER.lowercase())
    }

    @ReactMethod
    fun isBatterySaverPermissionAvailable(promise: Promise) {
        try {
            val available = helper.isBatterySaverPermissionAvailable(
                context = reactContext,
                onlyIfSupported = true,
            )
            promise.resolve(available)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun openBatterySettings(promise: Promise) {
        try {
            val activity = currentActivity
            if (activity != null) {
                helper.getPermission(activity, open = true, newTask = false)
            } else {
                helper.getPermission(reactContext, open = true, newTask = true)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }
}
