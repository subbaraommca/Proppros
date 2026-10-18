import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { FileText, Plus, Save, Trash2 } from "lucide-react";
import { api } from "../services/api";
import { MarkdownView } from "./MarkdownView";
import { Card, Empty, ErrorBox, Field, Input, Spinner } from "./ui";
import { date } from "../utils/format";

interface Template {
  id: string;
  name: string;
  body: string;
  updated_at: string;
}

/** Settings → Lease templates: Markdown-style text with {{merge_fields}}. */
export function LeaseTemplatesTab() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data, error, isLoading } = useQuery({ queryKey: ["lease-templates"], queryFn: () => api.get<Template[]>("/lease-templates") });
  const { data: fields } = useQuery({ queryKey: ["template-fields"], queryFn: () => api.get<{ key: string; description: string }[]>("/lease-templates/fields"), staleTime: Infinity });
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ name: string; body: string } | null>(null);
  const [preview, setPreview] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["lease-templates"] });
  const create = useMutation({
    mutationFn: () => api.post<Template>("/lease-templates", { name: t("templates.starter_name") }),
    onSuccess: (tpl) => {
      refresh();
      setSelected(tpl.id);
      setDraft(null);
    },
  });
  const save = useMutation({
    mutationFn: (id: string) => api.patch<Template>(`/lease-templates/${id}`, draft),
    onSuccess: () => {
      setDraft(null);
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/lease-templates/${id}`),
    onSuccess: () => {
      setSelected(null);
      setDraft(null);
      refresh();
    },
  });
  if (isLoading) return <Spinner />;
  const current = data?.find((x) => x.id === (selected ?? data[0]?.id));
  const form = draft ?? (current ? { name: current.name, body: current.body } : null);
  const insert = (key: string) => {
    if (!form) return;
    const el = area.current;
    const token = `{{${key}}}`;
    const pos = el?.selectionStart ?? form.body.length;
    const body = form.body.slice(0, pos) + token + form.body.slice(el?.selectionEnd ?? pos);
    setDraft({ ...form, body });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(pos + token.length, pos + token.length);
    });
  };
  return (
    <div className="stack">
      <ErrorBox error={error || create.error || save.error || remove.error} />
      <p className="muted">{t("templates.intro", { example: "{{monthly_rent}}", interpolation: { escapeValue: false } })}</p>
      {!data?.length ? (
        <Card>
          <Empty
            icon={<FileText size={36} />}
            title={t("templates.empty_title")}
            action={
              <button className="btn btn-primary" onClick={() => create.mutate()} disabled={create.isPending}>
                <Plus size={15} /> {t("templates.create_starter")}
              </button>
            }
          >
            {t("templates.empty_body")}
          </Empty>
        </Card>
      ) : (
        <div className="templates-layout">
          <Card
            title={t("templates.title")}
            pad={false}
            actions={
              <button className="btn btn-sm" onClick={() => create.mutate()} disabled={create.isPending}>
                <Plus size={13} /> {t("common.add")}
              </button>
            }
          >
            <ul className="tpl-list">
              {data.map((x) => (
                <li key={x.id}>
                  <button
                    className={x.id === current?.id ? "active" : ""}
                    onClick={() => {
                      if (draft && !window.confirm(t("templates.discard"))) return;
                      setSelected(x.id);
                      setDraft(null);
                    }}
                  >
                    <strong>{x.name}</strong>
                    <span className="small muted">{t("templates.updated", { date: date(x.updated_at) })}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
          {current && form && (
            <div className="stack">
              <Card
                title={t("templates.edit")}
                actions={
                  <div className="actions">
                    <div className="seg">
                      <button type="button" className={!preview ? "active" : ""} onClick={() => setPreview(false)}>
                        {t("signing.edit_text")}
                      </button>
                      <button type="button" className={preview ? "active" : ""} onClick={() => setPreview(true)}>
                        {t("signing.preview")}
                      </button>
                    </div>
                  </div>
                }
              >
                <div className="form">
                  <Field label={t("common.name")}>
                    <Input value={form.name} onChange={(e) => setDraft({ ...form, name: e.target.value })} maxLength={120} />
                  </Field>
                  {preview ? (
                    <div className="sign-doc sign-doc-preview">
                      <MarkdownView source={form.body} />
                    </div>
                  ) : (
                    <textarea ref={area} rows={22} className="input mono small" value={form.body} onChange={(e) => setDraft({ ...form, body: e.target.value })} aria-label={t("templates.body")} />
                  )}
                  <p className="small muted">{t("templates.format_hint")}</p>
                  <div className="actions">
                    <button className="btn btn-primary" disabled={!draft || save.isPending} onClick={() => save.mutate(current.id)}>
                      <Save size={14} /> {save.isPending ? t("common.saving") : t("common.save")}
                    </button>
                    {draft && (
                      <button className="btn btn-ghost" onClick={() => setDraft(null)}>
                        {t("common.cancel")}
                      </button>
                    )}
                    <button className="btn btn-ghost btn-danger" onClick={() => window.confirm(t("templates.delete_confirm", { name: current.name })) && remove.mutate(current.id)}>
                      <Trash2 size={14} /> {t("common.delete")}
                    </button>
                  </div>
                </div>
              </Card>
              <Card title={t("templates.fields")}>
                <p className="small muted" style={{ marginBottom: 10 }}>
                  {t("templates.fields_hint")}
                </p>
                <div className="field-chips">
                  {fields?.map((f) => (
                    <button key={f.key} type="button" className="chip" title={f.description} onClick={() => insert(f.key)} disabled={preview}>
                      <code>{`{{${f.key}}}`}</code>
                      <span>{f.description}</span>
                    </button>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
