import React from "react";

import { Text, View } from "react-native";

interface Props {
  text: string;
}

function EventItem({ text }: Props) {
  return (
    <View
      style={{
        backgroundColor: "#1d1d1d",
        padding: 14,
        borderRadius: 14,
        marginBottom: 10,
      }}
    >
      <Text
        style={{
          color: "white",
          fontSize: 16,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

export default React.memo(EventItem);
