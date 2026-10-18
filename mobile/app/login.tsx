import { Redirect } from "expo-router";
import { Home } from "lucide-react-native";
import { useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { errorMessage } from "../src/api/client";
import { useAuth } from "../src/auth/AuthContext";
import { space } from "../src/theme/tokens";
import { useTheme } from "../src/theme/useTheme";
import { Button, Field, Notice, Screen, T } from "../src/ui";

export default function Login() {
  const t = useTheme();
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
      <View style={{ paddingTop: space.xxl * 1.5, gap: space.sm, marginBottom: space.lg }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <View style={{ backgroundColor: t.accent, padding: 6, borderRadius: 2 }}>
            <Home size={18} color={t.onAccent} />
          </View>
          <T v="title">Proppros</T>
        </View>
        <T muted>{mfaToken ? "Enter the 6-digit code from your authenticator app." : "Sign in to manage your rentals or your home."}</T>
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
