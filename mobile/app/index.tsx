import { Redirect } from "expo-router";
import { isStaff, useAuth } from "../src/auth/AuthContext";

export default function Index() {
  const { me, org } = useAuth();
  if (!me) return <Redirect href="/login" />;
  return <Redirect href={isStaff(org) ? "/(staff)" : "/(tenant)"} />;
}
