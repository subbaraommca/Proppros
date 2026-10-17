import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FolderOpen } from "lucide-react";
import { api } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import type { DocumentRow } from "../types";
import { DOC_KINDS, DocumentList, UploadButton } from "../components/Documents";
import { Card, Empty, ErrorBox, PageHeader, Select, Spinner } from "../components/ui";
import { label } from "../utils/format";

export function DocumentsPage() {
  const { org, can } = useAuth();
  const [kind, setKind] = useState("");
  const [owner, setOwner] = useState("");
  const [expiring, setExpiring] = useState(false);
  const qs = new URLSearchParams({
    ...(kind ? { kind } : {}),
    ...(owner ? { owner_type: owner } : {}),
    ...(expiring ? { expiring_within_days: "60" } : {}),
  }).toString();
  const { data, error, isLoading } = useQuery({ queryKey: ["documents", "vault", qs], queryFn: () => api.get<DocumentRow[]>(`/documents?${qs}`) });

  return (
    <>
      <PageHeader
        title="Documents"
        subtitle="Every lease, policy, receipt and photo across your portfolio. Add expiry dates to get reminders."
        actions={org && can("owner", "manager") && <UploadButton ownerType="organization" ownerId={org.id} label="Upload general document" />}
      />
      <div className="toolbar">
        <Select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Type" options={[{ value: "", label: "All types" }, ...DOC_KINDS.map((k) => ({ value: k, label: label(k) }))]} />
        <Select
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          aria-label="Attached to"
          options={[{ value: "", label: "Attached to anything" }, ...["organization", "property", "unit", "tenant", "lease", "expense", "work_order"].map((o) => ({ value: o, label: label(o) }))]}
        />
        <label className="check small">
          <input type="checkbox" checked={expiring} onChange={(e) => setExpiring(e.target.checked)} /> Expiring within 60 days
        </label>
      </div>
      <ErrorBox error={error} />
      {isLoading ? (
        <Spinner />
      ) : data?.length === 0 ? (
        <Card>
          <Empty icon={<FolderOpen size={40} />} title="No documents found">
            Upload documents from a property, tenant, lease or work order page — or add general documents here.
          </Empty>
        </Card>
      ) : (
        <Card>
          <DocumentList docs={data ?? []} showOwner canEdit={can("owner", "manager")} />
        </Card>
      )}
    </>
  );
}
