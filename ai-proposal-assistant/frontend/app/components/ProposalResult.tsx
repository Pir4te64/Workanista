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
    <div className="space-y-6">
      {/* Analysis */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h2 className="text-lg font-semibold mb-4">Analisis del proyecto</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Tipo:</span>{" "}
            <span className="text-white">{analysis.project_type}</span>
          </div>
          <div>
            <span className="text-gray-400">Complejidad:</span>{" "}
            <span className="text-white">{analysis.complexity}</span>
          </div>
          <div>
            <span className="text-gray-400">Nivel del cliente:</span>{" "}
            <span className="text-white">
              {analysis.client_technical_level}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Urgencia:</span>{" "}
            <span className="text-white">{analysis.urgency}</span>
          </div>
          <div className="col-span-2">
            <span className="text-gray-400">Tecnologias:</span>{" "}
            <span className="text-white">
              {analysis.technologies?.join(", ") || "N/A"}
            </span>
          </div>
          <div className="col-span-2">
            <span className="text-gray-400">Arquitectura sugerida:</span>{" "}
            <span className="text-white">
              {analysis.suggested_architecture}
            </span>
          </div>
        </div>
      </div>

      {/* Generated Response */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Respuesta generada</h2>
          <button
            onClick={handleCopy}
            className="px-4 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors"
          >
            {copied ? "Copiado!" : "Copiar"}
          </button>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 whitespace-pre-wrap text-gray-200 leading-relaxed">
          {data.response}
        </div>
      </div>
    </div>
  );
}
