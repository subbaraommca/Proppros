import { useQuery } from "@tanstack/react-query";
import { Redirect } from "expo-router";
import { DollarSign, Ellipsis, LayoutDashboard, MessageSquare, Wrench } from "lucide-react-native";
import { api } from "../../src/api/client";
import { isStaff, useAuth } from "../../src/auth/AuthContext";
import { TabBar } from "../../src/tabs";

export default function StaffLayout() {
  const { me, org } = useAuth();
  const writer = org?.role === "owner" || org?.role === "manager";
  const unread = useQuery({ queryKey: ["unread-count"], queryFn: () => api.get<{ count: number }>("/messages/unread-count"), enabled: !!me && writer, refetchInterval: 60_000 });
  if (!me) return <Redirect href="/welcome" />;
  if (!isStaff(org)) return <Redirect href="/(tenant)" />;
  const finance = org?.role !== "maintenance";
  return (
    <TabBar
      tabs={[
        { name: "index", title: "Home", icon: LayoutDashboard, href: finance ? undefined : null },
        { name: "maintenance", title: "Repairs", icon: Wrench },
        { name: "messages", title: "Messages", icon: MessageSquare, badge: unread.data?.count, href: writer ? undefined : null },
        { name: "money", title: "Money", icon: DollarSign, href: writer ? undefined : null },
        { name: "more", title: "More", icon: Ellipsis },
      ]}
    />
  );
}
