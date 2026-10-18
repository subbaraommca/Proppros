import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api, setOrgId } from "../services/api";
import { useAuth } from "../hooks/useAuth";

/** Shown while a Proppros super admin is signed in as a customer (support access). */
export function ImpersonationBanner() {
  const { t } = useTranslation();
  const { me } = useAuth();
  const stop = useMutation({
    mutationFn: () => api.post("/admin/impersonate/stop"),
    onSettled: () => {
      setOrgId(null);
      window.location.assign("/admin");
    },
  });
  if (!me?.impersonated_by) return null;
  return (
    <div className="banner banner-danger" role="status">
      {t("admin.impersonating", { name: me.name, email: me.email })}
      <button onClick={() => stop.mutate()} disabled={stop.isPending}>
        {t("admin.stop_impersonating")}
      </button>
    </div>
  );
}
