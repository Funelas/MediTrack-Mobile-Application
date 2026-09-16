# MediTracker Mobile Application

**Owners:** Member 1 (UX/UI & Project Lead) & Member 2B (Mobile Lead)

The cross-platform mobile client for patients to manage their chronic disease monitoring, scan physical lab slips, verify daily medication intakes via QR codes, and pair with the ESP32 wearable.

---

## Core Features
1. **Lab Result Capture:** Camera and file picker interface with OCR processing flow and manual-correction review modal.
2. **Longitudinal Trend Dashboard:** Interactive parameter trend charts over time.
3. **Medication Reminder & QR Verification:** Configurable intake alarms and camera QR scanner to log verified intake.
4. **Wearable BLE Manager:** BLE scanning, pairing, real-time heart rate readout, and alert buzzer triggers.

---

## Tech Stack Options
* **Flutter (Dart)** or **React Native (Expo / Bare)**
* State Management: Riverpod / Bloc (Flutter) or Zustand / Redux (React Native)
* BLE Library: `flutter_blue_plus` (Flutter) or `react-native-ble-plx` (React Native)
* QR Scanning: `mobile_scanner` or `react-native-vision-camera`

---

## Directory Structure (Planned)

```text
mobile/
├── assets/                   # App icons, fonts, illustrations
├── lib/ (or src/)
│   ├── api/                  # Backend REST API client
│   ├── ble/                  # Bluetooth Low Energy connection service
│   ├── models/               # Data structures (LabResult, Reminder, etc.)
│   ├── screens/              # App UI screens (Home, LabScan, Diary, Reminders)
│   └── widgets/              # Reusable UI components
├── pubspec.yaml (or package.json)
└── README.md
```
