import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
      title={property ? "Edit property" : "Add property"}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => save.mutate()} disabled={save.isPending || !f.name || !f.address_line1 || !f.city || !f.state || !f.postal_code}>
            {save.isPending ? "Saving…" : "Save property"}
          </button>
        </>
      }
    >
      <div className="form">
        <ErrorBox error={save.error} />
        <div className="form-row">
          <Field label="Name" hint="e.g. Oak Street House">
            <Input value={f.name} onChange={set("name")} autoFocus />
          </Field>
          <Field label="Type">
            <Select value={f.property_type} onChange={set("property_type")} options={PROPERTY_TYPES} />
          </Field>
        </div>
        <Field label="Street address">
          <Input value={f.address_line1} onChange={set("address_line1")} autoComplete="address-line1" />
        </Field>
        <Field label="Address line 2" hint="(optional)">
          <Input value={f.address_line2} onChange={set("address_line2")} autoComplete="address-line2" />
        </Field>
        <div className="form-row-3">
          <Field label="City">
            <Input value={f.city} onChange={set("city")} autoComplete="address-level2" />
          </Field>
          <Field label="State">
            <Input value={f.state} onChange={set("state")} autoComplete="address-level1" />
          </Field>
          <Field label="ZIP">
            <Input value={f.postal_code} onChange={set("postal_code")} autoComplete="postal-code" />
          </Field>
        </div>
        <div className="form-row">
          <Field label="Purchase date" hint="(optional)">
            <Input type="date" value={f.purchase_date} onChange={set("purchase_date")} />
          </Field>
          <Field label="Purchase price" hint="(optional)">
            <MoneyInput value={f.purchase_price} onChange={(v) => setF({ ...f, purchase_price: v })} />
          </Field>
        </div>
        <Field label="Notes" hint="(optional)">
          <Textarea value={f.notes} onChange={set("notes")} />
        </Field>
        {!property && ["single_family", "condo", "townhouse"].includes(f.property_type) && (
          <p className="small muted">A unit called “Main” is created automatically. For multi-family properties you'll add units next.</p>
        )}
      </div>
    </Modal>
  );
}

export function PropertiesPage() {
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
        title="Properties"
        subtitle={data ? `${data.length} propert${data.length === 1 ? "y" : "ies"}` : undefined}
        actions={
          <>
            <label className="check small">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Show archived
            </label>
            {canEdit && (
              <button className="btn btn-primary" onClick={openNew}>
                <Plus size={16} /> Add property
              </button>
            )}
          </>
        }
      />
      {params.get("welcome") && (
        <div className="success-box" style={{ marginBottom: 16 }}>
          Welcome to Proppros! Start by adding your properties, then tenants and leases.
        </div>
      )}
      <ErrorBox error={error} />
      {isLoading ? (
        <Spinner />
      ) : data && data.length === 0 ? (
        <Card>
          <Empty icon={<Building2 size={40} />} title="No properties yet" action={canEdit && <button className="btn btn-primary" onClick={openNew}>Add your first property</button>}>
            Add each rental property with its address. Units come next.
          </Empty>
        </Card>
      ) : (
        <div className="grid grid-cards">
          {data?.map((p) => (
            <Link key={p.id} to={`/properties/${p.id}`} className="card property-card">
              <div
                className="property-photo"
                style={p.cover_photo_id ? { backgroundImage: `url(${fileUrl(`/documents/${p.cover_photo_id}/file`)})` } : undefined}
              >
                {!p.cover_photo_id && <Building2 size={36} />}
              </div>
              <div className="card-body stack" style={{ gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <h3>{p.name}</h3>
                  {p.archived_at ? <span className="badge">Archived</span> : <span className="badge">{label(p.property_type)}</span>}
                </div>
                <div className="small muted">
                  <MapPin size={12} /> {p.address_line1}, {p.city}, {p.state}
                </div>
                <div className="progress" aria-label={`${p.occupancy_pct}% occupied`}>
                  <span style={{ width: `${p.occupancy_pct}%` }} />
                </div>
                <div className="small muted">
                  {p.occupied_count} of {p.unit_count} unit{p.unit_count === 1 ? "" : "s"} occupied
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
      {creating && <PropertyFormModal onClose={() => setParams({})} />}
    </>
  );
}
