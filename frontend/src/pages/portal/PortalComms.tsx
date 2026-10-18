import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CalendarX, FileDown, Megaphone, MessageSquare, MessageSquarePlus, ShieldCheck, Smartphone, Upload } from "lucide-react";
import { api, fileUrl } from "../../services/api";
import { Conversation, type ChatMessage, type ThreadRow } from "../MessagesPages";
import { Badge, Card, Empty, ErrorBox, Field, Input, Modal, PageHeader, Spinner, Textarea } from "../../components/ui";
import { date, dateTime, todayISO } from "../../utils/format";

function NewMessageModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [f, setF] = useState({ subject: "", body: "" });
  const create = useMutation({
    mutationFn: () => api.post<{ id: string }>("/portal/messages", f),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["portal-threads"] });
      navigate(`/portal/messages/${r.id}`);
      onClose();
    },
  });
  return (
    <Modal
      title={t("pmessages.new")}
      onClose={onClose}
      footer={
        <button className="btn btn-primary" disabled={!f.subject.trim() || !f.body.trim() || create.isPending} onClick={() => create.mutate()}>
          {t("messages.send")}
        </button>
      }
    >
      <div className="form">
        <ErrorBox error={create.error} />
        <Field label={t("messages.subject")}>
          <Input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} maxLength={160} autoFocus />
        </Field>
        <Field label={t("messages.message")}>
          <Textarea rows={5} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} maxLength={5000} />
        </Field>
        <p className="small muted">{t("pmessages.repairs_hint")}</p>
      </div>
    </Modal>
  );
}

