"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Plus, Search, Upload, MoreHorizontal, Eye, ArrowDownToLine, SlidersHorizontal, ChevronDown, ArrowUpToLine, ArrowUp } from "lucide-react";
import { FILE_ACCEPT } from "@/hooks/use-file-upload";

export type KnowledgeFile = {
  id: string;
  name: string;
  type: "file" | "url" | "connected";
  fileType?: string;
  size?: string;
  date?: string;
  source?: string;
  url?: string;
  priority?: "High" | "Medium" | "Low";
  weight?: number;
};

const PRIORITY_WEIGHTS: Record<"High" | "Medium" | "Low", number> = {
  High:   1.0,
  Medium: 0.5,
  Low:    0.3,
};

type KnowledgeTabProps = {
  files: KnowledgeFile[];
  onFilesChange: (files: KnowledgeFile[]) => void;
  onRawFilesSelected?: (files: File[]) => void;
  onRemoveFile?: (id: string) => void;
  onPreviewFile?: (file: KnowledgeFile) => void;
  onAddUrl?: (url: string) => void;
};

const FILE_LIMIT = 10;
const SIZE_LIMIT_MB = 300;
const FILE_SIZE_LIMIT_MB = 30;

const ALLOWED_EXTENSIONS = new Set([
  "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "csv",
  "txt", "md", "json", "xml", "rtf", "html", "htm", "svg",
  "tiff", "tif", "avif", "png", "jpg", "jpeg", "webp", "epub", "zip",
]);

const SOURCE_BUTTONS = [
  { label: "Google Drive", key: "drive" },
  { label: "Slack", key: "slack" },
  { label: "Onedrive", key: "onedrive" },
];

const FILE_BADGE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  PDF:  { bg: "#cadcf1", border: "rgba(13,110,178,0.5)", text: "#135487" },
  PPTX: { bg: "#f1d9ca", border: "rgba(178,80,13,0.5)",  text: "#87350d" },
  URL:  { bg: "#ffbfb6", border: "rgba(159,38,35,0.5)",  text: "#7a201c" },
  URLs: { bg: "#ffbfb6", border: "rgba(159,38,35,0.5)",  text: "#7a201c" },
};

function FileBadge({ label }: { label: string }) {
  const color = FILE_BADGE_COLORS[label] ?? { bg: "#ede1d7", border: "rgba(106,98,93,0.5)", text: "#524b47" };
  return (
    <span
      style={{
        fontFamily: "var(--font-body)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: 20,
        padding: "0 4px",
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 500,
        whiteSpace: "nowrap",
        backgroundColor: color.bg,
        color: color.text,
        boxShadow: `0px 1px 1.5px 0px rgba(2,15,24,0.2), 0px 0px 0px 1px ${color.border}, inset 0px 1px 0px 0px rgba(231,244,253,0.7), inset 0px -1px 0px 0px rgba(13,110,178,0.1)`,
      }}
    >
      {label}
    </span>
  );
}

