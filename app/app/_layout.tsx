import { Buffer } from "buffer";
import { Stack } from "expo-router";
import { OrdersProvider } from "../context/OrdersContext";

global.Buffer = Buffer;

export default function RootLayout() {
  return (
    <OrdersProvider>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </OrdersProvider>
  );
}
