import { Buffer } from "buffer";
import { PermissionsAndroid, Platform } from "react-native";
import { BleManager, Device, Subscription } from "react-native-ble-plx";

const DEVICE_NAME_PREFIX = "K2D_";

const SERVICE_UUID = "12345678-1234-1234-1234-1234567890ab";
const CHARACTERISTIC_UUID = "abcdefab-1234-5678-1234-abcdefabcdef";

let manager: BleManager | null = null;

const connectedDevices = new Map<string, Device>();
const monitorSubscriptions = new Map<string, Subscription>();
const connectingDevices = new Set<string>();

let isScanning = false;

type BleMessageCallback = (msg: any) => void;

export async function connectBLE(onMessage: BleMessageCallback) {
  try {
    const granted = await requestBluetoothPermissions();

    if (!granted) {
      onMessage({ event: "ble_permission_denied" });
      return;
    }

    if (!manager) {
      manager = new BleManager();
    }

    if (isScanning) {
      return;
    }

    isScanning = true;

    console.log("STARTING BLE SCAN");

    onMessage({ event: "BLE_SCAN_START" });

    manager.startDeviceScan(
      null,
      { allowDuplicates: false },
      async (error, device) => {
        if (error) {
          console.log("SCAN ERROR", error);
          isScanning = false;

          onMessage({
            event: "ble_error",
            error,
          });

          return;
        }

        if (!device) {
          return;
        }

        const name = device.name || device.localName || "";

        if (!name.startsWith(DEVICE_NAME_PREFIX)) {
          return;
        }

        if (connectedDevices.has(device.id)) {
          return;
        }

        if (connectingDevices.has(device.id)) {
          return;
        }

        connectingDevices.add(device.id);

        await connectToDevice(device, name, onMessage);
      },
    );
  } catch (e) {
    console.log("BLE INIT ERROR", e);
    isScanning = false;

    onMessage({
      event: "ble_init_error",
      error: e,
    });
  }
}

async function connectToDevice(
  device: Device,
  advertisedName: string,
  onMessage: BleMessageCallback,
) {
  let connectedDevice: Device | null = null;
  const fallbackDeviceId = getDeviceIdFromName(advertisedName, device.id);

  try {
    console.log("CONNECTING TO DEVICE:", advertisedName);

    connectedDevice = await device.connect();

    connectedDevices.set(device.id, connectedDevice);

    console.log("CONNECTED:", fallbackDeviceId);

    onMessage({
      deviceId: fallbackDeviceId,
      deviceName: advertisedName,
      event: "ble_connected",
    });

    connectedDevice.onDisconnected((error) => {
      console.log("DEVICE DISCONNECTED:", fallbackDeviceId, error);

      connectedDevices.delete(device.id);
      connectingDevices.delete(device.id);

      monitorSubscriptions.get(device.id)?.remove();
      monitorSubscriptions.delete(device.id);

      onMessage({
        deviceId: fallbackDeviceId,
        deviceName: advertisedName,
        event: "ble_reconnecting",
      });

      setTimeout(() => {
        connectToDevice(device, advertisedName, onMessage).catch((e) => {
          console.log("RECONNECT FAILED", e);

          onMessage({
            deviceId: fallbackDeviceId,
            deviceName: advertisedName,
            event: "ble_disconnected",
            error: e,
          });
        });
      }, 2500);
    });

    if (Platform.OS === "android") {
      try {
        await connectedDevice.requestMTU(128);
      } catch (e) {
        console.log("MTU ERROR:", fallbackDeviceId, e);
      }
    }

    await connectedDevice.discoverAllServicesAndCharacteristics();

    monitorSubscriptions.get(device.id)?.remove();

    const subscription = connectedDevice.monitorCharacteristicForService(
      SERVICE_UUID,
      CHARACTERISTIC_UUID,
      (error, characteristic) => {
        if (error) {
          console.log("MONITOR ERROR:", fallbackDeviceId, error);

          onMessage({
            deviceId: fallbackDeviceId,
            deviceName: advertisedName,
            event: "ble_monitor_error",
            error,
          });

          return;
        }

        if (!characteristic?.value) {
          return;
        }

        try {
          const decoded = Buffer.from(characteristic.value, "base64").toString(
            "utf-8",
          );

          console.log("BLE MESSAGE:", decoded);

          handleBlePayload(
            decoded.trim(),
            fallbackDeviceId,
            advertisedName,
            onMessage,
          );
        } catch (e) {
          console.log("DECODE ERROR:", fallbackDeviceId, e);
        }
      },
    );

    monitorSubscriptions.set(device.id, subscription);
  } catch (e) {
    console.log("BLE CONNECT ERROR:", advertisedName, e);

    connectedDevices.delete(device.id);
    connectingDevices.delete(device.id);

    onMessage({
      deviceId: fallbackDeviceId,
      deviceName: advertisedName,
      event: "ble_connect_error",
      error: e,
    });

    try {
      await connectedDevice?.cancelConnection();
    } catch {}
  }
}

