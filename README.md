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
│   ├── engine/               # On-device parser engine (TypeScript; Jest suites in __tests__/)
│   ├── components/           # Reusable UI widgets and buttons
│   ├── navigation/           # Screen stack and tab routing
│   ├── screens/              # Patient UI screens (Home, LabScan, Diary, Reminders)
│   └── utils/                # Helper utilities and formatters
├── package.json              # Dependencies and scripts
└── README.md
```

---

## Tests

The on-device engine runs in Node, without a device:

```bash
# from MediTracker/mobile
npm test                    # 20 engine suites (2026-10-25: 384 passed, 1 skipped)
npm run typecheck:engine    # TypeScript check of src/engine
```
