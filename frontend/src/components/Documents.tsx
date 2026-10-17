import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, FileText, Image as ImageIcon, Trash2, Upload } from "lucide-react";
import { api, fileUrl } from "../services/api";
import type { DocumentRow } from "../types";
import { date, fileSize, label } from "../utils/format";
import { Badge, ErrorBox, Field, Input, Modal, Select } from "./ui";
import { useAuth } from "../hooks/useAuth";

export const DOC_KINDS = ["photo", "lease", "insurance", "deed", "hoa", "inspection", "receipt", "invoice", "license", "id", "other"];

export function DocIcon({ doc }: { doc: DocumentRow }) {
  return doc.content_type.startsWith("image/") ? <ImageIcon size={16} /> : <FileText size={16} />;
}

export function UploadButton({
  ownerType,
  ownerId,
  defaultKind = "other",
  allowTenantShare = false,
  onUploaded,
  label: btnLabel = "Upload",
}: {
  ownerType: string;
  ownerId: string;
  defaultKind?: string;
  allowTenantShare?: boolean;
  onUploaded?: (doc: DocumentRow) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState(defaultKind);
  const [expires, setExpires] = useState("");
  const [share, setShare] = useState(false);
  const qc = useQueryClient();
  const upload = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append("file", file!);
      form.append("owner_type", ownerType);
      form.append("owner_id", ownerId);
      form.append("kind", kind);
      if (expires) form.append("expires_on", expires);
      form.append("visible_to_tenant", String(share));
      return api.upload<DocumentRow>("/documents", form);
    },
    onSuccess: (doc) => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      onUploaded?.(doc);
      setOpen(false);
      setFile(null);
      setExpires("");
      setShare(false);
    },
  });
  return (
    <>
      <button className="btn btn-sm" onClick={() => setOpen(true)}>
        <Upload size={14} /> {btnLabel}
      </button>
      {open && (
        <Modal
          title="Upload document"
          onClose={() => setOpen(false)}
          footer={
            <>
              <button className="btn" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" disabled={!file || upload.isPending} onClick={() => upload.mutate()}>
                {upload.isPending ? "Uploading…" : "Upload"}
              </button>
            </>
          }
        >
          <div className="form">
            <ErrorBox error={upload.error} />
            <Field label="File" hint="PDF, image, video or Office document · max 4 MB">
              <input className="input" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </Field>
            <div className="form-row">
              <Field label="Type">
                <Select value={kind} onChange={(e) => setKind(e.target.value)} options={DOC_KINDS} />
              </Field>
              <Field label="Expires on" hint="(optional)">
                <Input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
              </Field>
            </div>
            {allowTenantShare && (
              <label className="check">
                <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} /> Share with tenant in their portal
              </label>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

export function DocumentList({ docs, showOwner = false, canEdit = true }: { docs: DocumentRow[]; showOwner?: boolean; canEdit?: boolean }) {
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/documents/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });
  const toggleShare = useMutation({
    mutationFn: (d: DocumentRow) => api.patch(`/documents/${d.id}`, { visible_to_tenant: !d.visible_to_tenant }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });
  if (docs.length === 0) return <p className="muted">No documents yet.</p>;
  return (
    <div className="doc-list">
      <ErrorBox error={remove.error} />
      {docs.map((d) => {
        const expiringSoon = d.expires_on && new Date(d.expires_on) < new Date(Date.now() + 30 * 864e5);
        return (
          <div className="doc-row" key={d.id}>
            <DocIcon doc={d} />
            <a className="name" href={fileUrl(`/documents/${d.id}/file`)} target="_blank" rel="noreferrer" title={d.name}>
              {d.name}
            </a>
            <Badge>{label(d.kind)}</Badge>
            {showOwner && d.owner_label && <span className="small muted nowrap">{d.owner_label}</span>}
            {d.expires_on && <Badge tone={expiringSoon ? "citrine" : ""}>Expires {date(d.expires_on)}</Badge>}
            <span className="small muted nowrap">{fileSize(d.size_bytes)}</span>
            {canEdit && ["lease", "unit", "tenant", "work_order"].includes(d.owner_type) && (
              <button
                className="icon-btn"
                title={d.visible_to_tenant ? "Shared with tenant — click to hide" : "Not shared — click to share with tenant"}
                aria-label="Toggle tenant visibility"
                onClick={() => toggleShare.mutate(d)}
              >
                {d.visible_to_tenant ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
            )}
            {canEdit && (
              <button
                className="icon-btn"
                aria-label={`Delete ${d.name}`}
                onClick={() => window.confirm(`Delete ${d.name}?`) && remove.mutate(d.id)}
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Documents attached to one record, with upload. */
export function DocumentsPanel({ ownerType, ownerId, allowTenantShare = false }: { ownerType: string; ownerId: string; allowTenantShare?: boolean }) {
  const { can } = useAuth();
  const { data, error } = useQuery({
    queryKey: ["documents", ownerType, ownerId],
    queryFn: () => api.get<DocumentRow[]>(`/documents?owner_type=${ownerType}&owner_id=${ownerId}`),
  });
  const canEdit = can("owner", "manager");
  return (
    <section className="card">
      <div className="card-header">
        <h2>Documents</h2>
        {canEdit && <UploadButton ownerType={ownerType} ownerId={ownerId} allowTenantShare={allowTenantShare} />}
      </div>
      <div className="card-body">
        <ErrorBox error={error} />
        {data && <DocumentList docs={data.filter((d) => d.kind !== "photo" || ownerType !== "property")} canEdit={canEdit} />}
      </div>
    </section>
  );
}

/** Photo grid for properties / work orders. */
export function PhotoGrid({ ownerType, ownerId, canUpload }: { ownerType: string; ownerId: string; canUpload: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["documents", ownerType, ownerId],
    queryFn: () => api.get<DocumentRow[]>(`/documents?owner_type=${ownerType}&owner_id=${ownerId}`),
  });
  const upload = useMutation({
    mutationFn: async (files: FileList) => {
      for (const f of Array.from(files)) {
        const form = new FormData();
        form.append("file", f);
        form.append("owner_type", ownerType);
        form.append("owner_id", ownerId);
        form.append("kind", "photo");
        await api.upload("/documents", form);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });
  const photos = (data ?? []).filter((d) => d.content_type.startsWith("image/"));
  return (
    <div className="stack">
      <ErrorBox error={upload.error} />
      {photos.length > 0 ? (
        <div className="photo-grid">
          {photos.map((p) => (
            <a key={p.id} href={fileUrl(`/documents/${p.id}/file`)} target="_blank" rel="noreferrer">
              <img src={fileUrl(`/documents/${p.id}/file`)} alt={p.name} loading="lazy" />
            </a>
          ))}
        </div>
      ) : (
        <p className="muted">No photos yet.</p>
      )}
      {canUpload && (
        <div>
          <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && upload.mutate(e.target.files)} />
          <button className="btn btn-sm" onClick={() => inputRef.current?.click()} disabled={upload.isPending}>
            <Upload size={14} /> {upload.isPending ? "Uploading…" : "Add photos"}
          </button>
        </div>
      )}
    </div>
  );
}
