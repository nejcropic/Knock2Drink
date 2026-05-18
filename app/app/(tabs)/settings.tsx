import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useOrders } from "../../context/OrdersContext";
import { COLORS } from "../../theme/colors";

export default function SettingsScreen() {
  const { mappings, setMapping } = useOrders();

  const knockOptions = [3, 4, 5, 6];

  return (
    <KeyboardAvoidingView
      style={styles.wrapper}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Settings</Text>

        <Text style={styles.subtitle}>Map knock count to order items</Text>

        {knockOptions.map((knocks) => (
          <View key={knocks} style={styles.mappingCard}>
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.mappingTitle}>{knocks} knocks</Text>

                <Text style={styles.mappingSub}>Customer order</Text>
              </View>
            </View>

            <TextInput
              style={styles.input}
              value={mappings[knocks] || ""}
              onChangeText={(text) => setMapping(knocks, text)}
              placeholder="Item"
              placeholderTextColor="#666"
            />
          </View>
        ))}

        <Pressable style={styles.infoCard}>
          <Text style={styles.infoTitle}>Tip</Text>

          <Text style={styles.infoText}>
            Example: 3 knocks = Beer, 4 knocks = Juice, 5 knocks = Water.
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 76,
    paddingBottom: 120,
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

  mappingCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  headerRow: {
    marginBottom: 12,
  },

  mappingTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "800",
  },

  mappingSub: {
    color: COLORS.subtext,
    marginTop: 4,
  },

  input: {
    backgroundColor: "#0f0f0f",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: COLORS.text,
    fontSize: 17,
  },

  infoCard: {
    backgroundColor: COLORS.glow,
    borderRadius: 22,
    padding: 18,
    marginTop: 12,
  },

  infoTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
  },

  infoText: {
    color: COLORS.text,
    marginTop: 6,
    lineHeight: 21,
  },
});
