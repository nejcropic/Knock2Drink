import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";

import { connectBLE, disconnectBLE } from "../../services/ble";

import { useOrders } from "../../context/OrdersContext";
import { COLORS } from "../../theme/colors";

export default function LiveScreen() {
  const [popupVisible, setPopupVisible] = useState(false);
  const [currentKnocks, setCurrentKnocks] = useState(0);
  const [connected, setConnected] = useState(false);

  const popupVisibleRef = useRef(false);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  const { addOrder, mappings, history } = useOrders();

  async function onKnockDetected(knocks: number) {
    if (knocks < 3) return;

    if (popupVisibleRef.current) return;

    popupVisibleRef.current = true;

    setCurrentKnocks(knocks);

    setPopupVisible(true);

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    timeoutRef.current = setTimeout(() => {
      closePopup();
    }, 10000);
  }

  function closePopup() {
    popupVisibleRef.current = false;

    setPopupVisible(false);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);

      timeoutRef.current = null;
    }
  }

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),

        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  useEffect(() => {
    connectBLE((msg) => {
      console.log("BLE EVENT:", msg);

      switch (msg.event) {
        case "ble_connected":
          console.log("BLE connected");

          setConnected(true);

          break;

        case "ble_disconnected":
          console.log("BLE disconnected");

          setConnected(false);

          break;

        case "ble_connect_error":
          console.log("BLE connect error");

          setConnected(false);

          break;

        case "SCANNING_START":
          console.log("Scanning started");

          break;

        case "SCANNING_STOP":
          console.log("Scanning stopped");

          break;

        case "KNOCK_PATTERN_OK":
          console.log("Pattern OK");

          break;

        case "knock":
          if (typeof msg.count === "number") {
            console.log("Knock detected:", msg.count);

            onKnockDetected(msg.count);
          }

          break;

        default:
          console.log("UNKNOWN BLE EVENT:", msg.event);

          break;
      }
    });

    return () => {
      disconnectBLE();

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>
          Knock<Text style={styles.logoGreen}>2Drink</Text>
        </Text>

        <View style={styles.liveBadge}>
          <View
            style={[
              styles.liveDot,
              {
                backgroundColor: connected ? COLORS.green : COLORS.red,
              },
            ]}
          />

          <Text style={styles.liveText}>{connected ? "Live" : "Offline"}</Text>
        </View>
      </View>

      <LinearGradient colors={["#1b1b1b", "#101010"]} style={styles.mainCard}>
        <Animated.View
          style={{
            transform: [{ scale: pulseAnim }],
          }}
        >
          <View style={styles.iconCircle}>
            <Text style={styles.bell}>🔔</Text>
          </View>
        </Animated.View>

        <Text style={styles.detectedText}>Waiting for knocks...</Text>

        <Text style={styles.subText}>
          Custom knock orders with real-time mobile alerts.
        </Text>

        <View style={styles.statsRow}>
          <View style={styles.smallStat}>
            <Text style={styles.statValue}>{history.length}</Text>

            <Text style={styles.statLabel}>Orders</Text>
          </View>

          <View style={styles.smallStat}>
            <Text style={styles.statValue}>{connected ? "ON" : "OFF"}</Text>

            <Text style={styles.statLabel}>BLE</Text>
          </View>
        </View>
      </LinearGradient>

      <Pressable style={styles.testButton} onPress={() => onKnockDetected(3)}>
        <Text style={styles.testButtonText}>Simulate 3 knocks</Text>
      </Pressable>

      <Modal transparent visible={popupVisible} animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.popup}>
            <View style={styles.popupIcon}>
              <Text style={styles.popupBell}>🔔</Text>
            </View>

            <Text style={styles.popupTitle}>
              {currentKnocks} knocks detected
            </Text>

            <Text style={styles.popupText}>
              Order:{" "}
              <Text style={styles.orderName}>
                {mappings[currentKnocks] || "Unknown"}
              </Text>
            </Text>

            <View style={styles.row}>
              <Pressable style={styles.declineButton} onPress={closePopup}>
                <Text style={styles.buttonText}>DECLINE</Text>
              </Pressable>

              <Pressable
                style={styles.acceptButton}
                onPress={() => {
                  addOrder(currentKnocks);

                  closePopup();
                }}
              >
                <Text style={styles.buttonText}>ACCEPT</Text>
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
    paddingHorizontal: 20,
    paddingTop: 76,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 30,
  },

  logo: {
    color: COLORS.text,
    fontSize: 34,
    fontWeight: "900",
  },

  logoGreen: {
    color: COLORS.green,
  },

  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  liveDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    marginRight: 8,
  },

  liveText: {
    color: COLORS.text,
    fontWeight: "700",
  },

  mainCard: {
    borderRadius: 30,
    padding: 30,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.green,
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },

  iconCircle: {
    width: 110,
    height: 110,
    borderRadius: 999,
    backgroundColor: COLORS.glow,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },

  bell: {
    fontSize: 46,
  },

  detectedText: {
    color: COLORS.text,
    fontSize: 25,
    fontWeight: "800",
    textAlign: "center",
  },

  subText: {
    color: COLORS.subtext,
    textAlign: "center",
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
  },

  statsRow: {
    flexDirection: "row",
    marginTop: 28,
    gap: 14,
  },

  smallStat: {
    backgroundColor: "#111",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
  },

  statValue: {
    color: COLORS.green,
    fontSize: 24,
    fontWeight: "900",
  },

  statLabel: {
    color: COLORS.subtext,
    marginTop: 4,
  },

  testButton: {
    marginTop: 28,
    backgroundColor: COLORS.green,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
  },

  testButtonText: {
    color: COLORS.text,
    fontWeight: "800",
    fontSize: 17,
  },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.82)",
    justifyContent: "center",
    alignItems: "center",
  },

  popup: {
    width: 340,
    backgroundColor: COLORS.card,
    borderRadius: 30,
    padding: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  popupIcon: {
    alignSelf: "center",
    backgroundColor: COLORS.glow,
    width: 76,
    height: 76,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  popupBell: {
    fontSize: 34,
  },

  popupTitle: {
    color: COLORS.text,
    fontSize: 27,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 12,
  },

  popupText: {
    color: COLORS.subtext,
    textAlign: "center",
    fontSize: 20,
    marginBottom: 28,
  },

  orderName: {
    color: COLORS.green,
    fontWeight: "900",
  },

  row: {
    flexDirection: "row",
    gap: 12,
  },

  declineButton: {
    flex: 1,
    backgroundColor: COLORS.red,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },

  acceptButton: {
    flex: 1,
    backgroundColor: COLORS.green,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },

  buttonText: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 15,
  },
});
