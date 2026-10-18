import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { FileSignature, RefreshCw } from "lucide-react";
import { api } from "../services/api";
import { Badge, Card, ErrorBox, Field, Textarea } from "./ui";
import { date, money } from "../utils/format";

/** Tenant home: documents waiting for this tenant's signature. */
export function PendingSignatures() {
  const { t } = useTranslation();
  const { data } = useQuery({ queryKey: ["portal-signatures"], queryFn: () => api.get<{ signer_id: string; title: string; sent_at: string }[]>("/portal/signatures") });
  if (!data?.length) return null;
  return (
    <Card title={t("signing.to_sign")}>
      <ul className="list-plain">
        {data.map((s) => (
          <li key={s.signer_id}>
            <span>
              <FileSignature size={14} /> {s.title} <span className="small muted">· {date(s.sent_at)}</span>
            </span>
            <Link to={`/portal/sign/${s.signer_id}`} className="btn btn-sm btn-primary">
              {t("signing.review_sign")}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

interface Offer {
  id: string;
  status: "sent" | "accepted" | "declined";
  rent_cents: number;
  start_date: string;
  end_date: string | null;
  respond_by: string;
  message: string | null;
  responded_at: string | null;
}

/** Tenant lease page: the landlord's renewal offer, with accept / decline. */
export function PortalRenewalCard({ leaseId, currentRent }: { leaseId: string; currentRent: number }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["portal-renewal", leaseId], queryFn: () => api.get<Offer | null>(`/portal/leases/${leaseId}/renewal`) });
  const [note, setNote] = useState("");
  const respond = useMutation({
    mutationFn: (accept: boolean) => api.post<Offer>(`/portal/renewals/${data!.id}/respond`, { accept, note: note || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal-renewal", leaseId] });
      qc.invalidateQueries({ queryKey: ["portal-home"] });
    },
  });
  if (!data) return null;
  const change = data.rent_cents - currentRent;
  return (
    <Card
      title={
        <>
          <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
            <RefreshCw size={15} /> {t("renewal.portal_title")}
          </span>{" "}
          {data.status !== "sent" && <Badge value={data.status === "accepted" ? "active" : "ended"}>{t(`renewal.status_${data.status}`)}</Badge>}
        </>
      }
    >
      <div className="stack" style={{ gap: 12 }}>
        <ErrorBox error={respond.error} />
        <dl className="dl">
          <dt>{t("renewal.term")}</dt>
          <dd>
            {date(data.start_date)} – {data.end_date ? date(data.end_date) : t("common.month_to_month")}
          </dd>
          <dt>{t("renewal.new_rent")}</dt>
          <dd>
            <strong>{money(data.rent_cents)}</strong>{" "}
            {change !== 0 && <span className="small muted">({t(change > 0 ? "renewal.portal_up" : "renewal.portal_down", { amount: money(Math.abs(change)) })})</span>}
          </dd>
          {data.status === "sent" && (
            <>
              <dt>{t("renewal.respond_by")}</dt>
              <dd>{date(data.respond_by)}</dd>
            </>
          )}
        </dl>
        {data.message && <p style={{ whiteSpace: "pre-wrap" }}>{data.message}</p>}
        {data.status === "sent" ? (
          <>
            <Field label={t("renewal.portal_note")}>
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
            </Field>
            <div className="actions">
              <button className="btn btn-primary" disabled={respond.isPending} onClick={() => window.confirm(t("renewal.portal_accept_confirm")) && respond.mutate(true)}>
                {t("renewal.accept")}
              </button>
              <button className="btn" disabled={respond.isPending} onClick={() => window.confirm(t("renewal.portal_decline_confirm")) && respond.mutate(false)}>
                {t("renewal.decline")}
              </button>
            </div>
          </>
        ) : (
          <p className="small muted">{data.status === "accepted" ? t("renewal.portal_accepted") : t("renewal.portal_declined")}</p>
        )}
      </div>
    </Card>
  );
}
