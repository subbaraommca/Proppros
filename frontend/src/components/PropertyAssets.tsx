import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff, FolderOpen, KeyRound, Package, Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import type { Property } from "../types";
import { DocumentsPanel } from "./Documents";
import { Badge, Card, Empty, ErrorBox, Field, Input, Modal, MoneyInput, Select, Textarea } from "./ui";
import { date, fromCents, money, toCents } from "../utils/format";

const ASSET_CATEGORIES = ["appliance", "hvac", "water_heater", "plumbing", "electrical", "roof", "safety", "exterior", "other"];
const ACCESS_KINDS = ["key", "fob", "remote", "code", "lockbox", "mailbox", "other"];

interface Asset {
  id: string;
  unit_id: string | null;
  unit_name: string | null;
  name: string;
  category: string;
  make: string | null;
  model: string | null;
  serial_number: string | null;
  installed_on: string | null;
  purchase_price_cents: number | null;
  warranty_expires_on: string | null;
  warranty_status: "ok" | "expiring" | "expired" | null;
  location: string | null;
  notes: string | null;
}

function AssetModal({ property, asset, onClose }: { property: Property; asset?: Asset; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [f, setF] = useState({
    name: asset?.name ?? "",
    category: asset?.category ?? "appliance",
    unit_id: asset?.unit_id ?? "",
    make: asset?.make ?? "",
    model: asset?.model ?? "",
    serial_number: asset?.serial_number ?? "",
    installed_on: asset?.installed_on ?? "",
    price: asset?.purchase_price_cents != null ? fromCents(asset.purchase_price_cents) : "",
    warranty_expires_on: asset?.warranty_expires_on ?? "",
    location: asset?.location ?? "",
    notes: asset?.notes ?? "",
  });
  const save = useMutation({
    mutationFn: () => {
      const body = {
        property_id: property.id,
        name: f.name,
        category: f.category,
        unit_id: f.unit_id || null,
        make: f.make || null,
        model: f.model || null,
        serial_number: f.serial_number || null,
        installed_on: f.installed_on || null,
        purchase_price_cents: f.price ? toCents(f.price) : null,
        warranty_expires_on: f.warranty_expires_on || null,
        location: f.location || null,
        notes: f.notes || null,
      };
      return asset ? api.patch(`/assets/${asset.id}`, body) : api.post("/assets", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets", property.id] });
      onClose();
    },
  });
  return (
    <Modal
      title={asset ? t("assets.edit") : t("assets.add")}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="btn btn-primary" disabled={!f.name.trim() || save.isPending} onClick={() => save.mutate()}>
            {t("common.save")}
          </button>
        </>
      }
    >
      <div className="form">
        <ErrorBox error={save.error} />
        <div className="form-row-3">
          <Field label={t("common.name")} hint={t("assets.name_hint")}>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus maxLength={120} />
          </Field>
          <Field label={t("common.category")}>
            <Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} options={ASSET_CATEGORIES.map((c) => ({ value: c, label: t(`assets.cat_${c}`) }))} />
          </Field>
          <Field label={t("common.unit")}>
            <Select value={f.unit_id} onChange={(e) => setF({ ...f, unit_id: e.target.value })} options={[{ value: "", label: t("assets.shared") }, ...(property.units ?? []).map((u) => ({ value: u.id, label: u.name }))]} />
          </Field>
        </div>
        <div className="form-row-3">
          <Field label={t("assets.make")}>
            <Input value={f.make} onChange={(e) => setF({ ...f, make: e.target.value })} maxLength={80} />
          </Field>
          <Field label={t("assets.model")}>
            <Input value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} maxLength={80} />
          </Field>
          <Field label={t("assets.serial")}>
            <Input value={f.serial_number} onChange={(e) => setF({ ...f, serial_number: e.target.value })} maxLength={80} />
          </Field>
        </div>
        <div className="form-row-3">
          <Field label={t("assets.installed")}>
            <Input type="date" value={f.installed_on} onChange={(e) => setF({ ...f, installed_on: e.target.value })} />
          </Field>
          <Field label={t("assets.price")}>
            <MoneyInput value={f.price} onChange={(price) => setF({ ...f, price })} />
          </Field>
          <Field label={t("assets.warranty")} hint={t("assets.warranty_hint")}>
            <Input type="date" value={f.warranty_expires_on} onChange={(e) => setF({ ...f, warranty_expires_on: e.target.value })} />
          </Field>
        </div>
        <Field label={t("assets.location")}>
          <Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} maxLength={120} placeholder={t("assets.location_placeholder")} />
        </Field>
        <Field label={t("common.notes")}>
          <Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} maxLength={2000} />
        </Field>
      </div>
    </Modal>
  );
}

