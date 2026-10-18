import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Archive, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { api, fileUrl } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import type { DocumentRow, Lease, Property, Unit } from "../types";
import { DocumentsPanel, PhotoGrid } from "../components/Documents";
import { Badge, BalanceText, Card, ErrorBox, Field, Input, Modal, MoneyInput, PageHeader, Spinner, Tabs, Textarea } from "../components/ui";
import { date, fromCents, label, money, toCents } from "../utils/format";
import { AccessPanel, AssetsPanel } from "../components/PropertyAssets";
import { PropertyFormModal } from "./PropertiesPage";

function UnitModal({ propertyId, unit, onClose }: { propertyId: string; unit?: Unit; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [f, setF] = useState({
    name: unit?.name ?? "",
    beds: unit?.beds?.toString() ?? "",
    baths: unit?.baths?.toString() ?? "",
    sqft: unit?.sqft?.toString() ?? "",
    market_rent: fromCents(unit?.market_rent_cents),
    amenities: unit?.amenities.join(", ") ?? "",
    notes: unit?.notes ?? "",
    maintenance: unit?.status === "maintenance",
  });
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        name: f.name,
        beds: num(f.beds),
        baths: num(f.baths),
        sqft: num(f.sqft),
        market_rent_cents: toCents(f.market_rent),
        amenities: f.amenities.split(",").map((a) => a.trim()).filter(Boolean),
        notes: f.notes || null,
      };
      if (unit && unit.status !== "occupied") body.status = f.maintenance ? "maintenance" : "vacant";
      return unit ? api.patch(`/units/${unit.id}`, body) : api.post(`/properties/${propertyId}/units`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["property", propertyId] });
      qc.invalidateQueries({ queryKey: ["properties"] });
      onClose();
    },
  });
  return (
    <Modal
      title={unit ? t("units.edit_title", { name: unit.name }) : t("units.add")}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className="btn btn-primary" disabled={!f.name || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? t("common.saving") : t("units.save")}
          </button>
        </>
      }
    >
      <div className="form">
        <ErrorBox error={save.error} />
        <div className="form-row">
          <Field label={t("units.name")} hint={t("units.name_hint")}>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />
          </Field>
          <Field label={t("units.market_rent")} hint={t("common.optional_hint")}>
            <MoneyInput value={f.market_rent} onChange={(v) => setF({ ...f, market_rent: v })} />
          </Field>
        </div>
        <div className="form-row-3">
          <Field label={t("units.beds")}>
            <Input type="number" min={0} step="1" value={f.beds} onChange={(e) => setF({ ...f, beds: e.target.value })} />
          </Field>
          <Field label={t("units.baths")}>
            <Input type="number" min={0} step="0.5" value={f.baths} onChange={(e) => setF({ ...f, baths: e.target.value })} />
          </Field>
          <Field label={t("units.sqft")}>
            <Input type="number" min={0} value={f.sqft} onChange={(e) => setF({ ...f, sqft: e.target.value })} />
          </Field>
        </div>
        <Field label={t("units.amenities")} hint={t("units.amenities_hint")}>
          <Input value={f.amenities} onChange={(e) => setF({ ...f, amenities: e.target.value })} placeholder={t("units.amenities_placeholder")} />
        </Field>
        <Field label={t("common.notes")} hint={t("common.optional_hint")}>
          <Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
        {unit && unit.status !== "occupied" && (
          <label className="check">
            <input type="checkbox" checked={f.maintenance} onChange={(e) => setF({ ...f, maintenance: e.target.checked })} /> {t("units.offline")}
          </label>
        )}
      </div>
    </Modal>
  );
}

