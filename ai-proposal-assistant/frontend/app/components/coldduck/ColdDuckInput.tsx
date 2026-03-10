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
    <div className="bg-surface-card rounded-xl p-6 border border-surface-border">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-14 h-14 bg-brand-mint/15 rounded-lg flex items-center justify-center text-text-primary">
          <DuckIcon size={44} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-text-primary">ColdDuck</h2>
          <p className="text-xs text-text-muted">
            Outreach personalizado con IA
          </p>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 mb-4 bg-surface-dark rounded-lg p-1">
        <button
          onClick={() => setMode("url")}
          className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            mode === "url"
              ? "bg-brand-mint text-text-dark"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          URL de LinkedIn
        </button>
        <button
          onClick={() => setMode("manual")}
          className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            mode === "manual"
              ? "bg-brand-mint text-text-dark"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          Texto manual
        </button>
      </div>

      <div className="space-y-3">
        {mode === "url" ? (
          <div>
            <label className="text-xs text-text-secondary mb-1 block">
              URL de LinkedIn
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="https://www.linkedin.com/in/nombre-persona"
              className="w-full bg-surface-dark border border-surface-border rounded-lg px-4 py-3 text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-mint/50 focus:border-brand-mint"
              disabled={processing}
            />
            {url && !isValidUrl(url) && (
              <p className="text-xs text-red-400 mt-1">
                Ingresa una URL valida de LinkedIn (linkedin.com/in/...)
              </p>
            )}
          </div>
        ) : (
          <div>
            <label className="text-xs text-text-secondary mb-1 block">
              Pega el texto del perfil de LinkedIn
            </label>
            <textarea
              value={profileText}
              onChange={(e) => setProfileText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={"Copia y pega la informacion del perfil de LinkedIn aqui:\nnombre, titulo, experiencia, habilidades, etc."}
              rows={6}
              className="w-full bg-surface-dark border border-surface-border rounded-lg px-4 py-3 text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-mint/50 focus:border-brand-mint resize-y"
              disabled={processing}
            />
            <p className="text-xs text-text-muted mt-1">
              Usa este modo si no tenes la API de RapidAPI configurada o si el scraping falla.
            </p>
          </div>
        )}

        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-text-muted hover:text-text-secondary transition-colors"
        >
          {showAdvanced ? "▼" : "▶"} Opciones avanzadas
        </button>

        {showAdvanced && (
          <div className="space-y-3 p-4 bg-surface-dark rounded-lg">
            <div>
              <label className="text-xs text-text-secondary mb-1 block">
                Tono del mensaje
              </label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full bg-surface-card border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand-mint"
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
              <label className="text-xs text-text-secondary mb-1 block">
                Objetivo
              </label>
              <input
                type="text"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className="w-full bg-surface-card border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-brand-mint"
              />
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={generateVideo}
                  onChange={(e) => setGenerateVideo(e.target.checked)}
                  className="w-4 h-4 accent-brand-mint"
                />
                <span className="text-sm text-text-secondary">
                  Generar video con avatar (HeyGen)
                </span>
              </label>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-4">
        <span className="text-xs text-text-muted">
          Cmd+Enter para enviar
        </span>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || processing}
          className="px-5 py-2 bg-brand-mint hover:bg-brand-mint-dark disabled:bg-surface-border disabled:text-text-muted text-text-dark font-medium rounded-lg transition-colors"
        >
          {processing ? "Procesando..." : "Generar Outreach"}
        </button>
      </div>
    </div>
  );
}
