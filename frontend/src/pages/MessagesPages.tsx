import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Archive, ArchiveRestore, Inbox, Mail, Megaphone, MessageSquare, MessageSquarePlus, Send, Smartphone } from "lucide-react";
import { api } from "../services/api";
import type { Property, Tenant } from "../types";
import { Badge, Card, Empty, ErrorBox, Field, Input, Modal, PageHeader, Select, Spinner, Tabs, Textarea } from "../components/ui";
import { dateTime } from "../utils/format";

export interface ThreadRow {
  id: string;
  subject: string;
  tenant_id: string;
  tenant_name: string;
  property_name: string | null;
  last_message_at: string;
  last_author_role: "staff" | "tenant";
  preview: string;
  unread: boolean;
  archived: boolean;
}
export interface ChatMessage {
  id: string;
  body: string;
  author_role: "staff" | "tenant";
  author_name: string;
  via: "app" | "sms";
  created_at: string;
}
interface ThreadDetail extends ThreadRow {
  messages: ChatMessage[];
  tenant: { id: string; email: string | null; phone: string | null; has_portal: boolean; sms_opt_in: boolean };
  tenant_read_at: string | null;
}

/** Message bubbles + reply box, shared by staff and the tenant portal. */
export function Conversation({ messages, mine, onSend, sending, error, footer }: { messages: ChatMessage[]; mine: "staff" | "tenant"; onSend: (body: string) => void; sending: boolean; error: unknown; footer?: React.ReactNode }) {
  const { t } = useTranslation();
  const [body, setBody] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);
  return (
    <div className="chat">
      <div className="chat-log">
        {messages.map((m) => (
          <div key={m.id} className={`bubble ${m.author_role === mine ? "mine" : "theirs"}`}>
            <div className="bubble-body">{m.body}</div>
            <div className="bubble-meta">
              {m.author_name} · {dateTime(m.created_at)}
              {m.via === "sms" && (
                <>
                  {" · "}
                  <Smartphone size={11} /> {t("messages.via_sms")}
                </>
              )}
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form
        className="chat-reply"
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) {
            onSend(body.trim());
            setBody("");
          }
        }}
      >
        <ErrorBox error={error} />
        <Textarea
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t("messages.write")}
          aria-label={t("messages.write")}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && body.trim()) {
              onSend(body.trim());
              setBody("");
            }
          }}
          maxLength={5000}
        />
        <div className="chat-reply-bar">
          <span className="small muted">{footer}</span>
          <button className="btn btn-primary btn-sm" disabled={!body.trim() || sending}>
            <Send size={13} /> {t("messages.send")}
          </button>
        </div>
      </form>
    </div>
  );
}

function NewThreadModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: tenants } = useQuery({ queryKey: ["tenants"], queryFn: () => api.get<Tenant[]>("/tenants") });
  const [f, setF] = useState({ tenant_id: "", subject: "", body: "" });
  const create = useMutation({
    mutationFn: () => api.post<{ id: string }>("/messages/threads", { ...f, tenant_id: f.tenant_id || tenants?.[0]?.id }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["threads"] });
      navigate(`/messages/${r.id}`);
      onClose();
    },
  });
  return (
    <Modal
      title={t("messages.new")}
      onClose={onClose}
      footer={
        <button className="btn btn-primary" disabled={!f.subject.trim() || !f.body.trim() || !tenants?.length || create.isPending} onClick={() => create.mutate()}>
          <Send size={14} /> {t("messages.send")}
        </button>
      }
    >
      <div className="form">
        <ErrorBox error={create.error} />
        <Field label={t("messages.to")}>
          <Select value={f.tenant_id || tenants?.[0]?.id || ""} onChange={(e) => setF({ ...f, tenant_id: e.target.value })} options={(tenants ?? []).map((x) => ({ value: x.id, label: `${x.first_name} ${x.last_name}` }))} />
        </Field>
        <Field label={t("messages.subject")}>
          <Input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} maxLength={160} autoFocus />
        </Field>
        <Field label={t("messages.message")}>
          <Textarea rows={5} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} maxLength={5000} />
        </Field>
        <p className="small muted">{t("messages.delivery_note")}</p>
      </div>
    </Modal>
  );
}

