"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/* ── Types ─────────────────────────────────────────────────── */

interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

interface LibraryComponent {
  name: string;
  tags: string[];
  description: string;
  created_at: string;
  file: string;
  code?: string;
}

/* ── Sub-components ────────────────────────────────────────── */

function ImageUploader({
  onImageSelected,
  preview,
}: {
  onImageSelected: (base64: string, mimeType: string) => void;
  preview: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        const mimeType = file.type || "image/png";
        onImageSelected(base64, mimeType);
      };
      reader.readAsDataURL(file);
    },
    [onImageSelected]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`relative border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200 ${
        dragOver
          ? "border-brand-mint bg-brand-mint/5"
          : preview
          ? "border-transparent"
          : "border-[#2a2a2a] hover:border-brand-mint/40"
      } ${preview ? "p-0" : "p-8"}`}
    >
      {preview ? (
        <img
          src={preview}
          alt="UI Design"
          className="w-full max-h-[300px] object-contain rounded-lg"
        />
      ) : (
        <div className="text-center">
          <svg
            className="w-10 h-10 mx-auto mb-3 text-text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
            />
          </svg>
          <p className="text-sm text-text-muted">
            Arrastra una imagen o haz click para subir
          </p>
          <p className="text-xs text-text-muted/50 mt-1">
            PNG, JPG, WebP
          </p>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}

function buildPreviewHtml(code: string): string {
  // Extract the component name from "const XYZ = " or "export default XYZ"
  const nameMatch = code.match(/const\s+(\w+)\s*=/);
  const componentName = nameMatch ? nameMatch[1] : "Component";

  // Convert TSX to browser-safe JSX: strip type annotations loosely
  let jsCode = code
    .replace(/:\s*React\.FC(?:<[^>]*>)?/g, "")
    .replace(/:\s*React\.(?:MouseEvent|ChangeEvent|FormEvent)(?:<[^>]*>)?/g, "")
    .replace(/:\s*(?:string|number|boolean|any|void|null|undefined)(?:\[\])?/g, "")
    .replace(/<(\w+)>/g, "")  // strip generic type params like <T>
    .replace(/as\s+\w+/g, "")
    .replace(/interface\s+\w+\s*\{[^}]*\}/g, "")
    .replace(/type\s+\w+\s*=\s*[^;]+;/g, "")
    .replace(/import\s+.*?from\s+['"][^'"]+['"];?\n?/g, "")
    .replace(/export\s+default\s+\w+;?\s*$/m, "");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"><\/script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"><\/script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
  <style>body{margin:0;padding:16px;background:#fff;font-family:system-ui,sans-serif}</style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    const { useState, useEffect, useRef, useCallback } = React;
    try {
      ${jsCode}
      const root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(React.createElement(${componentName}));
    } catch(e) {
      document.getElementById('root').innerHTML = '<div style="color:#ef4444;font-size:13px;font-family:monospace;padding:16px"><b>Preview error:</b><br/>' + e.message + '</div>';
    }
  <\/script>
</body>
</html>`;
}

function CodePanel({ code, loading }: { code: string; loading: boolean }) {
  const [copied, setCopied] = useState(false);
  const [activePanel, setActivePanel] = useState<"code" | "preview">("code");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleCopy = () => {
    const exportCode = `import React from 'react';\n\n${code}\n`;
    navigator.clipboard.writeText(exportCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Update iframe preview when code changes
  useEffect(() => {
    if (activePanel === "preview" && code && iframeRef.current) {
      const html = buildPreviewHtml(code);
      iframeRef.current.srcdoc = html;
    }
  }, [activePanel, code]);

  if (!code && !loading) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted text-sm">
        El codigo generado aparecera aqui
      </div>
    );
  }

  return (
    <div className="relative h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1e1e1e]">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActivePanel("code")}
            className={`text-xs px-2.5 py-1 rounded transition-colors ${
              activePanel === "code"
                ? "bg-brand-mint/15 text-brand-mint"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            Codigo
          </button>
          <button
            onClick={() => setActivePanel("preview")}
            className={`text-xs px-2.5 py-1 rounded transition-colors ${
              activePanel === "preview"
                ? "bg-brand-mint/15 text-brand-mint"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            Preview
          </button>
        </div>
        <button
          onClick={handleCopy}
          disabled={!code}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-[#1e1e1e] text-text-muted hover:text-brand-mint hover:bg-brand-mint/10 transition-colors disabled:opacity-30"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
          </svg>
          {copied ? "Copiado!" : "Copiar import-ready"}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {loading && !code ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex items-center gap-3 text-text-muted">
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
                <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              <span className="text-sm">Generando componente...</span>
            </div>
          </div>
        ) : activePanel === "code" ? (
          <SyntaxHighlighter
            language="tsx"
            style={oneDark}
            customStyle={{
              margin: 0,
              padding: "16px",
              background: "transparent",
              fontSize: "13px",
              lineHeight: "1.6",
            }}
            wrapLongLines
          >
            {code}
          </SyntaxHighlighter>
        ) : (
          <iframe
            ref={iframeRef}
            title="Component Preview"
            sandbox="allow-scripts"
            className="w-full h-full border-0 bg-white rounded-b-lg"
          />
        )}
      </div>
    </div>
  );
}

function CorrectionChat({
  onSend,
  history,
  loading,
}: {
  onSend: (msg: string) => void;
  history: HistoryMessage[];
  loading: boolean;
}) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [history]);

  const handleSend = () => {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput("");
    onSend(msg);
  };

  return (
    <div className="flex flex-col h-full">
      {/* History */}
      <div ref={scrollRef} className="flex-1 overflow-auto px-3 py-2 space-y-2">
        {history.length === 0 && (
          <p className="text-xs text-text-muted/50 text-center mt-4">
            Escribe correcciones para refinar el componente
          </p>
        )}
        {history.map((msg, i) => (
          <div
            key={i}
            className={`text-xs px-3 py-2 rounded-lg max-w-[90%] ${
              msg.role === "user"
                ? "bg-brand-mint/10 text-brand-mint ml-auto"
                : "bg-[#1a1a1a] text-text-muted"
            }`}
          >
            {msg.content.length > 200
              ? msg.content.slice(0, 200) + "..."
              : msg.content}
          </div>
        ))}
        {loading && (
          <div className="text-xs text-text-muted/50 flex items-center gap-2">
            <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-20" />
              <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            Refinando...
          </div>
        )}
      </div>
      {/* Input */}
      <div className="border-t border-[#1e1e1e] px-3 py-2">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ej: cambia el color a azul, agranda el boton..."
            className="flex-1 bg-[#151515] text-sm text-text-primary px-3 py-2 rounded-lg border border-[#1e1e1e] focus:border-brand-mint/40 outline-none placeholder:text-text-muted/40"
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="px-3 py-2 bg-brand-mint/15 text-brand-mint rounded-lg text-sm hover:bg-brand-mint/25 transition-colors disabled:opacity-30"
          >
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}

function SaveModal({
  code,
  onClose,
  onSaved,
}: {
  code: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(() => {
    const match = code.match(/const\s+(\w+)/);
    return match ? match[1] : "";
  });
  const [tags, setTags] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await fetch(`${API}/api/ocr/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          code,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          description: description.trim(),
        }),
      });
      onSaved();
      onClose();
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="bg-[#111] border border-[#1e1e1e] rounded-xl p-6 w-full max-w-md space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-text-primary">
          Guardar Componente
        </h3>

        <div>
          <label className="text-xs text-text-muted block mb-1">Nombre *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-[#151515] text-sm text-text-primary px-3 py-2 rounded-lg border border-[#1e1e1e] focus:border-brand-mint/40 outline-none"
            placeholder="PrimaryButton"
          />
        </div>

        <div>
          <label className="text-xs text-text-muted block mb-1">
            Tags (separados por coma)
          </label>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full bg-[#151515] text-sm text-text-primary px-3 py-2 rounded-lg border border-[#1e1e1e] focus:border-brand-mint/40 outline-none"
            placeholder="button, primary, mobile"
          />
        </div>

        <div>
          <label className="text-xs text-text-muted block mb-1">
            Descripcion
          </label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-[#151515] text-sm text-text-primary px-3 py-2 rounded-lg border border-[#1e1e1e] focus:border-brand-mint/40 outline-none"
            placeholder="Boton primario con sombra naranja"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-text-muted hover:text-text-primary transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || saving}
            className="px-4 py-2 text-sm bg-brand-mint/15 text-brand-mint rounded-lg hover:bg-brand-mint/25 transition-colors disabled:opacity-30"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CodeModal({
  component,
  onClose,
  onLoad,
}: {
  component: LibraryComponent;
  onClose: () => void;
  onLoad: (code: string) => void;
}) {
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/ocr/library/${component.name}`)
      .then((r) => r.json())
      .then((d) => setCode(d.component?.code || "// Not found"))
      .catch(() => setCode("// Error loading"));
  }, [component.name]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="bg-[#111] border border-[#1e1e1e] rounded-xl w-full max-w-3xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#1e1e1e]">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              {component.name}
            </h3>
            {component.description && (
              <p className="text-xs text-text-muted">{component.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (code) {
                  navigator.clipboard.writeText(code);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }
              }}
              className="text-xs px-2 py-1 rounded bg-[#1e1e1e] text-text-muted hover:text-brand-mint transition-colors"
            >
              {copied ? "Copiado!" : "Copiar"}
            </button>
            <button
              onClick={() => code && onLoad(code)}
              className="text-xs px-2 py-1 rounded bg-brand-mint/15 text-brand-mint hover:bg-brand-mint/25 transition-colors"
            >
              Cargar en Editor
            </button>
            <button
              onClick={onClose}
              className="text-text-muted hover:text-text-primary ml-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        {/* Code */}
        <div className="flex-1 overflow-auto">
          {code === null ? (
            <div className="flex items-center justify-center h-40 text-text-muted text-sm">
              Cargando...
            </div>
          ) : (
            <SyntaxHighlighter
              language="tsx"
              style={oneDark}
              customStyle={{
                margin: 0,
                padding: "16px",
                background: "transparent",
                fontSize: "13px",
                lineHeight: "1.6",
              }}
              wrapLongLines
            >
              {code}
            </SyntaxHighlighter>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main Tab ──────────────────────────────────────────────── */

export default function OcrGeneratorTab() {
  // Generator state
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState("image/png");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [generating, setGenerating] = useState(false);
  const [refining, setRefining] = useState(false);
  const [chatHistory, setChatHistory] = useState<HistoryMessage[]>([]);

  // Library state
  const [view, setView] = useState<"generator" | "library">("generator");
  const [library, setLibrary] = useState<LibraryComponent[]>([]);
  const [librarySearch, setLibrarySearch] = useState("");
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [viewingComponent, setViewingComponent] = useState<LibraryComponent | null>(null);

  const handleImageSelected = useCallback((base64: string, mimeType: string) => {
    setImageBase64(base64);
    setImageMime(mimeType);
    setImagePreview(`data:${mimeType};base64,${base64}`);
  }, []);

  const handleGenerate = async () => {
    if (!imageBase64 || generating) return;
    setGenerating(true);
    setGeneratedCode("");
    setChatHistory([]);
    try {
      const res = await fetch(`${API}/api/ocr/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_base64: imageBase64,
          mime_type: imageMime,
          description,
        }),
      });
      const data = await res.json();
      if (data.code) setGeneratedCode(data.code);
    } catch (err) {
      console.error("Generate error:", err);
    } finally {
      setGenerating(false);
    }
  };

  const handleRefine = async (correction: string) => {
    if (!generatedCode || refining) return;
    setRefining(true);
    setChatHistory((prev) => [...prev, { role: "user", content: correction }]);
    try {
      const res = await fetch(`${API}/api/ocr/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: generatedCode,
          correction,
          history: chatHistory,
        }),
      });
      const data = await res.json();
      if (data.code) {
        setGeneratedCode(data.code);
        setChatHistory((prev) => [
          ...prev,
          { role: "assistant", content: "Componente actualizado." },
        ]);
      }
    } catch (err) {
      console.error("Refine error:", err);
    } finally {
      setRefining(false);
    }
  };

  const fetchLibrary = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/ocr/library`);
      const data = await res.json();
      setLibrary(data.components || []);
    } catch (err) {
      console.error("Library fetch error:", err);
    }
  }, []);

  useEffect(() => {
    if (view === "library") fetchLibrary();
  }, [view, fetchLibrary]);

  const handleDelete = async (name: string) => {
    if (!confirm(`Eliminar "${name}"?`)) return;
    try {
      await fetch(`${API}/api/ocr/library/${name}`, { method: "DELETE" });
      fetchLibrary();
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const handleLoadFromLibrary = (code: string) => {
    setGeneratedCode(code);
    setChatHistory([]);
    setViewingComponent(null);
    setView("generator");
  };

  const handleReset = () => {
    setImageBase64(null);
    setImagePreview(null);
    setDescription("");
    setGeneratedCode("");
    setChatHistory([]);
  };

  const filteredLibrary = library.filter((c) => {
    const q = librarySearch.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.tags.some((t) => t.toLowerCase().includes(q)) ||
      (c.description || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-text-primary tracking-tight">
            OCR Component Generator
          </h2>
          <p className="text-sm text-text-muted mt-0.5">
            Subi una imagen de UI y genera un componente React + Tailwind
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView("generator")}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              view === "generator"
                ? "bg-brand-mint/15 text-brand-mint"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            Generador
          </button>
          <button
            onClick={() => setView("library")}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              view === "library"
                ? "bg-brand-mint/15 text-brand-mint"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            Biblioteca ({library.length})
          </button>
        </div>
      </div>

      {/* ── Generator View ─────────────────────────────── */}
      {view === "generator" && (
        <div className="flex gap-4" style={{ height: "calc(100vh - 180px)" }}>
          {/* Left: Upload + Chat */}
          <div className="w-[380px] shrink-0 flex flex-col gap-3">
            {/* Image upload */}
            <div className="glass-card p-3">
              <ImageUploader
                onImageSelected={handleImageSelected}
                preview={imagePreview}
              />
            </div>

            {/* Description + Generate */}
            <div className="glass-card p-3 space-y-2">
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripcion adicional (opcional)..."
                className="w-full bg-[#151515] text-sm text-text-primary px-3 py-2 rounded-lg border border-[#1e1e1e] focus:border-brand-mint/40 outline-none placeholder:text-text-muted/40"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleGenerate();
                }}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleGenerate}
                  disabled={!imageBase64 || generating}
                  className="flex-1 px-4 py-2 text-sm font-medium bg-brand-mint/15 text-brand-mint rounded-lg hover:bg-brand-mint/25 transition-colors disabled:opacity-30"
                >
                  {generating ? "Generando..." : "Generar Componente"}
                </button>
                {generatedCode && (
                  <>
                    <button
                      onClick={() => setShowSaveModal(true)}
                      className="px-3 py-2 text-sm bg-[#1e1e1e] text-text-muted hover:text-brand-mint rounded-lg transition-colors"
                      title="Guardar"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-6H7v6m10 0H7m10 0h2a2 2 0 002-2V7.414a1 1 0 00-.293-.707l-3.414-3.414A1 1 0 0016.586 3H5a2 2 0 00-2 2v14a2 2 0 002 2h2" />
                      </svg>
                    </button>
                    <button
                      onClick={handleReset}
                      className="px-3 py-2 text-sm bg-[#1e1e1e] text-text-muted hover:text-red-400 rounded-lg transition-colors"
                      title="Limpiar"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Refinement chat */}
            {generatedCode && (
              <div className="glass-card flex-1 flex flex-col min-h-0">
                <div className="px-3 py-2 border-b border-[#1e1e1e]">
                  <span className="text-xs text-text-muted font-medium">
                    Refinamiento
                  </span>
                </div>
                <CorrectionChat
                  onSend={handleRefine}
                  history={chatHistory}
                  loading={refining}
                />
              </div>
            )}
          </div>

          {/* Right: Code panel */}
          <div className="flex-1 glass-card flex flex-col min-h-0">
            <CodePanel code={generatedCode} loading={generating} />
          </div>
        </div>
      )}

      {/* ── Library View ───────────────────────────────── */}
      {view === "library" && (
        <div style={{ height: "calc(100vh - 180px)" }} className="flex flex-col">
          {/* Search */}
          <div className="mb-4">
            <input
              value={librarySearch}
              onChange={(e) => setLibrarySearch(e.target.value)}
              placeholder="Buscar por nombre o tag..."
              className="w-full max-w-md bg-[#151515] text-sm text-text-primary px-3 py-2 rounded-lg border border-[#1e1e1e] focus:border-brand-mint/40 outline-none placeholder:text-text-muted/40"
            />
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-auto">
            {filteredLibrary.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-text-muted text-sm">
                {library.length === 0
                  ? "No hay componentes guardados aun"
                  : "Sin resultados"}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {filteredLibrary.map((comp) => (
                  <div
                    key={comp.name}
                    className="glass-card p-4 space-y-3 group"
                  >
                    <div>
                      <h4 className="text-sm font-semibold text-text-primary">
                        {comp.name}
                      </h4>
                      {comp.description && (
                        <p className="text-xs text-text-muted mt-0.5">
                          {comp.description}
                        </p>
                      )}
                    </div>
                    {comp.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {comp.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 text-[10px] bg-brand-mint/10 text-brand-mint rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="text-[10px] text-text-muted/50">
                      {new Date(comp.created_at).toLocaleDateString()}
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setViewingComponent(comp)}
                        className="text-xs px-2 py-1 bg-[#1e1e1e] text-text-muted hover:text-brand-mint rounded transition-colors"
                      >
                        Ver Codigo
                      </button>
                      <button
                        onClick={() => handleDelete(comp.name)}
                        className="text-xs px-2 py-1 bg-[#1e1e1e] text-text-muted hover:text-red-400 rounded transition-colors"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {showSaveModal && (
        <SaveModal
          code={generatedCode}
          onClose={() => setShowSaveModal(false)}
          onSaved={fetchLibrary}
        />
      )}
      {viewingComponent && (
        <CodeModal
          component={viewingComponent}
          onClose={() => setViewingComponent(null)}
          onLoad={handleLoadFromLibrary}
        />
      )}
    </div>
  );
}