function handleBlePayload(
  decoded: string,
  fallbackDeviceId: string,
  deviceName: string,
  onMessage: BleMessageCallback,
) {
  let deviceId = fallbackDeviceId;
  let payload = decoded;

  const parts = decoded.split("|");

  if (parts.length === 2) {
    deviceId = parts[0] || fallbackDeviceId;
    payload = parts[1];
  }

  if (payload === "S") {
    onMessage({
      deviceId,
      deviceName,
      event: "SCANNING_START",
    });
    return;
  }

  if (payload === "Q") {
    onMessage({
      deviceId,
      deviceName,
      event: "SCANNING_STOP",
    });
    return;
  }

  if (payload.startsWith("BAT:")) {
    const battery = Number(payload.split(":")[1]);

    if (Number.isNaN(battery)) {
      return;
    }

    onMessage({
      deviceId,
      deviceName,
      event: "BATTERY",
      battery,
    });
    return;
  }

  if (payload.startsWith("OK:")) {
    const count = Number(payload.split(":")[1]);

    if (Number.isNaN(count)) {
      return;
    }

    onMessage({
      deviceId,
      deviceName,
      event: "KNOCK_PATTERN_OK",
      count,
    });
    return;
  }

  if (payload === "ERR") {
    onMessage({
      deviceId,
      deviceName,
      event: "TOO_MANY_KNOCKS",
    });
    return;
  }

  console.log("UNKNOWN BLE MESSAGE:", decoded);
}

function getDeviceIdFromName(name: string, fallback: string) {
  if (name.startsWith(DEVICE_NAME_PREFIX)) {
    return name.replace(DEVICE_NAME_PREFIX, "");
  }

  return fallback;
}

export async function disconnectBLE() {
  try {
    console.log("DISCONNECTING BLE");

    manager?.stopDeviceScan();
    isScanning = false;

    monitorSubscriptions.forEach((subscription) => {
      subscription.remove();
    });

    monitorSubscriptions.clear();

    const disconnects = Array.from(connectedDevices.values()).map((device) =>
      device.cancelConnection().catch(() => {}),
    );

    await Promise.all(disconnects);

    connectedDevices.clear();
    connectingDevices.clear();

    manager?.destroy();
    manager = null;

    console.log("BLE DISCONNECTED");
  } catch (e) {
    console.log("DISCONNECT ERROR", e);
  }
}

async function requestBluetoothPermissions() {
  if (Platform.OS !== "android") {
    return true;
  }

  if (Platform.Version < 31) {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );

    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }

  const results = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  ]);

  return (
    results["android.permission.BLUETOOTH_SCAN"] ===
      PermissionsAndroid.RESULTS.GRANTED &&
    results["android.permission.BLUETOOTH_CONNECT"] ===
      PermissionsAndroid.RESULTS.GRANTED &&
    results["android.permission.ACCESS_FINE_LOCATION"] ===
      PermissionsAndroid.RESULTS.GRANTED
  );
}
