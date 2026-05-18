import { Buffer } from "buffer";
import { PermissionsAndroid, Platform } from "react-native";
import { BleManager, Device, Subscription } from "react-native-ble-plx";

const DEVICE_NAME = "Knock2Drink";

const SERVICE_UUID = "12345678-1234-1234-1234-1234567890ab";

const CHARACTERISTIC_UUID = "abcdefab-1234-5678-1234-abcdefabcdef";

let manager: BleManager | null = null;

let connectedDevice: Device | null = null;

let monitorSubscription: Subscription | null = null;

let isConnecting = false;

export async function connectBLE(onMessage: (msg: any) => void) {
  try {
    const granted = await requestBluetoothPermissions();

    if (!granted) {
      console.log("BLE permissions denied");

      onMessage({
        event: "ble_permission_denied",
      });

      return;
    }

    if (!manager) {
      manager = new BleManager();
    }

    console.log("STARTING BLE SCAN");

    onMessage({
      event: "SCANNING_START",
    });

    manager.startDeviceScan(
      null,
      {
        allowDuplicates: false,
      },
      async (error, device) => {
        if (error) {
          console.log("SCAN ERROR", error);

          onMessage({
            event: "ble_error",
            error,
          });

          return;
        }

        if (!device) {
          return;
        }

        const name = device.name || device.localName;

        console.log("FOUND DEVICE:", name);

        if (name !== DEVICE_NAME) {
          return;
        }

        if (isConnecting || connectedDevice) {
          return;
        }

        isConnecting = true;

        console.log("CONNECTING TO DEVICE");

        manager?.stopDeviceScan();

        onMessage({
          event: "SCANNING_STOP",
        });

        try {
          connectedDevice = await device.connect();

          console.log("CONNECTED");

          connectedDevice.onDisconnected((error) => {
            console.log("DEVICE DISCONNECTED", error);

            monitorSubscription?.remove();
            monitorSubscription = null;

            connectedDevice = null;

            isConnecting = false;

            onMessage({
              event: "ble_disconnected",
            });
          });

          // Small delay helps some BLE devices
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Android only
          if (Platform.OS === "android") {
            try {
              await connectedDevice.requestMTU(128);

              console.log("MTU REQUESTED");
            } catch (e) {
              console.log("MTU ERROR", e);
            }
          }

          await connectedDevice.discoverAllServicesAndCharacteristics();

          console.log("DISCOVERED SERVICES");

          monitorSubscription?.remove();

          monitorSubscription = connectedDevice.monitorCharacteristicForService(
            SERVICE_UUID,
            CHARACTERISTIC_UUID,
            (error, characteristic) => {
              if (error) {
                console.log("MONITOR ERROR", error);

                onMessage({
                  event: "ble_monitor_error",
                  error,
                });

                return;
              }

              if (!characteristic?.value) {
                return;
              }

              try {
                const decoded = Buffer.from(
                  characteristic.value,
                  "base64",
                ).toString("utf-8");

                console.log("BLE MESSAGE:", decoded);

                // Example:
                // KNOCK:3
                if (decoded.startsWith("KNOCK:")) {
                  const count = Number(decoded.split(":")[1]);

                  onMessage({
                    event: "knock",
                    count,
                  });

                  return;
                }

                // Generic events:
                // SCANNING_START
                // SCANNING_STOP
                // KNOCK_PATTERN_OK
                onMessage({
                  event: decoded,
                });
              } catch (e) {
                console.log("DECODE ERROR", e);
              }
            },
          );

          onMessage({
            event: "ble_connected",
          });

          isConnecting = false;
        } catch (e) {
          console.log("BLE CONNECT ERROR", e);

          onMessage({
            event: "ble_connect_error",
            error: e,
          });

          try {
            await connectedDevice?.cancelConnection();
          } catch {}

          connectedDevice = null;

          isConnecting = false;
        }
      },
    );
  } catch (e) {
    console.log("BLE INIT ERROR", e);

    onMessage({
      event: "ble_init_error",
      error: e,
    });
  }
}

export async function disconnectBLE() {
  try {
    console.log("DISCONNECTING BLE");

    manager?.stopDeviceScan();

    monitorSubscription?.remove();
    monitorSubscription = null;

    if (connectedDevice) {
      await connectedDevice.cancelConnection();
    }

    connectedDevice = null;

    manager?.destroy();
    manager = null;

    isConnecting = false;

    console.log("BLE DISCONNECTED");
  } catch (e) {
    console.log("DISCONNECT ERROR", e);
  }
}

async function requestBluetoothPermissions() {
  if (Platform.OS !== "android") {
    return true;
  }

  // Android < 12
  if (Platform.Version < 31) {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );

    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }

  // Android 12+
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