export function AssetsPanel({ property }: { property: Property }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const canEdit = can("owner", "manager");
  const [modal, setModal] = useState<{ asset?: Asset } | null>(null);
  const [docs, setDocs] = useState<Asset | null>(null);
  const { data, error } = useQuery({ queryKey: ["assets", property.id], queryFn: () => api.get<Asset[]>(`/assets?property_id=${property.id}`) });
  const archive = useMutation({ mutationFn: (id: string) => api.patch(`/assets/${id}`, { archived: true }), onSuccess: () => qc.invalidateQueries({ queryKey: ["assets", property.id] }) });
  return (
    <Card
      title={t("assets.title")}
      pad={!data?.length}
      actions={
        canEdit && (
          <button className="btn btn-sm" onClick={() => setModal({})}>
            <Plus size={13} /> {t("assets.add")}
          </button>
        )
      }
    >
      <ErrorBox error={error || archive.error} />
      {!data?.length ? (
        <Empty icon={<Package size={36} />} title={t("assets.empty_title")}>
          {t("assets.empty_body")}
        </Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("common.name")}</th>
                <th>{t("assets.make_model")}</th>
                <th>{t("assets.installed")}</th>
                <th>{t("assets.warranty")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((a) => (
                <tr key={a.id}>
                  <td>
                    <strong>{a.name}</strong>
                    <div className="small muted">
                      {t(`assets.cat_${a.category}`)}
                      {a.unit_name ? ` · ${a.unit_name}` : ""}
                      {a.location ? ` · ${a.location}` : ""}
                    </div>
                  </td>
                  <td className="small">
                    {[a.make, a.model].filter(Boolean).join(" ") || "—"}
                    {a.serial_number && <div className="muted mono">{a.serial_number}</div>}
                  </td>
                  <td className="small nowrap">
                    {date(a.installed_on) || "—"}
                    {a.purchase_price_cents != null && <div className="muted">{money(a.purchase_price_cents)}</div>}
                  </td>
                  <td className="nowrap">
                    {a.warranty_expires_on ? (
                      <Badge tone={a.warranty_status === "ok" ? "jade" : a.warranty_status === "expiring" ? "citrine" : ""}>
                        {a.warranty_status === "expired" ? t("assets.expired_on", { date: date(a.warranty_expires_on) }) : t("assets.until", { date: date(a.warranty_expires_on) })}
                      </Badge>
                    ) : (
                      <span className="small muted">—</span>
                    )}
                  </td>
                  <td className="right nowrap">
                    <button className="icon-btn" onClick={() => setDocs(a)} aria-label={t("assets.documents")} title={t("assets.documents")}>
                      <FolderOpen size={14} />
                    </button>
                    {canEdit && (
                      <>
                        <button className="icon-btn" onClick={() => setModal({ asset: a })} aria-label={t("common.edit")}>
                          <Pencil size={14} />
                        </button>
                        <button className="icon-btn" onClick={() => window.confirm(t("assets.archive_confirm", { name: a.name })) && archive.mutate(a.id)} aria-label={t("assets.archive")}>
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal && <AssetModal property={property} asset={modal.asset} onClose={() => setModal(null)} />}
      {docs && (
        <Modal title={t("assets.documents_for", { name: docs.name })} onClose={() => setDocs(null)} wide>
          <p className="small muted" style={{ marginBottom: 12 }}>
            {t("assets.documents_hint")}
          </p>
          <DocumentsPanel ownerType="asset" ownerId={docs.id} />
        </Modal>
      )}
    </Card>
  );
}

interface AccessItem {
  id: string;
  unit_id: string | null;
  unit_name: string | null;
  kind: string;
  label: string;
  code: string | null;
  quantity: number;
  holder: string | null;
  notes: string | null;
  changed_on: string | null;
}

function AccessModal({ property, item, onClose }: { property: Property; item?: AccessItem; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [f, setF] = useState({
    kind: item?.kind ?? "key",
    label: item?.label ?? "",
    unit_id: item?.unit_id ?? "",
    code: item?.code ?? "",
    quantity: item?.quantity ?? 1,
    holder: item?.holder ?? "",
    notes: item?.notes ?? "",
    changed_on: item?.changed_on ?? "",
  });
  const isCode = ["code", "lockbox"].includes(f.kind);
  const save = useMutation({
    mutationFn: () => {
      const body = { property_id: property.id, ...f, unit_id: f.unit_id || null, code: f.code || null, holder: f.holder || null, notes: f.notes || null, changed_on: f.changed_on || null };
      return item ? api.patch(`/access-items/${item.id}`, body) : api.post("/access-items", body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["access-items", property.id] });
      onClose();
    },
  });
  return (
    <Modal
      title={item ? t("access.edit") : t("access.add")}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="btn btn-primary" disabled={!f.label.trim() || save.isPending} onClick={() => save.mutate()}>
            {t("common.save")}
          </button>
        </>
      }
    >
      <div className="form">
        <ErrorBox error={save.error} />
        <div className="form-row">
          <Field label={t("common.type")}>
            <Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} options={ACCESS_KINDS.map((k) => ({ value: k, label: t(`access.kind_${k}`) }))} />
          </Field>
          <Field label={t("access.label")}>
            <Input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} placeholder={t("access.label_placeholder")} maxLength={120} autoFocus />
          </Field>
        </div>
        <div className="form-row">
          <Field label={t("common.unit")}>
            <Select value={f.unit_id} onChange={(e) => setF({ ...f, unit_id: e.target.value })} options={[{ value: "", label: t("assets.shared") }, ...(property.units ?? []).map((u) => ({ value: u.id, label: u.name }))]} />
          </Field>
          {isCode ? (
            <Field label={t("access.code")}>
              <Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} maxLength={120} autoComplete="off" className="input mono" />
            </Field>
          ) : (
            <Field label={t("access.quantity")}>
              <Input type="number" min={0} max={999} value={f.quantity} onChange={(e) => setF({ ...f, quantity: Number(e.target.value) })} />
            </Field>
          )}
        </div>
        <div className="form-row">
          <Field label={t("access.holder")}>
            <Input value={f.holder} onChange={(e) => setF({ ...f, holder: e.target.value })} placeholder={t("access.holder_placeholder")} maxLength={120} />
          </Field>
          <Field label={t("access.changed_on")}>
            <Input type="date" value={f.changed_on} onChange={(e) => setF({ ...f, changed_on: e.target.value })} />
          </Field>
        </div>
        <Field label={t("common.notes")}>
          <Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} maxLength={1000} />
        </Field>
        <p className="small muted">{t("access.privacy")}</p>
      </div>
    </Modal>
  );
}

