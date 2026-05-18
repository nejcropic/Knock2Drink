import React, { createContext, useContext, useEffect, useState } from "react";

import AsyncStorage from "@react-native-async-storage/async-storage";

export type OrderItem = {
  id: string;
  knocks: number;
  item: string;
  timestamp: number;
};

type MappingType = {
  [key: number]: string;
};

type OrdersContextType = {
  history: OrderItem[];

  mappings: MappingType;

  addOrder: (knocks: number) => void;

  setMapping: (knocks: number, item: string) => void;
};

const OrdersContext = createContext<OrdersContextType | null>(null);

const HISTORY_KEY = "ORDER_HISTORY";
const MAPPINGS_KEY = "ORDER_MAPPINGS";

export function OrdersProvider({ children }: { children: React.ReactNode }) {
  const [history, setHistory] = useState<OrderItem[]>([]);

  const [mappings, setMappings] = useState<MappingType>({
    3: "Beer",
    4: "Juice",
    5: "Water",
  });

  // LOAD STORAGE
  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const historyRaw = await AsyncStorage.getItem(HISTORY_KEY);

      const mappingsRaw = await AsyncStorage.getItem(MAPPINGS_KEY);

      if (historyRaw) {
        setHistory(JSON.parse(historyRaw));
      }

      if (mappingsRaw) {
        setMappings(JSON.parse(mappingsRaw));
      }
    } catch (err) {
      console.log(err);
    }
  }

  // SAVE HISTORY
  useEffect(() => {
    AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  // SAVE MAPPINGS
  useEffect(() => {
    AsyncStorage.setItem(MAPPINGS_KEY, JSON.stringify(mappings));
  }, [mappings]);

  function addOrder(knocks: number) {
    const item = mappings[knocks] || "Unknown";

    const newOrder: OrderItem = {
      id: Date.now().toString(),
      knocks,
      item,
      timestamp: Date.now(),
    };

    setHistory((prev) => [newOrder, ...prev]);
  }

  function setMapping(knocks: number, item: string) {
    setMappings((prev) => ({
      ...prev,
      [knocks]: item,
    }));
  }

  return (
    <OrdersContext.Provider
      value={{
        history,
        mappings,
        addOrder,
        setMapping,
      }}
    >
      {children}
    </OrdersContext.Provider>
  );
}

export function useOrders() {
  const ctx = useContext(OrdersContext);

  if (!ctx) {
    throw new Error("useOrders must be inside OrdersProvider");
  }

  return ctx;
}
