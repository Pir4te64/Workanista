"use client";

import { useState } from "react";
import { checkDuplicate } from "@/lib/api";

interface Props {
  onAdd: (text: string) => void;
  queueCount: number;
}

export default function ProposalInput({ onAdd, queueCount }: Props) {
  const [text, setText] = useState("");
  const [duplicate, setDuplicate] = useState<{
    show: boolean;
    similarity?: number;
    originalText?: string;
  }>({ show: false });
  const [checking, setChecking] = useState(false);

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
    <div className="bg-surface-card rounded-xl p-6 border border-surface-border">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-text-primary">
          Agregar propuesta a la cola
        </h2>
        {queueCount > 0 && (
          <span className="text-sm text-text-secondary">
            {queueCount} en cola
          </span>
        )}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Pega aqui la propuesta del cliente de Workana..."
        rows={6}
        className="w-full bg-surface-dark border border-surface-border rounded-lg p-4 text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-orange/50 focus:border-brand-orange resize-y"
      />

      {/* Duplicate warning popup */}
      {duplicate.show && (
        <div className="mt-3 p-4 bg-brand-orange/10 border border-brand-orange/40 rounded-lg">
          <p className="text-sm text-brand-orange font-medium mb-2">
            Propuesta duplicada detectada (
            {Math.round((duplicate.similarity || 0) * 100)}% similar)
          </p>
          <p className="text-xs text-text-secondary mb-3 line-clamp-2">
            Original: {duplicate.originalText}...
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleForceAdd}
              className="px-4 py-1.5 text-xs bg-brand-orange hover:bg-brand-orange-light text-white rounded-lg transition-colors"
            >
              Agregar de todas formas
            </button>
            <button
              onClick={handleDismissDuplicate}
              className="px-4 py-1.5 text-xs bg-surface-card-hover hover:bg-text-dark text-text-secondary rounded-lg transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-text-muted">
          Cmd+Enter para agregar rapido
        </span>
        <button
          onClick={handleAdd}
          disabled={!text.trim() || checking}
          className="px-5 py-2 bg-brand-orange hover:bg-brand-orange-light disabled:bg-surface-border disabled:text-text-muted text-white font-medium rounded-lg transition-colors"
        >
          {checking ? "Verificando..." : "Agregar a la cola"}
        </button>
      </div>
    </div>
  );
}
