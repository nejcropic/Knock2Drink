import { FlatList } from "react-native";

import EventItem from "./EventItem";

import { KnockEvent } from "../hooks/useKnockEvents";

interface Props {
  events: KnockEvent[];
}

export default function EventList({ events }: Props) {
  return (
    <FlatList
      data={events}
      inverted
      keyExtractor={(item, index) =>
        `${item.timestamp}-${item.event}-${item.count ?? 0}-${index}`
      }
      renderItem={({ item }) => {
        let text = item.event;

        if (item.event === "knock") {
          text = `Knock detected (${item.count})`;
        }

        return <EventItem text={`${item.timestamp}  ${text}`} />;
      }}
    />
  );
}
