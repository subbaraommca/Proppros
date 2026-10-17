import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Building2, MapPin, Plus } from "lucide-react";
import { api, fileUrl } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import type { Property } from "../types";
import { Card, Empty, ErrorBox, Field, Input, Modal, MoneyInput, PageHeader, Select, Spinner, Textarea } from "../components/ui";
import { fromCents, label, toCents } from "../utils/format";

export const PROPERTY_TYPES = ["single_family", "multi_family", "condo", "townhouse", "commercial", "other"];

type PropertyForm = {
  name: string;
  property_type: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  postal_code: string;
  purchase_date: string;
  purchase_price: string;
  notes: string;
};

export function emptyPropertyForm(p?: Property): PropertyForm {
  return {
    name: p?.name ?? "",
    property_type: p?.property_type ?? "single_family",
    address_line1: p?.address_line1 ?? "",
    address_line2: p?.address_line2 ?? "",
    city: p?.city ?? "",
    state: p?.state ?? "",
    postal_code: p?.postal_code ?? "",
    purchase_date: p?.purchase_date ?? "",
    purchase_price: fromCents(p?.purchase_price_cents),
    notes: p?.notes ?? "",
  };
}

export function PropertyFormModal({ property, onClose }: { property?: Property; onClose: () => void }) {
  const { t } = useTranslation();
  const [f, setF] = useState<PropertyForm>(emptyPropertyForm(property));
  const qc = useQueryClient();
  const navigate = useNavigate();
  const set = (k: keyof PropertyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const save = useMutation({
    mutationFn: () => {
      const body = {
        ...f,
        address_line2: f.address_line2 || null,
        purchase_date: f.purchase_date || null,
        purchase_price_cents: toCents(f.purchase_price),
        notes: f.notes || null,
      };
      delete (body as Partial<PropertyForm>).purchase_price;
      return property ? api.patch<Property>(`/properties/${property.id}`, body) : api.post<Property>("/properties", body);
    },
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["properties"] });
      qc.invalidateQueries({ queryKey: ["property", p.id] });
      onClose();
      if (!property) navigate(`/properties/${p.id}`);
    },
  });
  return (
    <Modal
      title={property ? t("properties.edit_title") : t("properties.add")}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="btn btn-primary" onClick={() => save.mutate()} disabled={save.isPending || !f.name || !f.address_line1 || !f.city || !f.state || !f.postal_code}>
            {save.isPending ? t("common.saving") : t("properties.save")}
          </button>
        </>
      }
    >
      <div className="form">
        <ErrorBox error={save.error} />
        <div className="form-row">
          <Field label={t("common.name")} hint={t("properties.name_hint")}>
            <Input value={f.name} onChange={set("name")} autoFocus />
          </Field>
          <Field label={t("common.type")}>
            <Select value={f.property_type} onChange={set("property_type")} options={PROPERTY_TYPES} />
          </Field>
        </div>
        <Field label={t("properties.street")}>
          <Input value={f.address_line1} onChange={set("address_line1")} autoComplete="address-line1" />
        </Field>
        <Field label={t("properties.address2")} hint={t("common.optional_hint")}>
          <Input value={f.address_line2} onChange={set("address_line2")} autoComplete="address-line2" />
        </Field>
        <div className="form-row-3">
          <Field label={t("properties.city")}>
            <Input value={f.city} onChange={set("city")} autoComplete="address-level2" />
          </Field>
          <Field label={t("properties.state")}>
            <Input value={f.state} onChange={set("state")} autoComplete="address-level1" />
          </Field>
          <Field label={t("properties.zip")}>
            <Input value={f.postal_code} onChange={set("postal_code")} autoComplete="postal-code" />
          </Field>
        </div>
        <div className="form-row">
          <Field label={t("properties.purchase_date")} hint={t("common.optional_hint")}>
            <Input type="date" value={f.purchase_date} onChange={set("purchase_date")} />
          </Field>
          <Field label={t("properties.purchase_price")} hint={t("common.optional_hint")}>
            <MoneyInput value={f.purchase_price} onChange={(v) => setF({ ...f, purchase_price: v })} />
          </Field>
        </div>
        <Field label={t("common.notes")} hint={t("common.optional_hint")}>
          <Textarea value={f.notes} onChange={set("notes")} />
        </Field>
        {!property && ["single_family", "condo", "townhouse"].includes(f.property_type) && <p className="small muted">{t("properties.main_unit_note")}</p>}
      </div>
    </Modal>
  );
}

export function PropertiesPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const [showArchived, setShowArchived] = useState(false);
  const creating = params.get("new") === "1";
  const { data, error, isLoading } = useQuery({
    queryKey: ["properties", showArchived],
    queryFn: () => api.get<Property[]>(`/properties${showArchived ? "?include_archived=true" : ""}`),
  });
  const canEdit = can("owner", "manager");
  const openNew = () => setParams({ new: "1" });

  return (
    <>
      <PageHeader
        title={t("nav.properties")}
        subtitle={data ? t("dashboard.property_count", { count: data.length }) : undefined}
        actions={
          <>
            <label className="check small">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> {t("properties.show_archived")}
            </label>
            {canEdit && (
              <button className="btn btn-primary" onClick={openNew}>
                <Plus size={16} /> {t("properties.add")}
              </button>
            )}
          </>
        }
      />
      {params.get("welcome") && (
        <div className="success-box" style={{ marginBottom: 16 }}>
          {t("properties.welcome")}
        </div>
      )}
      <ErrorBox error={error} />
      {isLoading ? (
        <Spinner />
      ) : data && data.length === 0 ? (
        <Card>
          <Empty
            icon={<Building2 size={40} />}
            title={t("properties.empty_title")}
            action={
              canEdit && (
                <button className="btn btn-primary" onClick={openNew}>
                  {t("properties.add_first")}
                </button>
              )
            }
          >
            {t("properties.empty_body")}
          </Empty>
        </Card>
      ) : (
        <div className="grid grid-cards">
          {data?.map((p) => (
            <Link key={p.id} to={`/properties/${p.id}`} className="card property-card">
              <div className="property-photo" style={p.cover_photo_id ? { backgroundImage: `url(${fileUrl(`/documents/${p.cover_photo_id}/file`)})` } : undefined}>
                {!p.cover_photo_id && <Building2 size={36} />}
              </div>
              <div className="card-body stack" style={{ gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <h3>{p.name}</h3>
                  {p.archived_at ? <span className="badge">{t("properties.archived")}</span> : <span className="badge">{label(p.property_type)}</span>}
                </div>
                <div className="small muted">
                  <MapPin size={12} /> {p.address_line1}, {p.city}, {p.state}
                </div>
                <div className="progress" aria-label={t("properties.occupied_pct", { pct: p.occupancy_pct })}>
                  <span style={{ width: `${p.occupancy_pct}%` }} />
                </div>
                <div className="small muted">{t("properties.units_occupied", { occupied: p.occupied_count, count: p.unit_count })}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
      {creating && <PropertyFormModal onClose={() => setParams({})} />}
    </>
  );
}