export function SmsCard() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["portal-sms"], queryFn: () => api.get<{ opt_in: boolean; phone: string | null; live: boolean }>("/portal/sms") });
  const [phone, setPhone] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const save = useMutation({
    mutationFn: (opt_in: boolean) => api.put("/portal/sms", { opt_in, phone: phone ?? data?.phone ?? null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["portal-sms"] }),
  });
  if (!data) return null;
  return (
    <Card
      title={
        <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          <Smartphone size={15} /> {t("psms.title")}
        </span>
      }
    >
      <div className="form">
        <ErrorBox error={save.error} />
        {data.opt_in ? (
          <>
            <p className="small">{t("psms.on", { phone: data.phone })}</p>
            <div>
              <button className="btn btn-sm" onClick={() => save.mutate(false)} disabled={save.isPending}>
                {t("psms.turn_off")}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="small muted">{t("psms.intro")}</p>
            <Field label={t("psms.mobile")}>
              <Input type="tel" value={phone ?? data.phone ?? ""} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
            </Field>
            <label className="check small">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> {t("psms.consent")}
            </label>
            <div>
              <button className="btn btn-sm btn-primary" onClick={() => save.mutate(true)} disabled={!agree || save.isPending}>
                {t("psms.turn_on")}
              </button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

export function PortalMessagesPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const { data: threads, error, isLoading } = useQuery({ queryKey: ["portal-threads"], queryFn: () => api.get<ThreadRow[]>("/portal/messages"), refetchInterval: 60_000 });
  const thread = useQuery({
    queryKey: ["portal-thread", id],
    queryFn: () => api.get<ThreadRow & { messages: ChatMessage[] }>(`/portal/messages/${id}`),
    enabled: !!id,
    refetchInterval: 30_000,
  });
  const send = useMutation({
    mutationFn: (body: string) => api.post(`/portal/messages/${id}`, { body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portal-thread", id] });
      qc.invalidateQueries({ queryKey: ["portal-threads"] });
    },
  });
  return (
    <>
      <PageHeader
        title={t("nav.messages")}
        subtitle={t("pmessages.subtitle")}
        actions={
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            <MessageSquarePlus size={16} /> {t("pmessages.new")}
          </button>
        }
      />
      <ErrorBox error={error} />
      <div className="inbox">
        <div className="stack">
          <Card pad={false}>
            {isLoading ? (
              <Spinner />
            ) : !threads?.length ? (
              <Empty icon={<MessageSquare size={32} />} title={t("pmessages.empty_title")}>
                {t("pmessages.empty_body")}
              </Empty>
            ) : (
              <ul className="thread-list">
                {threads.map((th) => (
                  <li key={th.id}>
                    <Link to={`/portal/messages/${th.id}`} className={`${th.id === id ? "active" : ""}${th.unread ? " unread" : ""}`}>
                      <div className="thread-top">
                        <strong>{th.subject}</strong>
                        <span className="small muted">{dateTime(th.last_message_at)}</span>
                      </div>
                      <div className="small muted thread-preview">
                        {th.unread && <Badge tone="carnelian">{t("messages.new_badge")}</Badge>} {th.preview}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <SmsCard />
        </div>
        <div>
          {id && thread.data ? (
            <Card title={thread.data.subject}>
              <Conversation messages={thread.data.messages} mine="tenant" onSend={(b) => send.mutate(b)} sending={send.isPending} error={send.error} />
            </Card>
          ) : id ? (
            <Spinner />
          ) : (
            <Card>
              <Empty icon={<MessageSquare size={36} />} title={t("pmessages.pick")} />
            </Card>
          )}
        </div>
      </div>
      {creating && <NewMessageModal onClose={() => setCreating(false)} />}
    </>
  );
}

/** Portal home: latest announcements and notices. */
export function PortalUpdates() {
  const { t } = useTranslation();
  const ann = useQuery({ queryKey: ["portal-announcements"], queryFn: () => api.get<{ id: string; title: string; body: string; created_at: string }[]>("/portal/announcements") });
  const notices = useQuery({ queryKey: ["portal-notices"], queryFn: () => api.get<{ id: string; title: string; created_at: string; document_id: string | null }[]>("/portal/notices") });
  const recentNotices = (notices.data ?? []).slice(0, 3);
  const recentAnn = (ann.data ?? []).slice(0, 3);
  if (!recentNotices.length && !recentAnn.length) return null;
  return (
    <div className="grid grid-2">
      {recentAnn.length > 0 && (
        <Card
          title={
            <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
              <Megaphone size={15} /> {t("pportal.announcements")}
            </span>
          }
        >
          <div className="stack" style={{ gap: 12 }}>
            {recentAnn.map((a) => (
              <div key={a.id}>
                <strong className="small">{a.title}</strong> <span className="small muted">· {date(a.created_at)}</span>
                <p className="small" style={{ whiteSpace: "pre-wrap", margin: "4px 0 0" }}>
                  {a.body}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
      {recentNotices.length > 0 && (
        <Card title={t("pportal.notices")}>
          <ul className="list-plain">
            {recentNotices.map((n) => (
              <li key={n.id}>
                <span className="small">
                  {n.title} <span className="muted">· {date(n.created_at)}</span>
                </span>
                {n.document_id && (
                  <a className="btn btn-sm" href={fileUrl(`/documents/${n.document_id}/file`)} target="_blank" rel="noreferrer">
                    <FileDown size={13} /> PDF
                  </a>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

interface MoveOut {
  id: string;
  move_out_date: string;
  status: "submitted" | "acknowledged" | "withdrawn";
  created_at: string;
}

/** Portal lease page: give notice to move out. */
export function MoveOutCard({ leaseId, endDate }: { leaseId: string; endDate: string | null }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["portal-move-out", leaseId], queryFn: () => api.get<MoveOut | null>(`/portal/leases/${leaseId}/move-out`) });
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ move_out_date: endDate ?? "", forwarding_address: "", reason: "" });
  const refresh = () => qc.invalidateQueries({ queryKey: ["portal-move-out", leaseId] });
  const give = useMutation({
    mutationFn: () => api.post(`/portal/leases/${leaseId}/move-out`, { move_out_date: f.move_out_date, forwarding_address: f.forwarding_address || null, reason: f.reason || null }),
    onSuccess: () => {
      setOpen(false);
      refresh();
    },
  });
  const withdraw = useMutation({ mutationFn: (id: string) => api.post(`/portal/move-out/${id}/withdraw`), onSuccess: refresh });
  return (
    <Card
      title={
        <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          <CalendarX size={15} /> {t("pmoveout.title")}
        </span>
      }
    >
      <ErrorBox error={withdraw.error} />
      {data ? (
        <div className="stack" style={{ gap: 8 }}>
          <p className="small" style={{ margin: 0 }}>
            {t(data.status === "acknowledged" ? "pmoveout.acknowledged" : "pmoveout.submitted", { date: date(data.move_out_date) })}
          </p>
          {data.status === "submitted" && (
            <button className="btn btn-sm btn-ghost" style={{ justifySelf: "start" }} onClick={() => window.confirm(t("pmoveout.withdraw_confirm")) && withdraw.mutate(data.id)}>
              {t("pmoveout.withdraw")}
            </button>
          )}
        </div>
      ) : (
        <div className="stack" style={{ gap: 8 }}>
          <p className="small muted" style={{ margin: 0 }}>
            {t("pmoveout.intro")}
          </p>
          <button className="btn btn-sm" style={{ justifySelf: "start" }} onClick={() => setOpen(true)}>
            {t("pmoveout.give")}
          </button>
        </div>
      )}
      {open && (
        <Modal
          title={t("pmoveout.give")}
          onClose={() => setOpen(false)}
          footer={
            <button className="btn btn-primary" disabled={!f.move_out_date || give.isPending} onClick={() => window.confirm(t("pmoveout.confirm", { date: date(f.move_out_date) })) && give.mutate()}>
              {t("pmoveout.submit")}
            </button>
          }
        >
          <div className="form">
            <ErrorBox error={give.error} />
            <Field label={t("pmoveout.date")}>
              <Input type="date" min={todayISO()} value={f.move_out_date} onChange={(e) => setF({ ...f, move_out_date: e.target.value })} />
            </Field>
            <Field label={t("pmoveout.forwarding")} hint={t("pmoveout.forwarding_hint")}>
              <Textarea rows={2} value={f.forwarding_address} onChange={(e) => setF({ ...f, forwarding_address: e.target.value })} maxLength={500} />
            </Field>
            <Field label={t("pmoveout.reason")}>
              <Textarea rows={2} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} maxLength={2000} />
            </Field>
            <p className="small muted">{t("pmoveout.note")}</p>
          </div>
        </Modal>
      )}
    </Card>
  );
}

/** Portal lease page: upload renter's insurance. */
export function InsuranceCard() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const { data } = useQuery({ queryKey: ["portal-insurance"], queryFn: () => api.get<{ id: string; name: string; expires_on: string | null; created_at: string }[]>("/portal/insurance") });
  const [f, setF] = useState({ expires_on: "", provider: "" });
  const [file, setFile] = useState<File | null>(null);
  const upload = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append("file", file!);
      form.append("expires_on", f.expires_on);
      if (f.provider) form.append("provider", f.provider);
      return api.upload("/portal/insurance", form);
    },
    onSuccess: () => {
      setFile(null);
      setF({ expires_on: "", provider: "" });
      qc.invalidateQueries({ queryKey: ["portal-insurance"] });
    },
  });
  const current = data?.[0];
  return (
    <Card
      title={
        <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          <ShieldCheck size={15} /> {t("pinsurance.title")}
        </span>
      }
    >
      <div className="form">
        <ErrorBox error={upload.error} />
        {current ? (
          <p className="small" style={{ margin: 0 }}>
            <a href={fileUrl(`/documents/${current.id}/file`)} target="_blank" rel="noreferrer">
              {current.name}
            </a>{" "}
            · {t("pinsurance.valid_until", { date: date(current.expires_on) })}
          </p>
        ) : (
          <p className="small muted" style={{ margin: 0 }}>
            {t("pinsurance.none")}
          </p>
        )}
        <div className="form-row">
          <Field label={t("pinsurance.provider")}>
            <Input value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })} placeholder="Lemonade, State Farm…" />
          </Field>
          <Field label={t("pinsurance.expires")}>
            <Input type="date" min={todayISO()} value={f.expires_on} onChange={(e) => setF({ ...f, expires_on: e.target.value })} />
          </Field>
        </div>
        <input ref={input} type="file" accept="application/pdf,image/*" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <div className="actions">
          <button type="button" className="btn btn-sm" onClick={() => input.current?.click()}>
            <Upload size={13} /> {file ? file.name : t("pinsurance.choose")}
          </button>
          <button className="btn btn-sm btn-primary" disabled={!file || !f.expires_on || upload.isPending} onClick={() => upload.mutate()}>
            {upload.isPending ? t("common.uploading") : current ? t("pinsurance.upload_new") : t("pinsurance.upload")}
          </button>
        </div>
      </div>
    </Card>
  );
}
