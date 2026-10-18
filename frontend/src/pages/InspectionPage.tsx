import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Camera, CheckCircle2, FileDown, Plus, Save, Trash2, X } from "lucide-react";
import { api, fileUrl } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import { Badge, Card, ErrorBox, Field, Input, Modal, PageHeader, Spinner, Textarea } from "../components/ui";
import { date } from "../utils/format";

type Condition = "" | "good" | "fair" | "poor" | "damaged" | "na";
interface Item {
  id: string;
  area: string;
  item: string;
  condition: Condition;
  notes: string;
  photo_ids: string[];
}
interface Inspection {
  id: string;
  lease_id: string;
  kind: "move_in" | "move_out";
  status: "draft" | "completed";
  inspected_on: string;
  notes: string | null;
  items: Item[];
  document_id: string | null;
  photos: Record<string, { id: string; name: string }>;
  baseline: Record<string, { condition: Condition; notes: string; photo_ids: string[] }> | null;
}

const CONDITIONS: Condition[] = ["good", "fair", "poor", "damaged", "na"];

function PhotoThumb({ id, onRemove }: { id: string; onRemove?: () => void }) {
  const { t } = useTranslation();
  return (
    <span className="insp-thumb">
      <a href={fileUrl(`/documents/${id}/file`)} target="_blank" rel="noreferrer">
        <img src={fileUrl(`/documents/${id}/file`)} alt="" loading="lazy" />
      </a>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={t("inspections.remove_photo")}>
          <X size={11} />
        </button>
      )}
    </span>
  );
}

