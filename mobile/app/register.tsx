import { Redirect, router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { StatusBar } from "expo-status-bar";
import { useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { api, errorMessage } from "../src/api/client";
import { useAuth } from "../src/auth/AuthContext";
import { space } from "../src/theme/tokens";
import { useAppearance } from "../src/theme/useTheme";
import { BrandMark, Button, Field, Notice, Screen, T } from "../src/ui";

const WEB = "https://proppros.vercel.app";

/** Create a free landlord account (same API as the web sign-up), then sign in with a mobile token. */
export default function Register() {
  const { scheme } = useAppearance();
  const { me, signIn } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  if (me) return <Redirect href="/" />;

  const tooShort = password.length > 0 && password.length < 10;
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post("/auth/register", { name: name.trim(), email: email.trim(), password });
      const r = await signIn(email.trim(), password);
      if (r) router.replace("/login"); // two-step sign-in cannot be on yet for a new account; fall back to sign-in
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      footer={
        <View style={{ gap: space.sm }}>
          <Button title={busy ? "Creating your account…" : "Create free account"} onPress={submit} loading={busy} disabled={!name.trim() || !email.trim() || password.length < 10} />
          <Button title="I already have an account" kind="ghost" onPress={() => router.replace("/login")} />
        </View>
      }
    >
      <StatusBar style={scheme === "light" ? "dark" : "light"} />
      <View style={{ paddingTop: space.xxl * 2, gap: space.sm, marginBottom: space.lg }}>
        <BrandMark size={36} />
        <T v="eyebrow" style={{ marginTop: space.lg }}>
          Proppros
        </T>
        <T v="title" accessibilityRole="header">
          Start free
        </T>
        <T muted>Create your landlord account. No card needed.</T>
      </View>
      {error && <Notice>{error}</Notice>}
      <Field label="Your name" value={name} onChangeText={setName} autoComplete="name" textContentType="name" returnKeyType="next" onSubmitEditing={() => emailRef.current?.focus()} />
      <Field
        ref={emailRef}
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="username"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <Field
        ref={passwordRef}
        label="Password"
        hint="At least 10 characters, with a number or a symbol."
        error={tooShort ? "Use at least 10 characters." : undefined}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <T v="small" muted>
        By creating an account you agree to the Terms and the Privacy policy.
      </T>
      <View style={{ flexDirection: "row", gap: space.sm }}>
        <Button title="Terms" kind="ghost" onPress={() => void WebBrowser.openBrowserAsync(`${WEB}/terms`)} />
        <Button title="Privacy" kind="ghost" onPress={() => void WebBrowser.openBrowserAsync(`${WEB}/privacy`)} />
      </View>
    </Screen>
  );
}