export function AccessPanel({ property }: { property: Property }) {
  const { t } = useTranslation();
  const { can } = useAuth();
  const qc = useQueryClient();
  const canEdit = can("owner", "manager");
  const [modal, setModal] = useState<{ item?: AccessItem } | null>(null);
  const [shown, setShown] = useState<Set<string>>(new Set());
  const { data, error } = useQuery({ queryKey: ["access-items", property.id], queryFn: () => api.get<AccessItem[]>(`/access-items?property_id=${property.id}`) });
  const remove = useMutation({ mutationFn: (id: string) => api.del(`/access-items/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["access-items", property.id] }) });
  const toggle = (id: string) => setShown((s) => new Set(s.has(id) ? [...s].filter((x) => x !== id) : [...s, id]));
  return (
    <Card
      title={t("access.title")}
      pad={!data?.length}
      actions={
        canEdit && (
          <button className="btn btn-sm" onClick={() => setModal({})}>
            <Plus size={13} /> {t("common.add")}
          </button>
        )
      }
    >
      <ErrorBox error={error || remove.error} />
      {!data?.length ? (
        <Empty icon={<KeyRound size={36} />} title={t("access.empty_title")}>
          {t("access.empty_body")}
        </Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("access.label")}</th>
                <th>{t("access.code_or_qty")}</th>
                <th>{t("access.holder")}</th>
                <th>{t("access.changed_on")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((i) => (
                <tr key={i.id}>
                  <td>
                    <strong>{i.label}</strong>
                    <div className="small muted">
                      {t(`access.kind_${i.kind}`)}
                      {i.unit_name ? ` · ${i.unit_name}` : ""}
                    </div>
                  </td>
                  <td>
                    {i.code ? (
                      <span className="nowrap">
                        <span className="mono">{shown.has(i.id) ? i.code : "••••"}</span>{" "}
                        {i.code !== "••••" && (
                          <button className="icon-btn" onClick={() => toggle(i.id)} aria-label={shown.has(i.id) ? t("access.hide") : t("access.show")}>
                            {shown.has(i.id) ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                        )}
                      </span>
                    ) : (
                      <span className="small">× {i.quantity}</span>
                    )}
                  </td>
                  <td className="small">{i.holder ?? "—"}</td>
                  <td className="small nowrap">{date(i.changed_on) || "—"}</td>
                  <td className="right nowrap">
                    {canEdit && (
                      <>
                        <button className="icon-btn" onClick={() => setModal({ item: i })} aria-label={t("common.edit")}>
                          <Pencil size={14} />
                        </button>
                        <button className="icon-btn" onClick={() => window.confirm(t("access.delete_confirm", { label: i.label })) && remove.mutate(i.id)} aria-label={t("common.delete")}>
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal && <AccessModal property={property} item={modal.item} onClose={() => setModal(null)} />}
    </Card>
  );
}