export function PropertyDetailPage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const { can } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"units" | "photos" | "documents" | "assets" | "keys">("units");
  const [editing, setEditing] = useState(false);
  const [unitModal, setUnitModal] = useState<{ unit?: Unit } | null>(null);
  const canEdit = can("owner", "manager");
  const canFinance = can("owner", "manager", "accountant");

  const { data: p, error, isLoading } = useQuery({ queryKey: ["property", id], queryFn: () => api.get<Property>(`/properties/${id}`) });
  const { data: leases } = useQuery({
    queryKey: ["leases", "property", id],
    queryFn: () => api.get<Lease[]>("/leases?status=active"),
    enabled: canFinance,
    select: (all) => all.filter((l) => l.property_id === id),
  });
  const { data: photos } = useQuery({
    queryKey: ["documents", "property", id],
    queryFn: () => api.get<DocumentRow[]>(`/documents?owner_type=property&owner_id=${id}`),
    enabled: tab === "photos",
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["property", id] });
    qc.invalidateQueries({ queryKey: ["properties"] });
  };
  const archive = useMutation({ mutationFn: () => api.post(`/properties/${id}/archive`), onSuccess: invalidate });
  const remove = useMutation({
    mutationFn: () => api.del(`/properties/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["properties"] });
      navigate("/properties");
    },
  });
  const setCover = useMutation({ mutationFn: (docId: string) => api.patch(`/properties/${id}`, { cover_photo_id: docId }), onSuccess: invalidate });
  const deleteUnit = useMutation({ mutationFn: (unitId: string) => api.del(`/units/${unitId}`), onSuccess: invalidate });

  if (isLoading) return <Spinner />;
  if (error || !p) return <ErrorBox error={error} />;
  const leaseByUnit = new Map((leases ?? []).map((l) => [l.unit_id, l]));

  return (
    <>
      <PageHeader
        breadcrumb={<Link to="/properties">{t("nav.properties")}</Link>}
        title={p.name}
        subtitle={`${p.address_line1}${p.address_line2 ? `, ${p.address_line2}` : ""}, ${p.city}, ${p.state} ${p.postal_code}`}
        actions={
          canEdit && (
            <>
              <button className="btn" onClick={() => setEditing(true)}>
                <Pencil size={15} /> {t("common.edit")}
              </button>
              <button className="btn" onClick={() => archive.mutate()} disabled={archive.isPending}>
                <Archive size={15} /> {p.archived_at ? t("properties.unarchive") : t("properties.archive")}
              </button>
              <button
                className="btn btn-danger"
                aria-label={t("common.delete")}
                onClick={() => window.confirm(t("properties.delete_confirm", { name: p.name })) && remove.mutate()}
              >
                <Trash2 size={15} />
              </button>
            </>
          )
        }
      />
      <div className="stack">
        <ErrorBox error={archive.error || remove.error || deleteUnit.error} />
        <div className="grid grid-4">
          <div className="card stat">
            <div className="stat-label">{t("common.type")}</div>
            <div className="stat-value" style={{ fontSize: 18 }}>
              {label(p.property_type)}
            </div>
          </div>
          <div className="card stat">
            <div className="stat-label">{t("dashboard.occupancy")}</div>
            <div className="stat-value">{p.occupancy_pct}%</div>
            <div className="stat-sub">{t("dashboard.units_occupied", { occupied: p.occupied_count, count: p.unit_count })}</div>
          </div>
          <div className="card stat">
            <div className="stat-label">{t("properties.purchased")}</div>
            <div className="stat-value" style={{ fontSize: 18 }}>
              {date(p.purchase_date)}
            </div>
            <div className="stat-sub">{money(p.purchase_price_cents)}</div>
          </div>
          <div className="card stat">
            <div className="stat-label">{t("properties.monthly_rent")}</div>
            <div className="stat-value">{money((leases ?? []).reduce((s, l) => s + l.rent_cents, 0))}</div>
            <div className="stat-sub">{t("properties.from_active_leases")}</div>
          </div>
        </div>
        {p.notes && <Card title={t("common.notes")}>{p.notes}</Card>}

        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: "units", label: t("properties.units_tab", { count: p.unit_count }) },
            { id: "photos", label: t("properties.photos") },
            { id: "documents", label: t("documents.title") },
            { id: "assets", label: t("assets.tab") },
            { id: "keys", label: t("access.tab") },
          ]}
        />

        {tab === "units" && (
          <Card
            title={t("properties.units")}
            pad={false}
            actions={
              canEdit && (
                <button className="btn btn-sm" onClick={() => setUnitModal({})}>
                  <Plus size={14} /> {t("units.add")}
                </button>
              )
            }
          >
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t("common.unit")}</th>
                    <th>{t("common.status")}</th>
                    <th>{t("units.beds_baths")}</th>
                    <th>{t("common.tenants")}</th>
                    <th className="num">{t("common.rent")}</th>
                    {canFinance && <th className="num">{t("common.balance")}</th>}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {p.units?.map((u) => {
                    const lease = leaseByUnit.get(u.id);
                    return (
                      <tr key={u.id}>
                        <td>
                          <strong>{u.name}</strong>
                          {u.sqft && <div className="small muted">{t("units.sqft_value", { sqft: u.sqft })}</div>}
                        </td>
                        <td>
                          <Badge value={u.status} />
                        </td>
                        <td>{t("units.bd_ba", { beds: u.beds ?? "—", baths: u.baths ?? "—" })}</td>
                        <td>
                          {lease ? (
                            <Link to={`/leases/${lease.id}`}>{lease.tenants.map((tn) => tn.name).join(", ")}</Link>
                          ) : canEdit ? (
                            <Link to={`/leases/new?unit=${u.id}`} className="small">
                              {t("units.add_lease")}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="num">{lease ? money(lease.rent_cents) : <span className="muted">{money(u.market_rent_cents)}</span>}</td>
                        {canFinance && <td className="num">{lease ? <BalanceText cents={lease.balance_cents} /> : "—"}</td>}
                        <td className="right nowrap">
                          {canEdit && (
                            <>
                              <button className="icon-btn" aria-label={t("units.edit_label", { name: u.name })} onClick={() => setUnitModal({ unit: u })}>
                                <Pencil size={15} />
                              </button>
                              {!lease && (
                                <button
                                  className="icon-btn"
                                  aria-label={t("units.delete_label", { name: u.name })}
                                  onClick={() => window.confirm(t("units.delete_confirm", { name: u.name })) && deleteUnit.mutate(u.id)}
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {p.units?.length === 0 && (
                    <tr>
                      <td colSpan={7} className="muted">
                        {t("units.none")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {tab === "photos" && (
          <Card title={t("properties.photos")}>
            <PhotoGrid ownerType="property" ownerId={p.id} canUpload={canEdit} />
            {canEdit && photos && photos.filter((d) => d.content_type.startsWith("image/")).length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div className="small muted" style={{ marginBottom: 6 }}>
                  {t("properties.cover_photo")}
                </div>
                <div className="chip-list">
                  {photos
                    .filter((d) => d.content_type.startsWith("image/"))
                    .map((d) => (
                      <button
                        key={d.id}
                        className={`btn btn-sm${p.cover_photo_id === d.id ? " btn-primary" : ""}`}
                        onClick={() => setCover.mutate(d.id)}
                        aria-label={t("properties.set_cover", { name: d.name })}
                      >
                        <Star size={13} />
                        <img src={fileUrl(`/documents/${d.id}/file`)} alt="" width={28} height={20} style={{ objectFit: "cover", borderRadius: 3 }} />
                      </button>
                    ))}
                </div>
              </div>
            )}
          </Card>
        )}

        {tab === "documents" && <DocumentsPanel ownerType="property" ownerId={p.id} />}
        {tab === "assets" && <AssetsPanel property={p} />}
        {tab === "keys" && <AccessPanel property={p} />}
      </div>

      {editing && <PropertyFormModal property={p} onClose={() => setEditing(false)} />}
      {unitModal && <UnitModal propertyId={p.id} unit={unitModal.unit} onClose={() => setUnitModal(null)} />}
    </>
  );
}
