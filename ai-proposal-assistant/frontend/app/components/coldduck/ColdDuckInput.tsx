"use client";

import { useState } from "react";
import DuckIcon from "./DuckIcon";

interface Props {
  onSubmit: (params: {
    linkedin_url?: string;
    profile_text?: string;
    tone: string;
    goal: string;
    generate_video: boolean;
    avatar_id: string;
    voice_id: string;
  }) => void;
  processing: boolean;
}

export default function ColdDuckInput({ onSubmit, processing }: Props) {
  const [mode, setMode] = useState<"url" | "manual">("url");
  const [url, setUrl] = useState("");
  const [profileText, setProfileText] = useState("");
  const [tone, setTone] = useState("profesional y cercano");
  const [goal, setGoal] = useState(
    "ofrecer servicios de desarrollo de software a medida"
  );
  const [generateVideo, setGenerateVideo] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const isValidUrl = (u: string) =>
    u.includes("linkedin.com/in/") || u.includes("linkedin.com/company/");

  const canSubmit =
    mode === "url"
      ? url.trim() && isValidUrl(url)
      : profileText.trim().length > 20;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      linkedin_url: mode === "url" ? url.trim() : "",
      profile_text: mode === "manual" ? profileText.trim() : "",
      tone,
      goal,
      generate_video: generateVideo,
      avatar_id: "default",
      voice_id: "default",
    });
    setUrl("");
    setProfileText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "rgba(0, 245, 160, 0.08)" }}>
          <DuckIcon size={36} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-text-primary">ColdDuck</h2>
          <p className="text-xs text-text-muted">
            Outreach personalizado con IA
          </p>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 mb-5 rounded-xl p-1" style={{ background: "rgba(255,255,255,0.04)" }}>
        <button
          onClick={() => setMode("url")}
          className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-all duration-200 ${
            mode === "url"
              ? "bg-brand-mint text-text-dark shadow-sm"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          URL de LinkedIn
        </button>
        <button
          onClick={() => setMode("manual")}
          className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-all duration-200 ${
            mode === "manual"
              ? "bg-brand-mint text-text-dark shadow-sm"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          Texto manual
        </button>
      </div>

      <div className="space-y-4">
        {mode === "url" ? (
          <div>
            <label className="section-title block mb-2">
              URL de LinkedIn
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="https://www.linkedin.com/in/nombre-persona"
              className="input-premium"
              disabled={processing}
            />
            {url && !isValidUrl(url) && (
              <p className="text-xs text-red-400/80 mt-2">
                Ingresa una URL valida de LinkedIn (linkedin.com/in/...)
              </p>
            )}
          </div>
        ) : (
          <div>
            <label className="section-title block mb-2">
              Pega el texto del perfil de LinkedIn
            </label>
            <textarea
              value={profileText}
              onChange={(e) => setProfileText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={"Copia y pega la informacion del perfil de LinkedIn aqui:\nnombre, titulo, experiencia, habilidades, etc."}
              rows={6}
              className="input-premium resize-y"
              disabled={processing}
            />
            <p className="text-xs text-text-muted mt-2">
              Usa este modo si no tenes la API de RapidAPI configurada o si el scraping falla.
            </p>
          </div>
        )}

        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-text-muted hover:text-text-secondary transition-colors flex items-center gap-1.5"
        >
          <svg className={`w-3 h-3 transition-transform duration-200 ${showAdvanced ? "rotate-90" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M9 18l6-6-6-6" />
          </svg>
          Opciones avanzadas
        </button>

        {showAdvanced && (
          <div className="space-y-4 p-5 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.04)" }}>
            <div>
              <label className="section-title block mb-2">
                Tono del mensaje
              </label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="input-premium text-sm"
              >
                <option value="profesional y cercano">
                  Profesional y cercano
                </option>
                <option value="casual y directo">Casual y directo</option>
                <option value="formal y ejecutivo">Formal y ejecutivo</option>
                <option value="tecnico y especifico">
                  Tecnico y especifico
                </option>
              </select>
            </div>

            <div>
              <label className="section-title block mb-2">
                Objetivo
              </label>
              <input
                type="text"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className="input-premium text-sm"
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={generateVideo}
                  onChange={(e) => setGenerateVideo(e.target.checked)}
                  className="w-4 h-4 accent-brand-mint rounded"
                />
                <span className="text-sm text-text-secondary">
                  Generar video con avatar (HeyGen)
                </span>
              </label>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-5">
        <div className="flex items-center gap-2">
          <kbd className="px-1.5 py-0.5 text-[10px] text-text-muted rounded" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
            ⌘↵
          </kbd>
          <span className="text-[11px] text-text-muted">para enviar</span>
        </div>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || processing}
          className="btn-primary"
        >
          {processing ? "Procesando..." : "Generar Outreach"}
        </button>
      </div>
    </div>
  );
}
