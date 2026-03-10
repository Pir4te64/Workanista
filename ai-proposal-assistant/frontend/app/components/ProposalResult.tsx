"use client";

import { useState } from "react";
import type { ProposalResponse } from "@/lib/api";

interface Props {
  data: ProposalResponse;
}

export default function ProposalResult({ data }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(data.response);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const analysis = data.analysis;

  return (
    <div className="space-y-5">
      {/* Analysis */}
      <div className="glass-card p-6">
        <h2 className="text-sm font-semibold text-text-primary mb-4">Analisis del proyecto</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-text-muted text-xs">Tipo</span>
            <p className="text-text-primary mt-0.5">{analysis.project_type}</p>
          </div>
          <div>
            <span className="text-text-muted text-xs">Complejidad</span>
            <p className="text-text-primary mt-0.5">{analysis.complexity}</p>
          </div>
          <div>
            <span className="text-text-muted text-xs">Nivel del cliente</span>
            <p className="text-text-primary mt-0.5">{analysis.client_technical_level}</p>
          </div>
          <div>
            <span className="text-text-muted text-xs">Urgencia</span>
            <p className="text-text-primary mt-0.5">{analysis.urgency}</p>
          </div>
          <div className="col-span-2">
            <span className="text-text-muted text-xs">Tecnologias</span>
            <p className="text-text-primary mt-0.5">
              {analysis.technologies?.join(", ") || "N/A"}
            </p>
          </div>
          <div className="col-span-2">
            <span className="text-text-muted text-xs">Arquitectura sugerida</span>
            <p className="text-text-primary mt-0.5">
              {analysis.suggested_architecture}
            </p>
          </div>
        </div>
      </div>

      {/* Generated Response */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-text-primary">Respuesta generada</h2>
          <button
            onClick={handleCopy}
            className="btn-secondary text-xs px-3 py-1.5"
          >
            {copied ? "Copiado!" : "Copiar"}
          </button>
        </div>
        <div className="rounded-xl p-5 whitespace-pre-wrap text-sm text-text-secondary leading-relaxed" style={{ background: "rgba(255,255,255,0.03)" }}>
          {data.response}
        </div>
      </div>
    </div>
  );
}
