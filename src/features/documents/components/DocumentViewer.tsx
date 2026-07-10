import { useEffect, useState } from "react";
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";
import { useDocuments } from "../hooks/useDocuments";
import type { Document } from "../types";

interface DocumentViewerProps {
  document: Document;
  documents: Document[];
  onClose: () => void;
  onNavigate: (doc: Document) => void;
}

export default function DocumentViewer({
  document,
  documents,
  onClose,
  onNavigate,
}: DocumentViewerProps) {
  const { getDocumentData } = useDocuments();
  const [dataUrl, setDataUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  const isImage = document.mime_type.startsWith("image/");
  const isPdf = document.mime_type === "application/pdf";

  const currentIndex = documents.findIndex((d) => d.id === document.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < documents.length - 1;

  useEffect(() => {
    loadDocument();
    setZoom(1);
    setRotation(0);
  }, [document.id]);

  const loadDocument = async () => {
    setLoading(true);
    try {
      const data = await getDocumentData(document.id);
      const bytes = new Uint8Array(data);
      const blob = new Blob([bytes], { type: document.mime_type });
      const url = URL.createObjectURL(blob);
      setDataUrl(url);
    } catch {
      setDataUrl("");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (dataUrl) URL.revokeObjectURL(dataUrl);
    };
  }, [dataUrl]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasPrev) onNavigate(documents[currentIndex - 1]);
      if (e.key === "ArrowRight" && hasNext) onNavigate(documents[currentIndex + 1]);
      if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(z + 0.25, 5));
      if (e.key === "-") setZoom((z) => Math.max(z - 0.25, 0.25));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentIndex, hasPrev, hasNext]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col bg-black/90 ${
        fullscreen ? "" : ""
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between bg-black/50 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-white">{document.original_name}</span>
          <span className="text-xs text-gray-400">
            ({currentIndex + 1} / {documents.length})
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isImage && (
            <>
              <ToolButton icon={<ZoomOut size={16} />} onClick={() => setZoom((z) => Math.max(z - 0.25, 0.25))} title="Alejar" />
              <span className="text-xs text-gray-300">{Math.round(zoom * 100)}%</span>
              <ToolButton icon={<ZoomIn size={16} />} onClick={() => setZoom((z) => Math.min(z + 0.25, 5))} title="Acercar" />
              <ToolButton icon={<RotateCw size={16} />} onClick={() => setRotation((r) => (r + 90) % 360)} title="Rotar" />
            </>
          )}
          <ToolButton icon={<Maximize2 size={16} />} onClick={() => setFullscreen(!fullscreen)} title="Pantalla completa" />
          <ToolButton
            icon={<Download size={16} />}
            onClick={() => {
              if (dataUrl) {
                const a = window.document.createElement("a");
                a.href = dataUrl;
                a.download = document.original_name;
                a.click();
              }
            }}
            title="Descargar"
          />
          <ToolButton icon={<X size={16} />} onClick={onClose} title="Cerrar" />
        </div>
      </div>

      {/* Content */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {/* Navigation arrows */}
        {hasPrev && (
          <button
            onClick={() => onNavigate(documents[currentIndex - 1])}
            className="absolute left-4 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
          >
            <ChevronLeft size={24} />
          </button>
        )}
        {hasNext && (
          <button
            onClick={() => onNavigate(documents[currentIndex + 1])}
            className="absolute right-4 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
          >
            <ChevronRight size={24} />
          </button>
        )}

        {/* Document content */}
        {loading ? (
          <p className="text-sm text-gray-400">Cargando...</p>
        ) : !dataUrl ? (
          <p className="text-sm text-red-400">Error al cargar el documento.</p>
        ) : isImage ? (
          <img
            src={dataUrl}
            alt={document.original_name}
            className="max-h-full max-w-full object-contain transition-transform"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
            }}
            draggable={false}
          />
        ) : isPdf ? (
          <iframe
            src={dataUrl}
            className="h-full w-full"
            title={document.original_name}
          />
        ) : (
          <p className="text-sm text-gray-400">Formato no soportado para visualización.</p>
        )}
      </div>

      {/* Footer info */}
      <div className="flex items-center justify-center gap-4 bg-black/50 px-4 py-2 text-xs text-gray-400">
        <span>{document.mime_type}</span>
        <span>·</span>
        <span>{formatSize(document.file_size)}</span>
        <span>·</span>
        <span>{new Date(document.created_at).toLocaleDateString("es-CO")}</span>
        {document.notes && (
          <>
            <span>·</span>
            <span>{document.notes}</span>
          </>
        )}
      </div>
    </div>
  );
}

function ToolButton({
  icon,
  onClick,
  title,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="rounded p-1.5 text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
    >
      {icon}
    </button>
  );
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
