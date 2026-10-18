import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import { Alert, Platform } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { label } from "../format";
import { useTheme } from "../theme/useTheme";
import { Badge, Button, Card, Row, Screen, T } from "../ui";

const WEB = "https://proppros.vercel.app";

export function MoreScreen() {
  const t = useTheme();
  const { me, org, switchOrg, signOut } = useAuth();
  const confirmSignOut = () => {
    if (Platform.OS === "web") return void signOut();
    Alert.alert("Sign out?", "You'll stop getting notifications on this phone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => void signOut() },
    ]);
  };
  return (
    <Screen>
      <Card padded={false}>
        <Row first title={me?.name ?? ""} meta={me?.email} />
      </Card>
      {(me?.organizations.length ?? 0) > 1 && (
        <Card title="Switch portfolio" padded={false}>
          {me!.organizations.map((o, i) => (
            <Row key={o.id} first={i === 0} title={o.name} meta={label(o.role)} right={o.id === org?.id ? <Badge value="active" text="Current" /> : undefined} onPress={o.id === org?.id ? undefined : () => void switchOrg(o.id)} />
          ))}
        </Card>
      )}
      <Card padded={false}>
        <Row first title="Open Proppros on the web" meta="Leases, reports, documents and settings" onPress={() => void WebBrowser.openBrowserAsync(WEB)} />
        <Row title="Help center" onPress={() => void WebBrowser.openBrowserAsync(`${WEB}/help`)} />
        <Row title="Privacy policy" onPress={() => void WebBrowser.openBrowserAsync(`${WEB}/privacy`)} />
      </Card>
      <Button kind="danger" title="Sign out" onPress={confirmSignOut} />
      <T v="small" muted style={{ textAlign: "center" }}>
        Proppros {Constants.expoConfig?.version ?? ""}
      </T>
      <T v="small" color={t.textMuted} style={{ textAlign: "center" }}>
        {org ? `${org.name} · ${label(org.role)}` : ""}
      </T>
    </Screen>
  );
}
