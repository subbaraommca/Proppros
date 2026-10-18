import { useQuery } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { Ellipsis, Home, MessageSquare, Wrench } from "lucide-react-native";
import { api } from "../../src/api/client";
import type { ThreadRow } from "../../src/api/types";
import { isStaff, useAuth } from "../../src/auth/AuthContext";
import { TabBar } from "../../src/tabs";

export default function TenantLayout() {
  const { me, org } = useAuth();
  const threads = useQuery({ queryKey: ["portal-threads"], queryFn: () => api.get<ThreadRow[]>("/portal/messages"), enabled: !!me && !isStaff(org), refetchInterval: 60_000 });
  if (!me) return <Redirect href="/login" />;
  if (isStaff(org)) return <Redirect href="/(staff)" />;
  const unread = threads.data?.filter((t) => t.unread).length;
  return (
    <TabBar
      tabs={[
        { name: "index", title: "Home", icon: Home },
        { name: "maintenance", title: "Repairs", icon: Wrench },
        { name: "messages", title: "Messages", icon: MessageSquare, badge: unread },
        { name: "more", title: "More", icon: Ellipsis },
      ]}
    />
  );
}