export function InspectionPage() {
  const { t } = useTranslation();
  const { id: leaseId = "", inspectionId = "" } = useParams();
  const { can } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const canEdit = can("owner", "manager");
  const { data, error, isLoading } = useQuery({ queryKey: ["inspection", inspectionId], queryFn: () => api.get<Inspection>(`/inspections/${inspectionId}`) });
  const [items, setItems] = useState<Item[] | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [inspectedOn, setInspectedOn] = useState<string | null>(null);
  const [adding, setAdding] = useState<{ area: string; item: string } | null>(null);
  const [completing, setCompleting] = useState(false);
  const [share, setShare] = useState(true);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadFor = useRef<string>("");

  const apply = (r: Inspection) => {
    qc.setQueryData(["inspection", inspectionId], r);
    qc.invalidateQueries({ queryKey: ["inspections", leaseId] });
  };
  const current = items ?? data?.items ?? [];
  const dirty = items !== null || notes !== null || inspectedOn !== null;
  const body = () => ({
    items: current,
    ...(notes !== null ? { notes } : {}),
    ...(inspectedOn !== null ? { inspected_on: inspectedOn } : {}),
  });
  const save = useMutation({
    mutationFn: () => api.patch<Inspection>(`/inspections/${inspectionId}`, body()),
    onSuccess: (r) => {
      setItems(null);
      setNotes(null);
      setInspectedOn(null);
      apply(r);
    },
  });
  const upload = useMutation({
    mutationFn: async ({ itemId, file }: { itemId: string; file: File }) => {
      if (dirty) await api.patch(`/inspections/${inspectionId}`, body());
      const form = new FormData();
      form.append("item_id", itemId);
      form.append("file", file);
      return api.upload<Inspection>(`/inspections/${inspectionId}/photos`, form);
    },
    onSuccess: (r) => {
      setItems(null);
      setNotes(null);
      setInspectedOn(null);
      apply(r);
    },
  });
  const removePhoto = useMutation({
    mutationFn: (docId: string) => api.del<Inspection>(`/inspections/${inspectionId}/photos/${docId}`),
    onSuccess: (r) => {
      setItems((prev) => prev && prev.map((it) => ({ ...it, photo_ids: r.items.find((x) => x.id === it.id)?.photo_ids ?? it.photo_ids })));
      qc.setQueryData(["inspection", inspectionId], r);
    },
  });
  const complete = useMutation({
    mutationFn: async () => {
      if (dirty) await api.patch(`/inspections/${inspectionId}`, body());
      return api.post<Inspection>(`/inspections/${inspectionId}/complete`, { share_with_tenant: share });
    },
    onSuccess: (r) => {
      setItems(null);
      setNotes(null);
      setInspectedOn(null);
      setCompleting(false);
      apply(r);
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
  });
  const remove = useMutation({
    mutationFn: () => api.del(`/inspections/${inspectionId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inspections", leaseId] });
      navigate(`/leases/${leaseId}`);
    },
  });

  if (isLoading) return <Spinner />;
  if (error || !data) return <ErrorBox error={error} />;
  const editable = canEdit && data.status === "draft";
  const update = (id: string, patch: Partial<Item>) => setItems(current.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const areas = [...new Set(current.map((it) => it.area))];
  const checked = current.filter((it) => it.condition).length;
  const title = t(`inspections.kind_${data.kind}`);

  return (
    <>
      <PageHeader
        breadcrumb={<Link to={`/leases/${leaseId}`}>{t("inspections.back_to_lease")}</Link>}
        title={
          <>
            {title} <Badge value={data.status === "completed" ? "completed" : "draft"}>{t(`inspections.status_${data.status}`)}</Badge>
          </>
        }
        subtitle={t("inspections.checked_of", { checked, total: current.length })}
        actions={
          <>
            {data.document_id ? (
              <a className="btn" href={fileUrl(`/documents/${data.document_id}/file`)} target="_blank" rel="noreferrer">
                <FileDown size={15} /> {t("inspections.report")}
              </a>
            ) : (
              <a className="btn btn-ghost" href={fileUrl(`/inspections/${data.id}/report.pdf`)} target="_blank" rel="noreferrer">
                <FileDown size={15} /> {t("inspections.preview")}
              </a>
            )}
            {editable && (
              <>
                <button className="btn" onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
                  <Save size={15} /> {save.isPending ? t("common.saving") : t("common.save")}
                </button>
                <button className="btn btn-primary" onClick={() => setCompleting(true)}>
                  <CheckCircle2 size={15} /> {t("inspections.complete")}
                </button>
              </>
            )}
          </>
        }
      />
      <div className="stack">
        <ErrorBox error={save.error || upload.error || removePhoto.error || remove.error} />
        {dirty && <div className="info-box">{t("inspections.unsaved")}</div>}
        <Card>
          <div className="form-row">
            <Field label={t("inspections.date")}>
              <Input type="date" value={inspectedOn ?? data.inspected_on} disabled={!editable} onChange={(e) => setInspectedOn(e.target.value)} />
            </Field>
            <Field label={t("inspections.general_notes")} hint={t("inspections.general_notes_hint")}>
              <Textarea rows={2} value={notes ?? data.notes ?? ""} disabled={!editable} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>
          {data.kind === "move_out" && !data.baseline && <p className="small muted">{t("inspections.no_baseline")}</p>}
        </Card>
        {areas.map((area) => (
          <Card
            key={area}
            title={area}
            pad={false}
            actions={
              editable && (
                <button className="btn btn-sm btn-ghost" onClick={() => setAdding({ area, item: "" })}>
                  <Plus size={13} /> {t("inspections.add_item")}
                </button>
              )
            }
          >
            <div className="insp-list">
              {current
                .filter((it) => it.area === area)
                .map((it) => {
                  const base = data.baseline?.[`${it.area}|${it.item}`];
                  return (
                    <div key={it.id} className={`insp-row${it.condition === "damaged" || it.condition === "poor" ? " insp-flag" : ""}`}>
                      <div className="insp-item">
                        <strong>{it.item}</strong>
                        {base && (
                          <div className="small muted">
                            {t("inspections.at_move_in")}: {base.condition ? t(`inspections.cond_${base.condition}`) : t("inspections.cond_unchecked")}
                            {base.notes ? ` — ${base.notes}` : ""}
                            {base.photo_ids.length > 0 && (
                              <span className="insp-photos" style={{ marginTop: 4 }}>
                                {base.photo_ids.filter((p) => data.photos[p]).map((p) => (
                                  <PhotoThumb key={p} id={p} />
                                ))}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="seg insp-cond" role="radiogroup" aria-label={t("inspections.condition_for", { item: it.item })}>
                        {CONDITIONS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            role="radio"
                            aria-checked={it.condition === c}
                            className={`${it.condition === c ? "active" : ""} cond-${c}`}
                            disabled={!editable}
                            onClick={() => update(it.id, { condition: it.condition === c ? "" : c })}
                          >
                            {t(`inspections.cond_${c}`)}
                          </button>
                        ))}
                      </div>
                      <div className="insp-notes">
                        <Input value={it.notes} disabled={!editable} placeholder={t("inspections.notes_placeholder")} onChange={(e) => update(it.id, { notes: e.target.value })} aria-label={t("inspections.notes_for", { item: it.item })} />
                        <div className="insp-photos">
                          {it.photo_ids.map((p) => (
                            <PhotoThumb key={p} id={p} onRemove={editable ? () => removePhoto.mutate(p) : undefined} />
                          ))}
                          {editable && (
                            <button
                              type="button"
                              className="btn btn-sm btn-ghost"
                              disabled={upload.isPending}
                              onClick={() => {
                                uploadFor.current = it.id;
                                fileInput.current?.click();
                              }}
                            >
                              <Camera size={13} /> {upload.isPending && upload.variables?.itemId === it.id ? t("common.uploading") : t("inspections.photo")}
                            </button>
                          )}
                          {editable && it.photo_ids.length === 0 && !base && (
                            <button type="button" className="icon-btn" aria-label={t("inspections.remove_item")} onClick={() => setItems(current.filter((x) => x.id !== it.id))}>
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </Card>
        ))}
        {editable && (
          <div className="actions">
            <button className="btn btn-ghost" onClick={() => setAdding({ area: "", item: "" })}>
              <Plus size={14} /> {t("inspections.add_area")}
            </button>
            <button className="btn btn-ghost btn-danger" onClick={() => window.confirm(t("inspections.delete_confirm")) && remove.mutate()}>
              <Trash2 size={14} /> {t("inspections.delete")}
            </button>
          </div>
        )}
        {data.status === "completed" && <p className="small muted">{t("inspections.completed_note", { date: date(data.inspected_on) })}</p>}
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload.mutate({ itemId: uploadFor.current, file });
          e.target.value = "";
        }}
      />
      {adding && (
        <Modal
          title={adding.area ? t("inspections.add_item_to", { area: adding.area }) : t("inspections.add_area")}
          onClose={() => setAdding(null)}
          footer={
            <button
              className="btn btn-primary"
              disabled={!adding.area.trim() || !adding.item.trim()}
              onClick={() => {
                setItems([...current, { id: Math.random().toString(36).slice(2, 12), area: adding.area.trim(), item: adding.item.trim(), condition: "", notes: "", photo_ids: [] }]);
                setAdding(null);
              }}
            >
              {t("common.add")}
            </button>
          }
        >
          <div className="form">
            <Field label={t("inspections.area")}>
              <Input value={adding.area} onChange={(e) => setAdding({ ...adding, area: e.target.value })} maxLength={80} />
            </Field>
            <Field label={t("inspections.item")}>
              <Input value={adding.item} onChange={(e) => setAdding({ ...adding, item: e.target.value })} maxLength={120} autoFocus />
            </Field>
          </div>
        </Modal>
      )}
      {completing && (
        <Modal
          title={t("inspections.complete_title")}
          onClose={() => setCompleting(false)}
          footer={
            <>
              <button className="btn" onClick={() => setCompleting(false)}>
                {t("common.cancel")}
              </button>
              <button className="btn btn-primary" onClick={() => complete.mutate()} disabled={complete.isPending}>
                <CheckCircle2 size={14} /> {t("inspections.complete")}
              </button>
            </>
          }
        >
          <div className="stack">
            <ErrorBox error={complete.error} />
            <p>{t("inspections.complete_body", { checked, total: current.length })}</p>
            <label className="check">
              <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} /> {t("inspections.share")}
            </label>
          </div>
        </Modal>
      )}
    </>
  );
}
