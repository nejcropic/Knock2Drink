import { FlatList, StyleSheet, Text, View } from "react-native";
import { useOrders } from "../../context/OrdersContext";
import { COLORS } from "../../theme/colors";

export default function HistoryScreen() {
  const { history } = useOrders();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Order History</Text>
      <Text style={styles.subtitle}>Accepted knock orders</Text>

      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 120 }}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptyText}>
              Accepted knock orders will appear here.
            </Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <View style={[styles.card, index === 0 && styles.latestCard]}>
            <View style={styles.left}>
              <View style={styles.iconCircle}>
                <Text style={styles.icon}>🍺</Text>
              </View>

              <View>
                <Text style={styles.item}>{item.item}</Text>
                <Text style={styles.meta}>{item.knocks} knocks</Text>
              </View>
            </View>

            <Text style={styles.time}>
              {new Date(item.timestamp).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>
        )}
      />
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

  title: {
    color: COLORS.text,
    fontSize: 34,
    fontWeight: "900",
  },

  subtitle: {
    color: COLORS.subtext,
    marginTop: 6,
    marginBottom: 24,
    fontSize: 16,
  },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  latestCard: {
    borderColor: COLORS.green,
    shadowColor: COLORS.green,
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 8,
  },

  left: {
    flexDirection: "row",
    alignItems: "center",
  },

  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: COLORS.glow,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  icon: {
    fontSize: 22,
  },

  item: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "800",
  },

  meta: {
    color: COLORS.subtext,
    marginTop: 4,
  },

  time: {
    color: COLORS.subtext,
    fontSize: 13,
  },

  emptyCard: {
    marginTop: 40,
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 26,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  emptyTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "800",
  },

  emptyText: {
    color: COLORS.subtext,
    textAlign: "center",
    marginTop: 8,
  },
});
