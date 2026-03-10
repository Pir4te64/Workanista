"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { checkVideoStatus, type OutreachResponse, type VideoData } from "@/lib/coldduck-api";

interface Props {
  result: OutreachResponse;
  onClose: () => void;
}

function VideoSection({ video, outreachId }: { video: VideoData; outreachId: string }) {
  const [videoState, setVideoState] = useState<VideoData>(video);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pollStatus = useCallback(async () => {
    try {
      const status = await checkVideoStatus(videoState.video_id, outreachId);
      setVideoState(status);
      if (status.status === "completed" || status.status === "failed") {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (timerRef.current) clearInterval(timerRef.current);
      }
    } catch {
      // keep polling
    }
  }, [videoState.video_id, outreachId]);

  useEffect(() => {
    if (videoState.status === "processing") {
      intervalRef.current = setInterval(pollStatus, 10000);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [videoState.status, pollStatus]);

  const progressPercent = Math.min(95, Math.round((elapsed / 120) * 100));
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="p-4 bg-surface-dark rounded-lg">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-medium text-text-secondary">Video Avatar</span>
        <span
          className={`px-2 py-0.5 text-xs rounded ${
            videoState.status === "completed"
              ? "bg-green-500/15 text-green-400"
              : videoState.status === "processing"
              ? "bg-yellow-500/15 text-yellow-400"
              : "bg-red-500/15 text-red-400"
          }`}
        >
          {videoState.status === "processing" ? "Generando..." : videoState.status}
        </span>
      </div>

      {videoState.status === "processing" && (
        <div className="space-y-2">
          <div className="w-full bg-surface-border rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-brand-mint rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-text-muted">
            <span>HeyGen procesando video...</span>
            <span>{formatTime(elapsed)} / ~2:00</span>
          </div>
          <p className="text-xs text-text-muted">
            El video se actualiza automaticamente. No cierres esta ventana.
          </p>
        </div>
      )}

      {videoState.status === "completed" && videoState.video_url && (
        <div className="space-y-2">
          <video
            src={videoState.video_url}
            controls
            className="w-full rounded-lg max-h-96"
          />
          <a
            href={videoState.video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-3 py-1 text-xs bg-brand-mint hover:bg-brand-mint-dark text-text-dark rounded-lg transition-colors"
          >
            Descargar video
          </a>
        </div>
      )}

      {videoState.status === "failed" && (
        <p className="text-xs text-red-400">
          Error generando el video. Intenta nuevamente desde el historial.
        </p>
      )}
    </div>
  );
}

export default function ColdDuckResult({ result, onClose }: Props) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"message" | "analysis" | "profile">("message");

  const handleCopy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const { profile, analysis, message, video, linkedin_url: linkedinUrl } = result;

  const relevanceColor = (level: string) => {
    if (level === "alta") return "text-green-400";
    if (level === "media") return "text-yellow-400";
    return "text-text-muted";
  };

  return (
    <div className="bg-surface-card rounded-xl border border-brand-mint/30">
      <div className="p-5 border-b border-surface-border">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-text-primary">
              {profile.full_name}
            </h3>
            <p className="text-sm text-text-secondary">{profile.headline}</p>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-xs text-text-muted">
                {profile.current_role} @ {profile.current_company}
              </p>
              {linkedinUrl && (
                <a
                  href={linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2 py-0.5 text-xs bg-blue-600/15 text-blue-400 hover:bg-blue-600/25 rounded transition-colors"
                >
                  Ver perfil en LinkedIn
                </a>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors text-lg"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex gap-1 px-5 pt-3 border-b border-surface-border">
        {(["message", "analysis", "profile"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 text-xs font-medium rounded-t-lg transition-colors ${
              activeTab === tab
                ? "bg-surface-dark text-text-primary border-b-2 border-brand-mint"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            {tab === "message" ? "Mensaje" : tab === "analysis" ? "Analisis" : "Perfil"}
          </button>
        ))}
      </div>

      <div className="p-5">
        {activeTab === "message" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-text-secondary">
                Mensaje generado
              </h4>
              <button
                onClick={() => handleCopy(message, "message")}
                className="px-3 py-1 text-xs bg-brand-mint hover:bg-brand-mint-dark text-text-dark rounded-lg transition-colors"
              >
                {copiedField === "message" ? "Copiado!" : "Copiar mensaje"}
              </button>
            </div>
            <div className="bg-surface-dark rounded-lg p-4 whitespace-pre-wrap text-sm text-text-primary leading-relaxed">
              {message}
            </div>

            {video && (
              <VideoSection video={video} outreachId={result.outreach_id} />
            )}
          </div>
        )}

        {activeTab === "analysis" && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-text-primary mb-3">
                {analysis.person_summary}
              </p>
              <p className="text-xs text-text-muted mb-1">
                Mejor approach: <span className="text-text-secondary">{analysis.best_approach}</span>
              </p>
            </div>

            <div>
              <h4 className="text-xs font-medium text-text-muted mb-2 uppercase">
                Pain Points
              </h4>
              <div className="flex flex-wrap gap-2">
                {analysis.pain_points?.map((p: string, i: number) => (
                  <span
                    key={i}
                    className="px-2 py-1 text-xs bg-red-500/10 text-red-400 rounded"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-medium text-text-muted mb-2 uppercase">
                Connection Hooks
              </h4>
              <div className="flex flex-wrap gap-2">
                {analysis.connection_hooks?.map((h: string, i: number) => (
                  <span
                    key={i}
                    className="px-2 py-1 text-xs bg-brand-mint/10 text-brand-mint rounded"
                  >
                    {h}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-medium text-text-muted mb-2 uppercase">
                Relevancia de servicios
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {analysis.services_relevance &&
                  Object.entries(analysis.services_relevance).map(
                    ([key, val]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-text-muted">
                          {key.replace(/_/g, " ")}
                        </span>
                        <span className={relevanceColor(val as string)}>{val as string}</span>
                      </div>
                    )
                  )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "profile" && (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-text-muted">Industria:</span>{" "}
                <span className="text-text-primary">{profile.industry}</span>
              </div>
              <div>
                <span className="text-text-muted">Ubicacion:</span>{" "}
                <span className="text-text-primary">
                  {profile.location}, {profile.country}
                </span>
              </div>
            </div>
            {profile.summary && (
              <div>
                <span className="text-text-muted">Resumen:</span>
                <p className="text-text-secondary mt-1">{profile.summary}</p>
              </div>
            )}
            {profile.experiences?.length > 0 && (
              <div>
                <span className="text-text-muted">Experiencia:</span>
                <div className="mt-1 space-y-2">
                  {profile.experiences.map((exp: { title: string; company: string }, i: number) => (
                    <div key={i} className="pl-3 border-l border-surface-border">
                      <span className="text-text-primary font-medium">
                        {exp.title}
                      </span>{" "}
                      <span className="text-text-muted">@ {exp.company}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {profile.skills?.length > 0 && (
              <div>
                <span className="text-text-muted">Skills:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {profile.skills.slice(0, 15).map((s: string, i: number) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-surface-dark text-text-secondary rounded"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
