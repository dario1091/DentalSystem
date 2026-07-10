import { useState } from "react";
import DocumentGallery from "./DocumentGallery";
import DocumentViewer from "./DocumentViewer";
import { useDocuments } from "../hooks/useDocuments";
import type { Document } from "../types";

interface DocumentsTabProps {
  patientId: number;
}

export default function DocumentsTab({ patientId }: DocumentsTabProps) {
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null);
  const [allDocs, setAllDocs] = useState<Document[]>([]);
  const { listDocuments } = useDocuments();

  const handleViewDocument = async (doc: Document) => {
    // Load full list for navigation
    try {
      const docs = await listDocuments({ patient_id: patientId });
      setAllDocs(docs);
    } catch {
      setAllDocs([doc]);
    }
    setViewingDoc(doc);
  };

  return (
    <>
      <DocumentGallery patientId={patientId} onViewDocument={handleViewDocument} />

      {viewingDoc && (
        <DocumentViewer
          document={viewingDoc}
          documents={allDocs}
          onClose={() => setViewingDoc(null)}
          onNavigate={(doc) => setViewingDoc(doc)}
        />
      )}
    </>
  );
}
