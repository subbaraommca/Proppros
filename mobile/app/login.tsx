import { Redirect } from "expo-router";
import { useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { errorMessage } from "../src/api/client";
import { useAuth } from "../src/auth/AuthContext";
import { space } from "../src/theme/tokens";
import { StatusBar } from "expo-status-bar";
import { useAppearance } from "../src/theme/useTheme";
import { BrandMark, Button, Field, Notice, Screen, T } from "../src/ui";

export default function Login() {
  const { scheme } = useAppearance();
  const { me, signIn, verifyMfa } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);
  if (me) return <Redirect href="/" />;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mfaToken) await verifyMfa(mfaToken, code.trim());
      else {
        const r = await signIn(email.trim(), password);
        if (r) setMfaToken(r.mfaToken);
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      footer={
        <Button
          title={busy ? "Signing in…" : mfaToken ? "Verify" : "Sign in"}
          onPress={submit}
          loading={busy}
          disabled={mfaToken ? code.trim().length < 6 : !email || !password}
        />
      }
    >
      <StatusBar style={scheme === "light" ? "dark" : "light"} />
      <View style={{ paddingTop: space.xxl * 2, gap: space.sm, marginBottom: space.lg }}>
        <BrandMark size={36} />
        <T v="eyebrow" style={{ marginTop: space.lg }}>
          Proppros
        </T>
        <T v="title" accessibilityRole="header">
          {mfaToken ? "Two-step verification" : "Sign in"}
        </T>
        <T muted>{mfaToken ? "Enter the 6-digit code from your authenticator app." : "Welcome back to Proppros."}</T>
      </View>
      {error && <Notice>{error}</Notice>}
      {mfaToken ? (
        <Field
          label="Verification code"
          hint="Lost your phone? Enter a recovery code instead."
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          autoFocus
          onSubmitEditing={submit}
        />
      ) : (
        <>
          <Field
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
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
          />
          <T v="small" muted>
            New to Proppros? Create your account at proppros.vercel.app, or use the invitation your landlord sent you.
          </T>
        </>
      )}
      {mfaToken && <Button title="Back" kind="ghost" onPress={() => setMfaToken(null)} />}
    </Screen>
  );
}