function ThreadPane({ id }: { id: string }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data, error, isLoading } = useQuery({ queryKey: ["thread", id], queryFn: () => api.get<ThreadDetail>(`/messages/threads/${id}`), refetchInterval: 30_000 });
  useEffect(() => {
    if (data) {
      qc.invalidateQueries({ queryKey: ["threads"] });
      qc.invalidateQueries({ queryKey: ["unread-count"] });
    }
  }, [data?.messages.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const send = useMutation({ mutationFn: (body: string) => api.post(`/messages/threads/${id}`, { body }), onSuccess: () => qc.invalidateQueries({ queryKey: ["thread", id] }) });
  const archive = useMutation({
    mutationFn: (archived: boolean) => api.patch(`/messages/threads/${id}`, { archived }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["threads"] });
      qc.invalidateQueries({ queryKey: ["thread", id] });
    },
  });
  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorBox error={error} />;
  const channels = [data.tenant.email && t("messages.ch_email"), data.tenant.has_portal && t("messages.ch_portal"), data.tenant.sms_opt_in && t("messages.ch_sms")].filter(Boolean).join(", ");
  return (
    <Card
      title={
        <span>
          {data.subject}
          <div className="small muted" style={{ fontWeight: 400 }}>
            <Link to={`/tenants/${data.tenant_id}`}>{data.tenant_name}</Link>
            {data.property_name ? ` · ${data.property_name}` : ""}
          </div>
        </span>
      }
      actions={
        <button className="btn btn-sm btn-ghost" onClick={() => archive.mutate(!data.archived)} title={data.archived ? t("messages.unarchive") : t("messages.archive")}>
          {data.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />} {data.archived ? t("messages.unarchive") : t("messages.archive")}
        </button>
      }
    >
      <Conversation
        messages={data.messages}
        mine="staff"
        onSend={(b) => send.mutate(b)}
        sending={send.isPending}
        error={send.error || archive.error}
        footer={
          <>
            {channels ? t("messages.delivered_by", { channels }) : t("messages.no_channel")}
            {data.tenant_read_at && data.last_author_role === "staff" && new Date(data.tenant_read_at) >= new Date(data.last_message_at) ? ` · ${t("messages.seen")}` : ""}
          </>
        }
      />
    </Card>
  );
}

function AnnouncementModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: properties } = useQuery({ queryKey: ["properties", false], queryFn: () => api.get<Property[]>("/properties") });
  const [f, setF] = useState({ property_id: "", title: "", body: "", send_email: true, send_sms: false });
  const send = useMutation({
    mutationFn: () => api.post("/announcements", { ...f, property_id: f.property_id || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["announcements"] });
      onClose();
    },
  });
  return (
    <Modal
      title={t("announcements.new")}
      onClose={onClose}
      footer={
        <button className="btn btn-primary" disabled={!f.title.trim() || !f.body.trim() || send.isPending} onClick={() => send.mutate()}>
          <Megaphone size={14} /> {t("announcements.send")}
        </button>
      }
    >
      <div className="form">
        <ErrorBox error={send.error} />
        <Field label={t("announcements.to")}>
          <Select value={f.property_id} onChange={(e) => setF({ ...f, property_id: e.target.value })} options={[{ value: "", label: t("announcements.all_properties") }, ...(properties ?? []).map((p) => ({ value: p.id, label: p.name }))]} />
        </Field>
        <Field label={t("announcements.title_label")}>
          <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={t("announcements.title_placeholder")} maxLength={160} autoFocus />
        </Field>
        <Field label={t("messages.message")}>
          <Textarea rows={5} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} maxLength={5000} />
        </Field>
        <label className="check">
          <input type="checkbox" checked={f.send_email} onChange={(e) => setF({ ...f, send_email: e.target.checked })} /> <Mail size={13} /> {t("announcements.by_email")}
        </label>
        <label className="check">
          <input type="checkbox" checked={f.send_sms} onChange={(e) => setF({ ...f, send_sms: e.target.checked })} /> <Smartphone size={13} /> {t("announcements.by_sms")}
        </label>
        <p className="small muted">{t("announcements.note")}</p>
      </div>
    </Modal>
  );
}