function FileRow({ file, onRemove, onPriorityChange, onPreview }: {
  file: KnowledgeFile;
  onRemove: (id: string) => void;
  onPriorityChange: (id: string, p: "High" | "Medium" | "Low") => void;
  onPreview?: (file: KnowledgeFile) => void;
}) {
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const [showActionMenu,   setShowActionMenu]   = useState(false);
  const [hoveredPriority, setHoveredPriority]   = useState<string | null>(null);
  const priorityMenuRef = useRef<HTMLDivElement>(null);
  const actionMenuRef   = useRef<HTMLDivElement>(null);
  const badgeLabel = file.type === "url" ? "URLs" : (file.fileType ?? "PDF");

  // Close priority dropdown when clicking outside
  useEffect(() => {
    if (!showPriorityMenu) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (priorityMenuRef.current && !priorityMenuRef.current.contains(e.target as Node)) {
        setShowPriorityMenu(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showPriorityMenu]);

  // Close action dropdown when clicking outside
  useEffect(() => {
    if (!showActionMenu) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setShowActionMenu(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [showActionMenu]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: 56,
        padding: "0 12px",
        borderRadius: 12,
        backgroundColor: "white",
        boxShadow: "0px 0px 0px 1px white",
        width: "100%",
        fontFamily: "var(--font-body)",
      }}
    >
      {file.source && (
        <div
          style={{
            width: 35,
            height: 35,
            flexShrink: 0,
            marginRight: 8,
            backgroundColor: "#f0f0f0",
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#827a74" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
          </svg>
        </div>
      )}
      <p
        style={{
          flex: "1 0 0",
          minWidth: 0,
          fontSize: 14,
          fontWeight: 500,
          color: "#3b3632",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          margin: 0,
        }}
      >
        {file.name}
      </p>
      <div style={{ display: "flex", gap: 17, alignItems: "center", width: 265, flexShrink: 0 }}>
        <FileBadge label={badgeLabel} />
        {file.size && file.size !== '-' && (
          <span style={{ fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 500, color: "#6a625d", whiteSpace: "nowrap" }}>
            {file.size}
          </span>
        )}
        {file.date && (
          <span style={{ fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 500, color: "#6a625d", whiteSpace: "nowrap" }}>
            {file.date}
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0, position: "relative" }}>
        <div ref={priorityMenuRef} style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setShowPriorityMenu((p) => !p)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2,
              width: 90,
              height: 32,
              padding: "5px 8px",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              fontFamily: "var(--font-body)",
              color: "#524b47",
              backgroundColor: "transparent",
              border: "1px solid rgba(59,54,50,0.3)",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            {file.priority ?? "Priority"}
            <ChevronDown size={16} color="#524b47" />
          </button>
          {showPriorityMenu && (
            <div
              style={{
                position: "absolute",
                top: 36,
                right: 0,
                backgroundColor: "white",
                border: "1px solid #d1c6bd",
                borderRadius: 8,
                boxShadow: "0px 4px 12px rgba(0,0,0,0.1)",
                zIndex: 5,
                minWidth: 120,
                overflow: "hidden",
              }}
            >
              {(["High", "Medium", "Low"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => { onPriorityChange(file.id, p); setShowPriorityMenu(false); }}
                  onMouseEnter={() => setHoveredPriority(p)}
                  onMouseLeave={() => setHoveredPriority(null)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "8px 12px",
                    fontSize: 14,
                    fontFamily: "var(--font-body)",
                    color: file.priority === p || hoveredPriority === p ? "#3b3632" : "#524b47",
                    backgroundColor: file.priority === p ? "#f7f2ed" : hoveredPriority === p ? "#faf6f3" : "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: file.priority === p ? 600 : 400,
                    transition: "background-color 0.1s, color 0.1s",
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>
        {file.type !== "connected" && (
          <button
            type="button"
            onClick={() => {
              if (onPreview) {
                onPreview(file);
              } else if (file.url) {
                window.open(file.url, "_blank", "noopener,noreferrer");
              }
            }}
            title="Preview file"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: 32,
              width: 32,
              borderRadius: 8,
              border: "1px solid rgba(59,54,50,0.3)",
              backgroundColor: "transparent",
              cursor: "pointer",
            }}
          >
            <Eye size={20} color="#524b47" />
          </button>
        )}
        <div ref={actionMenuRef} style={{ position: "relative" }}>
          <button
            type="button"
            onClick={() => setShowActionMenu((p) => !p)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: 32,
              width: 32,
              borderRadius: 8,
              border: "1px solid rgba(59,54,50,0.3)",
              backgroundColor: "transparent",
              cursor: "pointer",
            }}
          >
            <MoreHorizontal size={20} color="#524b47" />
          </button>
          {showActionMenu && (
            <div
              style={{
                position: "absolute",
                top: 36,
                right: 0,
                backgroundColor: "white",
                border: "1px solid #d1c6bd",
                borderRadius: 8,
                boxShadow: "0px 4px 12px rgba(0,0,0,0.1)",
                zIndex: 5,
                minWidth: 120,
                overflow: "hidden",
              }}
            >
              <button
                type="button"
                onClick={() => { onRemove(file.id); setShowActionMenu(false); }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 12px",
                  fontSize: 14,
                  fontFamily: "var(--font-body)",
                  color: "#c0392b",
                  backgroundColor: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DropOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: -8,
        zIndex: 40,
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        borderRadius: 18,
        border: "2px dashed #0d6eb2",
        backgroundColor: "rgba(13,110,178,0.08)",
        backdropFilter: "blur(2px)",
        fontFamily: "var(--font-body)",
        color: "#0d6eb2",
      }}
    >
      <ArrowUp size={28} color="#0d6eb2" />
      <p style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>Drop files to upload</p>
      <p style={{ margin: 0, fontSize: 12, color: "#3b3632" }}>
        PDF, DOCX, XLSX, images and more · max 30 MB per file
      </p>
    </div>
  );
}

export default function KnowledgeTab({ files, onFilesChange, onRawFilesSelected, onRemoveFile, onPreviewFile, onAddUrl }: KnowledgeTabProps) {
  const [urlInput, setUrlInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeConnectorFilter, setActiveConnectorFilter] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  // Drag enter/leave fire for every child as the cursor traverses the DOM tree, so
  // count outstanding "enters" instead of toggling a boolean — otherwise the overlay
  // flickers off the instant the cursor crosses an inner element.
  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEmpty = files.length === 0;

  const totalSizeMB = files.reduce((acc, f) => {
    const mb = parseFloat(f.size?.replace(" MB", "") ?? "0");
    return acc + (isNaN(mb) ? 0 : mb);
  }, 0);

  const ingestFiles = (raw: File[]) => {
    if (raw.length === 0) return;

    // File type validation
    const unsupported = raw.filter(f => {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      return !ALLOWED_EXTENSIONS.has(ext);
    });
    unsupported.forEach(f => {
      const ext = f.name.split(".").pop()?.toUpperCase() ?? "file";
      toast.error(`"${f.name}" is not a supported file type.`, { description: `Received: ${ext}` });
    });

    const typeOk = raw.filter(f => {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      return ALLOWED_EXTENSIONS.has(ext);
    });
    if (typeOk.length === 0) return;

    // Per-file size validation (30 MB limit)
    const oversized = typeOk.filter(f => f.size > FILE_SIZE_LIMIT_MB * 1024 * 1024);
    oversized.forEach(f =>
      toast.error(`"${f.name}" exceeds the ${FILE_SIZE_LIMIT_MB} MB per-file limit.`)
    );
    const valid = typeOk.filter(f => f.size <= FILE_SIZE_LIMIT_MB * 1024 * 1024);
    if (valid.length === 0) return;

    if (onRawFilesSelected) {
      onRawFilesSelected(valid);
      return;
    }
    // Fallback: optimistic local state only
    const newFiles: KnowledgeFile[] = raw.map(file => {
      const ext = file.name.split(".").pop()?.toUpperCase() ?? "FILE";
      const bytes = file.size
      const sizeStr = bytes < 0.1 * 1024 * 1024
        ? `${(bytes / 1024).toFixed(1)} KB`
        : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
      return {
        id: `${Date.now()}-${file.name}`,
        name: file.name,
        type: "file",
        fileType: ext,
        size: sizeStr,
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        url: URL.createObjectURL(file),
      };
    });
    onFilesChange([...files, ...newFiles]);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    if (!selected) return;
    ingestFiles(Array.from(selected));
    e.target.value = "";
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) setIsDraggingOver(true);
  };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) setIsDraggingOver(false);
  };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDraggingOver(false);
    ingestFiles(Array.from(e.dataTransfer.files));
  };

  const dragHandlers = {
    onDragEnter: handleDragEnter,
    onDragOver:  handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop:      handleDrop,
  };

  const handleAddUrl = () => {
    const url = urlInput.trim();
    if (!url || !url.startsWith("http")) return;
    setUrlInput("");
    if (onAddUrl) {
      onAddUrl(url);
    } else {
      // Fallback for standalone / story usage without a parent handler
      const name = url.replace(/^https?:\/\//, "").split("/")[0];
      onFilesChange([
        ...files,
        {
          id: `url-${Date.now()}`,
          name,
          url,
          type: "url",
          fileType: "URL",
          size: "-",
          date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        },
      ]);
    }
  };

  const handleRemoveFile = (id: string) => {
    if (onRemoveFile) {
      onRemoveFile(id);
      return;
    }
    onFilesChange(files.filter((f) => f.id !== id));
  };

  const handlePriorityChange = (id: string, priority: string) => {
    const p = priority as "High" | "Medium" | "Low";
    onFilesChange(files.map((f) => f.id === id ? { ...f, priority: p, weight: PRIORITY_WEIGHTS[p] } : f));
  };

  const filteredFiles = files.filter((f) => {
    const matchSearch = !searchQuery || f.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchConnector = !activeConnectorFilter || f.source === activeConnectorFilter;
    return matchSearch && matchConnector;
  });

  const regularFiles   = filteredFiles.filter((f) => f.type === "file");
  const urlFiles       = filteredFiles.filter((f) => f.type === "url");
  const connectedFiles = filteredFiles.filter((f) => f.type === "connected");
  const updatedAgo     = files.length > 0 ? "Updated just now" : null;

  if (isEmpty) {
    return (
      <div
        {...dragHandlers}
        style={{ position: "relative", display: "flex", flexDirection: "column", gap: 24, width: "100%" }}
      >
        <DropOverlay visible={isDraggingOver} />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <h2
            style={{
              fontFamily: "var(--font-title)",
              fontSize: 24,
              fontWeight: 400,
              color: "black",
              lineHeight: "1.3",
              margin: 0,
            }}
          >
            Add Knowledge to your Persona
          </h2>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "black", margin: 0 }}>
            Upload files or add URLs - the persona retrieves relevant content during conversations
          </p>
        </div>

        <div data-help-id="help-knowledge-upload" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            style={{
              backgroundColor: "#f7f2ed",
              border: "1px dashed #b6aca4",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              alignItems: "center",
              padding: "12px 12px 16px",
              borderRadius: 16,
              boxShadow: "0px 2px 2.8px 0px rgba(82,75,71,0.12)",
            }}
          >
            <div
              style={{
                display: "flex",
                flex: 1,
                flexDirection: "column",
                gap: 12,
                alignItems: "center",
                justifyContent: "center",
                padding: "32px 0",
                width: "100%",
              }}
            >
              <ArrowUp size={25} color="#524b47" />
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 24,
                  fontWeight: 400,
                  color: "black",
                  margin: 0,
                }}
              >
                No knowledge added
              </p>
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  color: "#737373",
                  textAlign: "center",
                  maxWidth: 362,
                  margin: 0,
                }}
              >
                Upload files or connect sources - the persona retrieves relevant content during conversations.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "center", width: "100%" }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  height: 80,
                  width: 164,
                  flexShrink: 0,
                  padding: "0 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(59,54,50,0.3)",
                  backgroundColor: "transparent",
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#524b47",
                }}
              >
                <Upload size={16} color="#524b47" />
                Upload Files
              </button>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              fontFamily: "var(--font-body)",
              fontSize: 14,
              fontWeight: 500,
              color: "#6a625d",
            }}
          >
            <span>0 / {FILE_LIMIT} files</span>
            <span>0 MB / {SIZE_LIMIT_MB} MB</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <div data-help-id="help-knowledge-url" style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
            <label htmlFor="knowledge-url-input" style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "#524b47" }}>Paste URLs</label>
            <div
              style={{
                backgroundColor: "white",
                display: "flex",
                alignItems: "center",
                gap: 2,
                padding: "7px 10px",
                borderRadius: 10,
                boxShadow: "0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px #ede1d7",
              }}
            >
              <input
                id="knowledge-url-input"
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddUrl()}
                placeholder="https:// Paste a URL to add as a knowledge source…"
                style={{
                  flex: 1,
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  color: "#6a625d",
                  backgroundColor: "transparent",
                  border: "none",
                  // eslint-disable-next-line react-doctor/no-outline-none -- browser outline suppressed; :focus-visible handled by container or global styles
                  outline: "none",
                }}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleAddUrl}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 8,
              borderRadius: 10,
              border: "1px solid rgba(59,54,50,0.3)",
              backgroundColor: "transparent",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <Plus size={20} color="#524b47" />
          </button>
        </div>

        <input ref={fileInputRef} type="file" multiple accept={FILE_ACCEPT} style={{ display: "none" }} onChange={handleFileUpload} />
      </div>
    );
  }

  return (
    <div
      {...dragHandlers}
      style={{ position: "relative", display: "flex", flexDirection: "column", gap: 24, width: "100%" }}
    >
      <DropOverlay visible={isDraggingOver} />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <h2
            style={{
              fontFamily: "var(--font-title)",
              fontSize: 24,
              fontWeight: 400,
              color: "#1a1916",
              lineHeight: "1.3",
              margin: 0,
            }}
          >
            Knowledge
          </h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span
              style={{
                fontFamily: "var(--font-body)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: 20,
                padding: "0 6px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 500,
                color: "#524b47",
                backgroundColor: "#ede1d7",
                boxShadow: "0px 1px 1.5px 0px rgba(18,12,8,0.2), 0px 0px 0px 1px rgba(106,98,93,0.5)",
              }}
            >
              {files.length} {files.length === 1 ? "file" : "files"}
            </span>
            {updatedAgo && (
              <span
                style={{
                  fontFamily: "var(--font-body)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: 20,
                  padding: "0 6px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 500,
                  color: "#524b47",
                  backgroundColor: "#ede1d7",
                  boxShadow: "0px 1px 1.5px 0px rgba(18,12,8,0.2), 0px 0px 0px 1px rgba(106,98,93,0.5)",
                }}
              >
                {updatedAgo}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "center" }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              padding: "6px 10px",
              borderRadius: 10,
              fontFamily: "var(--font-body)",
              fontSize: 14,
              fontWeight: 500,
              color: "#f7f2ed",
              position: "relative",
              overflow: "hidden",
              border: "none",
              cursor: "pointer",
              background: "linear-gradient(to bottom, #524b47, #26211e)",
              boxShadow: "0px 0px 0px 1px black, 0px 1.091px 1.091px 0px rgba(59,54,50,0.1), 0px 1.455px 3.127px 0px rgba(59,54,50,0.4), inset 0px 1px 0.364px 0px rgba(247,242,237,0.3), inset 0px -2.182px 0.364px 0px #120c08, inset 0px -2.545px 4px -2.182px rgba(247,242,237,0.5)",
            }}
          >
            <Plus size={16} color="#f7f2ed" />
            Upload Files
          </button>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div
          style={{
            flex: 1,
            backgroundColor: "white",
            display: "flex",
            alignItems: "center",
            gap: 2,
            padding: "7px 10px",
            borderRadius: 10,
            boxShadow: "0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px #ede1d7",
          }}
        >
          <Search size={16} color="#6a625d" style={{ flexShrink: 0 }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search knowledge…"
            style={{
              flex: 1,
              fontFamily: "var(--font-body)",
              fontSize: 14,
              color: "#6a625d",
              backgroundColor: "transparent",
              border: "none",
              // eslint-disable-next-line react-doctor/no-outline-none -- browser outline suppressed; :focus-visible handled by container or global styles
              outline: "none",
              padding: "0 2px",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "0 4px" }}>
          <button
            type="button"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 6,
              borderRadius: 8,
              border: "none",
              backgroundColor: "transparent",
              cursor: "pointer",
            }}
          >
            <ArrowDownToLine size={20} color="#524b47" />
          </button>
          <button
            type="button"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 6,
              borderRadius: 8,
              border: "none",
              backgroundColor: "transparent",
              cursor: "pointer",
            }}
          >
            <SlidersHorizontal size={20} color="#524b47" />
          </button>
        </div>
      </div>

      {regularFiles.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 500, color: "#0a0a0a", margin: 0 }}>Files</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {regularFiles.map((f) => (
              <FileRow key={f.id} file={f} onRemove={handleRemoveFile} onPriorityChange={handlePriorityChange} onPreview={onPreviewFile} />
            ))}
          </div>
        </div>
      )}

      {urlFiles.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 500, color: "#0a0a0a", margin: 0 }}>Web pages - URLs</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {urlFiles.map((f) => (
              <FileRow key={f.id} file={f} onRemove={handleRemoveFile} onPriorityChange={handlePriorityChange} onPreview={onPreviewFile} />
            ))}
          </div>
        </div>
      )}

      {connectedFiles.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 500, color: "#0a0a0a", margin: 0 }}>Connected</p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {SOURCE_BUTTONS.map((src) => {
              const active = activeConnectorFilter === src.key;
              return (
                <button
                  key={src.key}
                  type="button"
                  onClick={() => setActiveConnectorFilter(active ? null : src.key)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                    height: 32,
                    padding: "5px 8px",
                    borderRadius: 8,
                    fontFamily: "var(--font-body)",
                    fontSize: 14,
                    fontWeight: 500,
                    border: active ? "1px solid #524b47" : "1px solid rgba(59,54,50,0.3)",
                    backgroundColor: active ? "#524b47" : "transparent",
                    color: active ? "white" : "#524b47",
                    cursor: "pointer",
                    transition: "border 150ms, background-color 150ms, color 150ms",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                  {src.label}
                  <ChevronDown size={16} />
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {(activeConnectorFilter
              ? connectedFiles.filter((f) => f.source === activeConnectorFilter)
              : connectedFiles
            ).map((f) => (
              <FileRow key={f.id} file={f} onRemove={handleRemoveFile} onPriorityChange={handlePriorityChange} onPreview={onPreviewFile} />
            ))}
          </div>
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          fontFamily: "var(--font-body)",
          fontSize: 14,
          fontWeight: 500,
          color: "#6a625d",
        }}
      >
        <span>{files.length} / {FILE_LIMIT} files</span>
        <span>{totalSizeMB.toFixed(1)} MB / {SIZE_LIMIT_MB} MB</span>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          <label htmlFor="knowledge-url-input-2" style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "#524b47" }}>Paste URLs</label>
          <div
            style={{
              backgroundColor: "white",
              display: "flex",
              alignItems: "center",
              gap: 2,
              padding: "7px 10px",
              borderRadius: 10,
              boxShadow: "0px 1px 1.5px 0px rgba(82,75,71,0.12), 0px 0px 0px 1px #ede1d7",
            }}
          >
            <input
              id="knowledge-url-input-2"
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddUrl()}
              placeholder="https:// Paste a URL to add as a knowledge source…"
              style={{
                flex: 1,
                fontFamily: "var(--font-body)",
                fontSize: 14,
                color: "#6a625d",
                backgroundColor: "transparent",
                border: "none",
                // eslint-disable-next-line react-doctor/no-outline-none -- browser outline suppressed; :focus-visible handled by container or global styles
                outline: "none",
              }}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={handleAddUrl}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 8,
            borderRadius: 10,
            border: "1px solid rgba(59,54,50,0.3)",
            backgroundColor: "transparent",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <Plus size={20} color="#524b47" />
        </button>
      </div>

      <input ref={fileInputRef} type="file" multiple accept={FILE_ACCEPT} style={{ display: "none" }} onChange={handleFileUpload} />
    </div>
  );
}
