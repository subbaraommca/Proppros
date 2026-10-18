import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { BookOpen, MessageSquarePlus, Search } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { HELP_ARTICLES } from "../help";
import { MarkdownView } from "../components/MarkdownView";
import { Card, Empty, ErrorBox, Field, Modal, PageHeader, Select, Textarea } from "../components/ui";

export function FeedbackModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [kind, setKind] = useState("idea");
  const [message, setMessage] = useState("");
  const send = useMutation({ mutationFn: () => api.post("/feedback", { kind, message, page: window.location.pathname }) });
  return (
    <Modal
      title={t("help.feedback_title")}
      onClose={onClose}
      footer={
        send.isSuccess ? (
          <button className="btn btn-primary" onClick={onClose}>
            {t("common.close")}
          </button>
        ) : (
          <>
            <button className="btn" onClick={onClose}>
              {t("common.cancel")}
            </button>
            <button className="btn btn-primary" disabled={message.trim().length < 5 || send.isPending} onClick={() => send.mutate()}>
              {t("help.send_feedback")}
            </button>
          </>
        )
      }
    >
      {send.isSuccess ? (
        <div className="success-box">{t("help.feedback_thanks")}</div>
      ) : (
        <div className="form">
          <ErrorBox error={send.error} />
          <Field label={t("common.type")}>
            <Select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              options={[
                { value: "idea", label: t("help.kind_idea") },
                { value: "bug", label: t("help.kind_bug") },
                { value: "question", label: t("help.kind_question") },
              ]}
            />
          </Field>
          <Field label={t("help.message")}>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t("help.message_placeholder")} autoFocus />
          </Field>
        </div>
      )}
    </Modal>
  );
}

export function HelpPage() {
  const { t } = useTranslation();
  const { slug } = useParams();
  const { me, org } = useAuth();
  const base = !me ? "/help" : org?.role === "tenant" ? "/portal/help" : "/help";
  const [q, setQ] = useState("");
  const [feedback, setFeedback] = useState(false);
  const article = slug ? HELP_ARTICLES.find((a) => a.slug === slug) : undefined;
  const title = (s: string) => t(`help.articles.${s}.title`);
  const summary = (s: string) => t(`help.articles.${s}.summary`);
  const matches = HELP_ARTICLES.filter((a) => `${title(a.slug)} ${summary(a.slug)} ${a.content}`.toLowerCase().includes(q.toLowerCase()));

  const feedbackButton = me ? (
    <button className="btn" onClick={() => setFeedback(true)}>
      <MessageSquarePlus size={15} /> {t("help.send_feedback")}
    </button>
  ) : undefined;

  if (slug) {
    if (!article) return <Empty title={t("common.page_not_found")} action={<Link to={base}>{t("help.back")}</Link>} />;
    const idx = HELP_ARTICLES.indexOf(article);
    const next = HELP_ARTICLES[idx + 1];
    return (
      <>
        <PageHeader breadcrumb={<Link to={base}>{t("help.title")}</Link>} title={title(article.slug)} subtitle={summary(article.slug)} actions={feedbackButton} />
        <div className="two-col">
          <Card>
            <MarkdownView source={article.content} />
          </Card>
          <Card title={t("help.all_articles")}>
            <ul className="list-plain">
              {HELP_ARTICLES.map((a) => (
                <li key={a.slug}>
                  {a.slug === article.slug ? <strong>{title(a.slug)}</strong> : <Link to={`${base}/${a.slug}`}>{title(a.slug)}</Link>}
                </li>
              ))}
            </ul>
            {next && (
              <p className="small" style={{ marginTop: 16 }}>
                {t("help.next")}: <Link to={`${base}/${next.slug}`}>{title(next.slug)}</Link>
              </p>
            )}
          </Card>
        </div>
        {feedback && <FeedbackModal onClose={() => setFeedback(false)} />}
      </>
    );
  }

  return (
    <>
      <PageHeader title={t("help.title")} subtitle={t("help.subtitle")} actions={feedbackButton} />
      <div className="toolbar">
        <div className="input-prefix" style={{ minWidth: 280, flex: 1, maxWidth: 480 }}>
          <b>
            <Search size={14} />
          </b>
          <input className="input" style={{ fontFamily: "inherit" }} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("help.search")} aria-label={t("help.search")} />
        </div>
      </div>
      {matches.length === 0 ? (
        <Card>
          <Empty icon={<BookOpen size={40} />} title={t("help.no_results")} action={feedbackButton}>
            {t("help.no_results_body")}
          </Empty>
        </Card>
      ) : (
        <div className="grid grid-cards">
          {matches.map((a) => (
            <Link key={a.slug} to={`${base}/${a.slug}`} className="card property-card">
              <div className="card-body stack" style={{ gap: 6 }}>
                <h3>{title(a.slug)}</h3>
                <p className="small muted">{summary(a.slug)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
      {feedback && <FeedbackModal onClose={() => setFeedback(false)} />}
    </>
  );
}