function Announcements() {
  const { t } = useTranslation();
  const [creating, setCreating] = useState(false);
  const { data, error, isLoading } = useQuery({
    queryKey: ["announcements"],
    queryFn: () => api.get<{ id: string; title: string; body: string; property_name: string | null; tenant_count: number; email_count: number; sms_count: number; created_at: string }[]>("/announcements"),
  });
  return (
    <div className="stack">
      <ErrorBox error={error} />
      <div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          <Megaphone size={15} /> {t("announcements.new")}
        </button>
      </div>
      {isLoading ? (
        <Spinner />
      ) : !data?.length ? (
        <Card>
          <Empty icon={<Megaphone size={36} />} title={t("announcements.empty_title")}>
            {t("announcements.empty_body")}
          </Empty>
        </Card>
      ) : (
        data.map((a) => (
          <Card key={a.id} title={a.title} actions={<span className="small muted">{dateTime(a.created_at)}</span>}>
            <p style={{ whiteSpace: "pre-wrap", marginTop: 0 }}>{a.body}</p>
            <div className="small muted">
              {a.property_name ?? t("announcements.all_properties")} · {t("announcements.reach", { tenants: a.tenant_count, emails: a.email_count, texts: a.sms_count })}
            </div>
          </Card>
        ))
      )}
      {creating && <AnnouncementModal onClose={() => setCreating(false)} />}
    </div>
  );
}

export function MessagesPage() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [tab, setTab] = useState<"inbox" | "announcements">("inbox");
  const [archived, setArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const { data, error, isLoading } = useQuery({ queryKey: ["threads", archived], queryFn: () => api.get<ThreadRow[]>(`/messages/threads?archived=${archived}`), refetchInterval: 60_000 });
  return (
    <>
      <PageHeader
        title={t("nav.messages")}
        subtitle={t("messages.subtitle")}
        actions={
          tab === "inbox" && (
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              <MessageSquarePlus size={16} /> {t("messages.new")}
            </button>
          )
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "inbox", label: t("messages.inbox") },
          { id: "announcements", label: t("announcements.title") },
        ]}
      />
      {tab === "announcements" ? (
        <Announcements />
      ) : (
        <div className="inbox">
          <Card pad={false}>
            <div className="inbox-head">
              <label className="check small">
                <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} /> {t("messages.show_archived")}
              </label>
            </div>
            <ErrorBox error={error} />
            {isLoading ? (
              <Spinner />
            ) : !data?.length ? (
              <Empty icon={<Inbox size={32} />} title={t("messages.empty_title")}>
                {t("messages.empty_body")}
              </Empty>
            ) : (
              <ul className="thread-list">
                {data.map((th) => (
                  <li key={th.id}>
                    <Link to={`/messages/${th.id}`} className={`${th.id === id ? "active" : ""}${th.unread ? " unread" : ""}`}>
                      <div className="thread-top">
                        <strong>{th.tenant_name}</strong>
                        <span className="small muted">{dateTime(th.last_message_at)}</span>
                      </div>
                      <div className="small">
                        {th.unread && <Badge tone="carnelian">{t("messages.new_badge")}</Badge>} {th.subject}
                      </div>
                      <div className="small muted thread-preview">
                        {th.last_author_role === "staff" ? `${t("messages.you")}: ` : ""}
                        {th.preview}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <div>
            {id ? (
              <ThreadPane key={id} id={id} />
            ) : (
              <Card>
                <Empty icon={<MessageSquare size={36} />} title={t("messages.pick")}>
                  {t("messages.pick_body")}
                </Empty>
              </Card>
            )}
          </div>
        </div>
      )}
      {creating && <NewThreadModal onClose={() => setCreating(false)} />}
    </>
  );
}
