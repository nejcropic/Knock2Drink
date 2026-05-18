# Knock2Drink

Knock2Drink is a smart ordering system that detects knock patterns using an onboard IMU and sends them wirelessly to a mobile application over Bluetooth Low Energy (BLE).

The project combines:
- embedded firmware on a Seeed XIAO nRF52840
- real-time knock detection
- BLE communication
- a React Native mobile application built with Expo

---

# Features

- Real-time knock detection
- BLE communication between device and phone
- Live order display
- Configurable knock-to-order mappings
- Mobile-friendly UI
- Offline local BLE operation
- Android standalone APK support

---

# Hardware

- Seeed XIAO nRF52840 Sense
- Built-in LSM6DS3 IMU
- Bluetooth Low Energy (BLE)

---

# Mobile App Stack

- Expo
- React Native
- expo-router
- react-native-ble-plx
- TypeScript

---

# Project Structure

```txt
app/
├── app/                # Expo Router screens
├── assets/
├── components/
├── context/
├── hooks/
├── services/
├── theme/
├── types/
├── android/
├── package.json
├── app.json
└── README.md
```

---

# Installation

## 1. Clone repository

```bash
git clone <repository-url>
cd app
```

---

## 2. Install dependencies

```bash
npm install
```

---

## 3. Configure Android SDK

Create:

```txt
android/local.properties
```

Add:

```txt
sdk.dir=C:\\Users\\YOUR_USERNAME\\AppData\\Local\\Android\\Sdk
```

---

# Running the App

## Android development build

```bash
npx expo run:android
```

---

## Standalone APK build

```bash
eas build -p android --profile preview
```

---

# BLE Configuration

Expected BLE device name:

```txt
Knock2Drink
```

BLE UUIDs:

```txt
SERVICE_UUID:
12345678-1234-1234-1234-1234567890ab

CHARACTERISTIC_UUID:
abcdefab-1234-5678-1234-abcdefabcdef
```

---

# Android Permissions

The app requires:

- BLUETOOTH
- BLUETOOTH_ADMIN
- BLUETOOTH_SCAN
- BLUETOOTH_CONNECT
- ACCESS_FINE_LOCATION

Configured in:

```txt
app.json
```

---

# Development Notes

This project uses native BLE modules and therefore cannot run inside Expo Go.

Use:
- `npx expo run:android`
- or standalone APK builds via EAS

---

# Common Commands

## Start Metro

```bash
npx expo start
```

## Run Android

```bash
npx expo run:android
```

## Clean reinstall

```bash
rm -rf node_modules
npm install
```

## Regenerate native Android project

```bash
npx expo prebuild --clean
```

---

# Troubleshooting

## Android SDK not found

Create:

```txt
android/local.properties
```

with:

```txt
sdk.dir=C:\\Users\\YOUR_USERNAME\\AppData\\Local\\Android\\Sdk
```

---

## BLE device not connecting

Check:
- Bluetooth enabled
- Android permissions granted
- Device advertising active
- Correct UUIDs configured

---

# License

MIT License
