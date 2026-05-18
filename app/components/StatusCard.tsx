import { Text, View } from "react-native";

interface Props {
  status: string;
}

export default function StatusCard({ status }: Props) {
  return (
    <View
      style={{
        backgroundColor: "#181818",
        padding: 20,
        borderRadius: 20,
        marginTop: 20,
      }}
    >
      <Text
        style={{
          color: "#888",
          fontSize: 16,
        }}
      >
        Device Status
      </Text>

      <Text
        style={{
          color: "#00c8ff",
          fontSize: 28,
          marginTop: 10,
          fontWeight: "bold",
        }}
      >
        {status}
      </Text>
    </View>
  );
}
