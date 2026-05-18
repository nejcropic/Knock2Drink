import { StyleSheet, Text, View } from "react-native";
import { useOrders } from "../../context/OrdersContext";
import { COLORS } from "../../theme/colors";

export default function StatsScreen() {
  const { history } = useOrders();

  const totalOrders = history.length;

  const today = new Date().toDateString();

  const ordersToday = history.filter(
    (order) => new Date(order.timestamp).toDateString() === today,
  ).length;

  const averageKnocks =
    history.length === 0
      ? 0
      : history.reduce((sum, order) => sum + order.knocks, 0) / history.length;

  const itemCounts: Record<string, number> = {};

  history.forEach((order) => {
    itemCounts[order.item] = (itemCounts[order.item] || 0) + 1;
  });

  const topItem =
    Object.entries(itemCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "None";

  const topEntries = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Statistics</Text>
      <Text style={styles.subtitle}>Order analytics</Text>

      <View style={styles.grid}>
        <View style={styles.card}>
          <Text style={styles.label}>Total Orders</Text>
          <Text style={styles.value}>{totalOrders}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Today</Text>
          <Text style={styles.value}>{ordersToday}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Top Item</Text>
          <Text style={styles.valueSmall}>{topItem}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Avg. Knocks</Text>
          <Text style={styles.value}>{averageKnocks.toFixed(1)}</Text>
        </View>
      </View>

      <View style={styles.listCard}>
        <Text style={styles.sectionTitle}>Most Ordered</Text>

        {topEntries.length === 0 ? (
          <Text style={styles.emptyText}>No order data yet.</Text>
        ) : (
          topEntries.map(([item, count]) => (
            <View key={item} style={styles.rankRow}>
              <Text style={styles.rankItem}>{item}</Text>
              <View style={styles.rankRight}>
                <View
                  style={[
                    styles.rankBar,
                    {
                      width: Math.max(40, count * 30),
                    },
                  ]}
                />
                <Text style={styles.rankCount}>{count}</Text>
              </View>
            </View>
          ))
        )}
      </View>
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

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
  },

  card: {
    width: "47%",
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  label: {
    color: COLORS.subtext,
    fontSize: 14,
  },

  value: {
    color: COLORS.green,
    fontSize: 34,
    fontWeight: "900",
    marginTop: 8,
  },

  valueSmall: {
    color: COLORS.green,
    fontSize: 22,
    fontWeight: "900",
    marginTop: 12,
  },

  listCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 24,
  },

  sectionTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 16,
  },

  emptyText: {
    color: COLORS.subtext,
  },

  rankRow: {
    marginBottom: 16,
  },

  rankItem: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 8,
  },

  rankRight: {
    flexDirection: "row",
    alignItems: "center",
  },

  rankBar: {
    height: 10,
    borderRadius: 999,
    backgroundColor: COLORS.green,
    marginRight: 10,
  },

  rankCount: {
    color: COLORS.subtext,
    fontWeight: "700",
  },
});
