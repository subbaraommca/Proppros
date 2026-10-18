import { Redirect, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { BarChart3, Check, CreditCard, FileText, Megaphone, Users, Wrench } from "lucide-react-native";
import { View } from "react-native";
import { useAuth } from "../src/auth/AuthContext";
import { space } from "../src/theme/tokens";
import { useTheme } from "../src/theme/useTheme";
import { BrandBar, Button, Card, Screen, T } from "../src/ui";

// Same story as the public website (frontend/src/marketing/content.ts): only live features.
const FEATURES = [
  { icon: FileText, title: "Leases with e-signature", body: "Templates, online signing, renewals and move-in inspections." },
  { icon: CreditCard, title: "Rent ledger", body: "Charges post every month. Record payments and see who is behind." },
  { icon: Wrench, title: "Maintenance and vendors", body: "Requests with photos, work orders, vendors and preventive schedules." },
  { icon: Megaphone, title: "Fill your vacancy", body: "A listing page, ready-to-post ads, a QR flyer and online applications." },
  { icon: Users, title: "Tenant portal", body: "Tenants see their lease, balance and documents, and send requests." },
  { icon: BarChart3, title: "Reports", body: "Profit and loss, rent roll and expenses by property, ready to export." },
] as const;

/** First screen for signed-out visitors: what Proppros is, then sign up or sign in. */
export default function Welcome() {
  const t = useTheme();
  const { me } = useAuth();
  if (me) return <Redirect href="/" />;
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <StatusBar style="light" />
      <BrandBar />
      <Screen
        footer={
          <View style={{ gap: space.sm }}>
            <Button title="Start free" onPress={() => router.push("/register")} />
            <Button title="Sign in" kind="secondary" onPress={() => router.push("/login")} />
          </View>
        }
      >
        <View style={{ gap: space.sm, paddingTop: space.lg }}>
          <T v="eyebrow" color={t.accent}>
            Property management for independent landlords
          </T>
          <T v="hero" loud accessibilityRole="header">
            Leases, rent and repairs in one place.
          </T>
          <T muted>Run every rental and fill every vacancy. Track rent, sign leases online, handle repairs and share listings. Your tenants get their own portal.</T>
          <T v="small" muted>
            Start free. No card needed.
          </T>
        </View>

        <Card padded={false}>
          {FEATURES.map(({ icon: Icon, title, body }, i) => (
            <View key={title} style={{ flexDirection: "row", gap: space.md, padding: space.lg, borderTopWidth: i ? 1 : 0, borderTopColor: t.borderSubtle }}>
              <Icon size={20} color={t.accent} strokeWidth={1.6} />
              <View style={{ flex: 1, gap: 2 }}>
                <T v="section">{title}</T>
                <T v="small" muted>
                  {body}
                </T>
              </View>
            </View>
          ))}
        </Card>

        <Card title="Find your next tenant" glow>
          <View style={{ gap: space.sm }}>
            {["A public listing page with photos", "Ready-to-post ad text for listing sites and social media", "A share image and a printable flyer with a QR code", "Online applications, reviewed in one list"].map((line) => (
              <View key={line} style={{ flexDirection: "row", gap: space.sm, alignItems: "flex-start" }}>
                <Check size={16} color={t.jade} style={{ marginTop: 2 }} />
                <T v="small" style={{ flex: 1 }}>
                  {line}
                </T>
              </View>
            ))}
          </View>
        </Card>

        <View style={{ gap: 4, paddingVertical: space.sm }}>
          <T v="section">Built by a landlord.</T>
          <T v="small" muted>
            The founder runs three rental homes with Proppros.
          </T>
        </View>

        <T v="small" muted>
          Are you a tenant? Use the invitation your landlord sent you, then sign in.
        </T>
      </Screen>
    </View>
  );
}
