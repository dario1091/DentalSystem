import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload,
  Grid,
  List,
  Trash2,
  Eye,
  Image,
  FileText,
  Filter,
  File,
} from "lucide-react";
import { Button, Badge, Modal } from "@shared/components/ui";
import { useToast } from "@shared/components/ui";
import { useDocuments } from "../hooks/useDocuments";
import type { Document } from "../types";
import { DOCUMENT_TYPES, ALLOWED_EXTENSIONS, MAX_FILE_SIZE } from "../types";

interface DocumentGalleryProps {
  patientId: number;
  onViewDocument: (doc: Document) => void;
}

type ViewMode = "grid" | "list";

export default function DocumentGallery({ patientId, onViewDocument }: DocumentGalleryProps) {
  const { toast } = useToast();
  const { uploadDocument, listDocuments, deleteDocument } = useDocuments();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [filterType, setFilterType] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState("otro");
  const [uploadNotes, setUploadNotes] = useState("");

  const loadDocuments = useCallback(async () => {
    try {
      const docs = await listDocuments({
        patient_id: patientId,
        document_type: filterType || null,
      });
      setDocuments(docs);
    } catch (err) {
      toast("error", String(err));
    } finally {
      setLoading(false);
    }
  }, [patientId, filterType]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      toast("error", "Tipo de archivo no permitido. Solo: JPG, PNG, WEBP, PDF.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast("error", "El archivo excede 50 MB.");
      return;
    }

    setUploadFile(file);
    setShowUploadModal(true);
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);

    try {
      const buffer = await uploadFile.arrayBuffer();
      const data = Array.from(new Uint8Array(buffer));

      await uploadDocument({
        patient_id: patientId,
        original_name: uploadFile.name,
        document_type: uploadType,
        notes: uploadNotes || null,
        data,
      });

      toast("success", "Documento subido exitosamente.");
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadNotes("");
      await loadDocuments();
    } catch (err) {
      toast("error", String(err));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: Document) => {
    if (!confirm(`¿Eliminar "${doc.original_name}"?`)) return;
    try {
      await deleteDocument(doc.id);
      toast("success", "Documento eliminado.");
      await loadDocuments();
    } catch (err) {
      toast("error", String(err));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const isImage = (mime: string) => mime.startsWith("image/");

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return <div className="py-10 text-center text-sm text-gray-400">Cargando documentos...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-400" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-xs"
          >
            <option value="">Todos</option>
            {DOCUMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-gray-400">{documents.length} archivo(s)</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode("grid")}
            className={`rounded p-1.5 ${viewMode === "grid" ? "bg-blue-100 text-blue-600" : "text-gray-400 hover:text-gray-600"}`}
          >
            <Grid size={16} />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`rounded p-1.5 ${viewMode === "list" ? "bg-blue-100 text-blue-600" : "text-gray-400 hover:text-gray-600"}`}
          >
            <List size={16} />
          </button>
          <Button
            variant="primary"
            size="sm"
            icon={<Upload size={14} />}
            onClick={() => fileInputRef.current?.click()}
          >
            Subir archivo
          </Button>
        </div>
      </div>

      {/* Drop zone / content */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`min-h-[200px] rounded-lg border-2 border-dashed transition-colors ${
          dragOver
            ? "border-blue-400 bg-blue-50"
            : "border-gray-200 bg-white"
        }`}
      >
        {documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <File size={40} className="text-gray-300" />
            <p className="text-sm text-gray-500">No hay documentos.</p>
            <p className="text-xs text-gray-400">Arrastra archivos aquí o usa el botón "Subir archivo".</p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {documents.map((doc) => (
              <DocumentCard
                key={doc.id}
                document={doc}
                isImage={isImage(doc.mime_type)}
                onView={() => onViewDocument(doc)}
                onDelete={() => handleDelete(doc)}
                formatSize={formatSize}
              />
            ))}
          </div>
        ) : (
          <div className="divide-y divide-gray-100 p-2">
            {documents.map((doc) => (
              <DocumentRow
                key={doc.id}
                document={doc}
                isImage={isImage(doc.mime_type)}
                onView={() => onViewDocument(doc)}
                onDelete={() => handleDelete(doc)}
                formatSize={formatSize}
              />
            ))}
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.pdf"
        className="hidden"
        onChange={(e) => handleFileSelect(e.target.files)}
      />

      {/* Upload Modal */}
      {showUploadModal && uploadFile && (
        <Modal isOpen onClose={() => setShowUploadModal(false)} title="Subir documento">
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700">{uploadFile.name}</p>
              <p className="text-xs text-gray-400">{formatSize(uploadFile.size)}</p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Tipo de documento</label>
              <select
                value={uploadType}
                onChange={(e) => setUploadType(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Notas (opcional)</label>
              <textarea
                value={uploadNotes}
                onChange={(e) => setUploadNotes(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="Descripción o notas sobre el documento"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setShowUploadModal(false)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={<Upload size={14} />}
                onClick={handleUpload}
                disabled={uploading}
              >
                {uploading ? "Subiendo..." : "Subir"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function DocumentCard({
  document: doc,
  isImage: isImg,
  onView,
  onDelete,
  formatSize,
}: {
  document: Document;
  isImage: boolean;
  onView: () => void;
  onDelete: () => void;
  formatSize: (n: number) => string;
}) {
  const typeLabel = DOCUMENT_TYPES.find((t) => t.value === doc.document_type)?.label ?? doc.document_type;

  return (
    <div className="group relative flex flex-col items-center rounded-lg border border-gray-200 p-3 transition-shadow hover:shadow-md">
      {/* Thumbnail */}
      <div
        className="mb-2 flex h-20 w-full items-center justify-center rounded bg-gray-100 cursor-pointer"
        onClick={onView}
      >
        {isImg ? (
          <Image size={32} className="text-blue-400" />
        ) : (
          <FileText size={32} className="text-red-400" />
        )}
      </div>

      {/* Info */}
      <p className="w-full truncate text-center text-xs font-medium text-gray-700" title={doc.original_name}>
        {doc.original_name}
      </p>
      <p className="text-[10px] text-gray-400">{formatSize(doc.file_size)}</p>
      <Badge variant="info" className="mt-1 text-[10px]">
        {typeLabel}
      </Badge>

      {/* Actions overlay */}
      <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button onClick={onView} className="rounded bg-white p-1 shadow hover:bg-blue-50">
          <Eye size={12} className="text-blue-600" />
        </button>
        <button onClick={onDelete} className="rounded bg-white p-1 shadow hover:bg-red-50">
          <Trash2 size={12} className="text-red-600" />
        </button>
      </div>
    </div>
  );
}

function DocumentRow({
  document: doc,
  isImage: isImg,
  onView,
  onDelete,
  formatSize,
}: {
  document: Document;
  isImage: boolean;
  onView: () => void;
  onDelete: () => void;
  formatSize: (n: number) => string;
}) {
  const typeLabel = DOCUMENT_TYPES.find((t) => t.value === doc.document_type)?.label ?? doc.document_type;
  const date = new Date(doc.created_at).toLocaleDateString("es-CO");

  return (
    <div className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-gray-100">
        {isImg ? <Image size={16} className="text-blue-400" /> : <FileText size={16} className="text-red-400" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-700">{doc.original_name}</p>
        <p className="text-xs text-gray-400">
          {typeLabel} · {formatSize(doc.file_size)} · {date}
        </p>
      </div>
      <div className="flex gap-1">
        <button onClick={onView} className="rounded p-1.5 hover:bg-blue-50">
          <Eye size={14} className="text-blue-600" />
        </button>
        <button onClick={onDelete} className="rounded p-1.5 hover:bg-red-50">
          <Trash2 size={14} className="text-red-600" />
        </button>
      </div>
    </div>
  );
}
