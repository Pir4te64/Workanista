"use client";

import { useState } from "react";
import { checkDuplicate } from "@/lib/api";
import { useToast } from "./Toast";
import { FadeIn } from "./AnimatedList";

interface Props {
  onAdd: (text: string) => void;
  queueCount: number;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
}

export default function ProposalInput({ onAdd, queueCount, inputRef }: Props) {
  const [text, setText] = useState("");
  const [duplicate, setDuplicate] = useState<{
    show: boolean;
    similarity?: number;
    originalText?: string;
  }>({ show: false });
  const [checking, setChecking] = useState(false);
  const { addToast } = useToast();

  const handleAdd = async () => {
    if (!text.trim()) return;

    setChecking(true);
    try {
      const result = await checkDuplicate(text.trim());
      if (result.is_duplicate) {
        setDuplicate({
          show: true,
          similarity: result.similarity,
          originalText: result.original_text,
        });
        addToast("info", "Propuesta duplicada detectada");
        setChecking(false);
        return;
      }
    } catch {
      // If check fails, proceed anyway
    }
    setChecking(false);

    onAdd(text.trim());
    setText("");
  };

  const handleForceAdd = () => {
    onAdd(text.trim());
    setText("");
    setDuplicate({ show: false });
  };

  const handleDismissDuplicate = () => {
    setDuplicate({ show: false });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleAdd();
    }
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-text-primary">
          Agregar propuesta a la cola
        </h2>
        {queueCount > 0 && (
          <span className="badge bg-brand-mint/10 text-brand-mint">
            {queueCount} en cola
          </span>
        )}
      </div>
      <textarea
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Pega aqui la propuesta del cliente de Workana..."
        rows={6}
        className="input-premium resize-y"
      />

      {/* Duplicate warning */}
      {duplicate.show && (
        <FadeIn>
          <div className="mt-4 p-4 rounded-xl" style={{ background: "rgba(0, 245, 160, 0.06)", border: "1px solid rgba(0, 245, 160, 0.15)" }}>
            <p className="text-sm text-brand-mint font-medium mb-2">
              Propuesta duplicada detectada (
              {Math.round((duplicate.similarity || 0) * 100)}% similar)
            </p>
            <p className="text-xs text-text-secondary mb-3 line-clamp-2">
              Original: {duplicate.originalText}...
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleForceAdd}
                className="btn-primary text-xs px-4 py-2"
              >
                Agregar de todas formas
              </button>
              <button
                onClick={handleDismissDuplicate}
                className="btn-secondary text-xs px-4 py-2"
              >
                Cancelar
              </button>
            </div>
          </div>
        </FadeIn>
      )}

      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-2">
          <kbd className="px-1.5 py-0.5 text-[10px] text-text-muted rounded" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
            ⌘↵
          </kbd>
          <span className="text-[11px] text-text-muted">agregar rapido</span>
        </div>
        <button
          onClick={handleAdd}
          disabled={!text.trim() || checking}
          className="btn-primary"
        >
          {checking ? "Verificando..." : "Agregar a la cola"}
        </button>
      </div>
    </div>
  );
}
