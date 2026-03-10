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
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Pega aqui la propuesta del cliente de Workana..."
        rows={6}
        className="w-full bg-surface-dark border border-surface-border rounded-lg p-4 text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-mint/50 focus:border-brand-mint resize-y"
      />

      {/* Duplicate warning popup */}
      {duplicate.show && (
        <FadeIn>
          <div className="mt-3 p-4 bg-brand-mint/10 border border-brand-mint/40 rounded-lg">
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
                className="px-4 py-1.5 text-xs bg-brand-mint hover:bg-brand-mint-dark text-text-dark rounded-lg transition-colors"
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
        </FadeIn>
      )}

      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-text-muted">
          Cmd+Enter para agregar rapido
        </span>
        <button
          onClick={handleAdd}
          disabled={!text.trim() || checking}
          className="px-5 py-2 bg-brand-mint hover:bg-brand-mint-dark disabled:bg-surface-border disabled:text-text-muted text-text-dark font-medium rounded-lg transition-colors"
        >
          {checking ? "Verificando..." : "Agregar a la cola"}
        </button>
      </div>
    </div>
  );
}
