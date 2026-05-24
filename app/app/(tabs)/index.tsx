import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";

import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { connectBLE, disconnectBLE } from "../../services/ble";

import { useOrders } from "../../context/OrdersContext";

import { COLORS } from "../../theme/colors";

type DeviceState = {
  connected: boolean;
  knocks: number;
  status: string;
  name: string;
  battery: number;
};

export default function HomeScreen() {
  const { addOrder, mappings } = useOrders();

  const [devices, setDevices] = useState<Record<string, DeviceState>>({});

  const [popupVisible, setPopupVisible] = useState(false);

  const [currentKnocks, setCurrentKnocks] = useState(0);

  const [currentDeviceId, setCurrentDeviceId] = useState("");

  useEffect(() => {
    connectBLE((msg) => {
      console.log("BLE EVENT:", msg);

      switch (msg.event) {
        case "ble_connected":
          updateDevice(
            msg.deviceId,
            {
              connected: true,
              status: "CONNECTED",
            },
            msg.deviceName,
          );
          break;

        case "ble_reconnecting":
          updateDevice(
            msg.deviceId,
            {
              connected: false,
              status: "RECONNECTING",
            },
            msg.deviceName,
          );

          break;

        case "ble_disconnected":
          updateDevice(msg.deviceId, {
            connected: false,
            status: "DISCONNECTED",
          });

          break;

        case "SCANNING_START":
          updateDevice(msg.deviceId, {
            status: "SCANNING",
          });

          break;

        case "SCANNING_STOP":
          updateDevice(
            msg.deviceId,
            {
              status: "TIMEOUT",
              knocks: 0,
            },
            msg.deviceName,
          );

          resetDeviceLater(msg.deviceId);

          break;

        case "knock":
          updateDevice(msg.deviceId, {
            knocks: msg.count,
          });

          onKnockDetected(msg.deviceId, msg.count);

          break;

        case "KNOCK_PATTERN_OK":
          updateDevice(
            msg.deviceId,
            {
              status: "ORDER READY",
              knocks: msg.count,
            },
            msg.deviceName,
          );

          onKnockDetected(msg.deviceId, msg.count);

          break;
        case "TOO_MANY_KNOCKS":
          updateDevice(
            msg.deviceId,
            {
              status: "TOO MANY KNOCKS",
              knocks: 0,
            },
            msg.deviceName,
          );

          resetDeviceLater(msg.deviceId);

          break;
        case "BATTERY":
          updateDevice(
            msg.deviceId,
            {
              battery: msg.battery,
            },
            msg.deviceName,
          );

          break;
      }
    });

    return () => {
      disconnectBLE();
    };
  }, []);

  function updateDevice(
    deviceId: string,
    updates: Partial<DeviceState>,
    deviceName?: string,
  ) {
    setDevices((prev) => ({
      ...prev,

      [deviceId]: {
        connected: prev[deviceId]?.connected || false,

        knocks: prev[deviceId]?.knocks || 0,

        status: prev[deviceId]?.status || "IDLE",

        battery: prev[deviceId]?.battery || 0,

        name: deviceName || prev[deviceId]?.name || deviceId,

        ...updates,
      },
    }));
  }

  function resetDeviceLater(deviceId: string) {
    setTimeout(() => {
      updateDevice(deviceId, {
        status: "IDLE",
        knocks: 0,
      });
    }, 2500);
  }

  async function onKnockDetected(deviceId: string, knocks: number) {
    setCurrentKnocks(knocks);

    setCurrentDeviceId(deviceId);

    setPopupVisible(true);
  }

  const connectedCount = Object.values(devices).filter(
    (d) => d.connected,
  ).length;

  const activeCount = Object.values(devices).filter(
    (d) => d.status === "SCANNING",
  ).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Knock2Drink</Text>

          <Text style={styles.headerSubtitle}>Smart knock ordering</Text>
        </View>

        <View style={styles.liveBadge}>
          <View
            style={[
              styles.liveDot,
              {
                backgroundColor: connectedCount > 0 ? COLORS.green : COLORS.red,
              },
            ]}
          />

          <Text style={styles.liveText}>
            {connectedCount > 0 ? `${connectedCount} Live` : "Offline"}
          </Text>
        </View>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.heroTitle}>Restaurant Dashboard</Text>

            <Text style={styles.heroSubtitle}>
              Multi-table knock ordering system
            </Text>
          </View>

          <View style={styles.bellContainer}>
            <Ionicons name="notifications" size={34} color={COLORS.green} />
          </View>
        </View>

        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{connectedCount}</Text>

            <Text style={styles.heroStatLabel}>Connected</Text>
          </View>

          <View style={styles.heroDivider} />

          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{activeCount}</Text>

            <Text style={styles.heroStatLabel}>Active</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.devicesContainer}>
          {Object.entries(devices).length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="bluetooth" size={42} color={COLORS.green} />

              <Text style={styles.emptyTitle}>No devices connected</Text>

              <Text style={styles.emptyText}>
                Waiting for Knock2Drink BLE devices...
              </Text>
            </View>
          ) : (
            Object.entries(devices).map(([id, device]) => (
              <View
                key={id}
                style={[
                  styles.deviceCard,

                  device.status === "SCANNING" && styles.deviceCardScanning,

                  device.knocks >= 3 && styles.deviceCardAlert,
                ]}
              >
                <View style={styles.deviceTop}>
                  <View style={styles.deviceLeft}>
                    <View style={styles.deviceIcon}>
                      <Ionicons
                        name="restaurant"
                        size={20}
                        color={COLORS.green}
                      />
                    </View>

                    <View>
                      <Text style={styles.deviceName}>{device.name}</Text>

                      <Text style={styles.deviceMode}>{device.status}</Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.deviceStatusDot,
                      {
                        backgroundColor: device.connected
                          ? COLORS.green
                          : COLORS.red,
                      },
                    ]}
                  />
                </View>
                <View style={styles.knockRow}>
                  <Ionicons
                    name="radio-button-on"
                    size={18}
                    color={COLORS.green}
                  />

                  <Text style={styles.deviceKnocks}>
                    {device.knocks} knocks
                  </Text>
                </View>
                <View style={styles.batteryRow}>
                  <Ionicons
                    name="battery-half"
                    size={16}
                    color={COLORS.subtext}
                  />

                  <Text style={styles.batteryText}>{device.battery}%</Text>
                </View>
                {!!mappings[device.knocks] && (
                  <View style={styles.orderBadgeGlow}>
                    <View style={styles.orderBadge}>
                      <Text style={styles.orderBadgeText}>
                        {mappings[device.knocks]}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal visible={popupVisible} transparent animationType="fade">
        <View style={styles.popupOverlay}>
          <View style={styles.popup}>
            <View style={styles.popupIcon}>
              <Ionicons name="notifications" size={34} color={COLORS.green} />
            </View>

            <Text style={styles.popupTitle}>Knock detected</Text>

            <Text style={styles.popupDevice}>{currentDeviceId}</Text>

            <Text style={styles.popupKnocks}>{currentKnocks} knocks</Text>

            <Text style={styles.popupOrder}>
              {mappings[currentKnocks] || "Unknown order"}
            </Text>

            <View style={styles.popupButtons}>
              <Pressable
                style={[styles.popupButton, styles.rejectButton]}
                onPress={() => {
                  updateDevice(currentDeviceId, {
                    status: "ORDER REJECTED",
                    knocks: 0,
                  });

                  setPopupVisible(false);

                  resetDeviceLater(currentDeviceId);
                }}
              >
                <Text style={styles.popupButtonText}>Reject</Text>
              </Pressable>

              <Pressable
                style={[styles.popupButton, styles.acceptButton]}
                onPress={() => {
                  addOrder(currentDeviceId, currentKnocks);

                  updateDevice(currentDeviceId, {
                    status: "ORDER ACCEPTED",
                    knocks: 0,
                  });

                  setPopupVisible(false);

                  resetDeviceLater(currentDeviceId);
                }}
              >
                <Text style={styles.popupButtonText}>Accept</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingTop: 72,
  },

  header: {
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  headerTitle: {
    color: COLORS.text,
    fontSize: 34,
    fontWeight: "900",
  },

  headerSubtitle: {
    color: COLORS.subtext,
    marginTop: 4,
    fontSize: 15,
  },

  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginRight: 8,
  },

  liveText: {
    color: COLORS.text,
    fontWeight: "700",
  },

  heroCard: {
    marginTop: 24,
    marginHorizontal: 20,
    backgroundColor: COLORS.card,
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.green,
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 10,
  },

  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  heroTitle: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "900",
  },

  heroSubtitle: {
    color: COLORS.subtext,
    marginTop: 8,
    fontSize: 15,
  },

  bellContainer: {
    width: 72,
    height: 72,
    borderRadius: 999,
    backgroundColor: COLORS.glow,
    alignItems: "center",
    justifyContent: "center",
  },

  heroStats: {
    flexDirection: "row",
    marginTop: 28,
    alignItems: "center",
  },

  heroStat: {
    flex: 1,
  },

  heroStatValue: {
    color: COLORS.green,
    fontSize: 30,
    fontWeight: "900",
  },

  heroStatLabel: {
    color: COLORS.subtext,
    marginTop: 4,
  },

  heroDivider: {
    width: 1,
    height: 46,
    backgroundColor: COLORS.border,
  },

  scroll: {
    flex: 1,
    marginTop: 20,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },

  devicesContainer: {
    gap: 14,
  },

  deviceCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  deviceCardScanning: {
    borderColor: COLORS.green,
  },

  deviceCardAlert: {
    shadowColor: COLORS.green,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },

  deviceTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  deviceLeft: {
    flexDirection: "row",
    alignItems: "center",
  },

  deviceIcon: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: COLORS.glow,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  deviceName: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "800",
  },

  deviceMode: {
    color: COLORS.subtext,
    marginTop: 4,
  },

  deviceStatusDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
  },

  knockRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
  },

  deviceKnocks: {
    color: COLORS.green,
    marginLeft: 8,
    fontWeight: "800",
    fontSize: 18,
  },

  orderBadgeGlow: {
    alignSelf: "flex-start",
    marginTop: 14,
    shadowColor: COLORS.green,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },

  orderBadge: {
    backgroundColor: COLORS.glow,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },

  orderBadgeText: {
    color: COLORS.green,
    fontWeight: "800",
  },

  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  emptyTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "800",
    marginTop: 16,
  },

  emptyText: {
    color: COLORS.subtext,
    textAlign: "center",
    marginTop: 10,
  },

  popupOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },

  popup: {
    width: "100%",
    backgroundColor: COLORS.card,
    borderRadius: 28,
    padding: 26,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  popupIcon: {
    width: 76,
    height: 76,
    borderRadius: 999,
    backgroundColor: COLORS.glow,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
  },

  popupTitle: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 18,
  },

  popupDevice: {
    color: COLORS.green,
    textAlign: "center",
    marginTop: 8,
    fontWeight: "700",
  },

  popupKnocks: {
    color: COLORS.text,
    fontSize: 46,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 18,
  },

  popupOrder: {
    color: COLORS.subtext,
    textAlign: "center",
    marginTop: 10,
    fontSize: 18,
  },

  popupButtons: {
    flexDirection: "row",
    marginTop: 28,
    gap: 12,
  },

  popupButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: "center",
  },

  rejectButton: {
    backgroundColor: "#2a1212",
  },

  acceptButton: {
    backgroundColor: COLORS.green,
  },

  popupButtonText: {
    color: COLORS.text,
    fontWeight: "800",
    fontSize: 16,
  },
  batteryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },

  batteryText: {
    color: COLORS.subtext,
    marginLeft: 6,
    fontSize: 13,
    fontWeight: "700",
  },
});
