# MediTracker Mobile Application

**Owners:** Member 1 (UX/UI & Project Lead) & Member 2B (Mobile Lead)

The cross-platform mobile client for patients to manage chronic disease monitoring, scan physical lab slips, verify daily medication intakes via QR codes, and pair with the ESP32 wearable.

---

## Tech Stack
* **Framework:** React Native
* **Language:** TypeScript / JavaScript
* **Target Platforms:** Android & iOS

---

## Directory Structure

```text
mobile/
├── android/                  # Native Android project and Gradle build configs
├── ios/                      # Native iOS project and CocoaPods specs
├── src/                      # Application source code
│   ├── api/                  # Backend REST API client bindings
│   ├── ble/                  # Bluetooth Low Energy client service
│   ├── components/           # Reusable UI widgets and buttons
│   ├── navigation/           # Screen stack and tab routing
│   ├── screens/              # Patient UI screens (Home, LabScan, Diary, Reminders)
│   └── utils/                # Helper utilities and formatters
├── package.json              # Dependencies and scripts
└── README.md
