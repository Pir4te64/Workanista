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
    <div className="p-5 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.04)" }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-medium text-text-secondary">Video Avatar</span>
        <span
          className="badge"
          style={
            videoState.status === "completed"
              ? { background: "rgba(34,197,94,0.1)", color: "#4ade80" }
              : videoState.status === "processing"
              ? { background: "rgba(234,179,8,0.1)", color: "#facc15" }
              : { background: "rgba(239,68,68,0.1)", color: "#f87171" }
          }
        >
          {videoState.status === "processing" ? "Generando..." : videoState.status}
        </span>
      </div>

      {videoState.status === "processing" && (
        <div className="space-y-2">
          <div className="w-full rounded-full h-1.5 overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
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
        <div className="space-y-3">
          <video
            src={videoState.video_url}
            controls
            className="w-full rounded-xl max-h-96"
          />
          <a
            href={videoState.video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary inline-block text-xs"
          >
            Descargar video
          </a>
        </div>
      )}

      {videoState.status === "failed" && (
        <p className="text-xs text-red-400/80">
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
    <div className="glass-card" style={{ borderColor: "rgba(0, 245, 160, 0.12)" }}>
      <div className="p-6" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold text-text-primary">
              {profile.full_name}
            </h3>
            <p className="text-sm text-text-secondary mt-0.5">{profile.headline}</p>
            <div className="flex items-center gap-3 mt-2">
              <p className="text-xs text-text-muted">
                {profile.current_role} @ {profile.current_company}
              </p>
              {linkedinUrl && (
                <a
                  href={linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="badge" style={{ background: "rgba(59, 130, 246, 0.1)", color: "#60a5fa" }}
                >
                  Ver perfil en LinkedIn
                </a>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted/50 hover:text-text-muted transition-colors text-sm"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="flex gap-1 px-6 pt-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        {(["message", "analysis", "profile"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-xs font-medium rounded-t-lg transition-all duration-200 ${
              activeTab === tab
                ? "text-brand-mint"
                : "text-text-muted hover:text-text-primary"
            }`}
            style={
              activeTab === tab
                ? { background: "rgba(0, 245, 160, 0.06)", borderBottom: "2px solid #00F5A0" }
                : { borderBottom: "2px solid transparent" }
            }
          >
            {tab === "message" ? "Mensaje" : tab === "analysis" ? "Analisis" : "Perfil"}
          </button>
        ))}
      </div>

      <div className="p-6">
        {activeTab === "message" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h4 className="section-title">
                Mensaje generado
              </h4>
              <button
                onClick={() => handleCopy(message, "message")}
                className="btn-primary text-xs px-3 py-1.5"
              >
                {copiedField === "message" ? "Copiado!" : "Copiar mensaje"}
              </button>
            </div>
            <div className="rounded-xl p-5 whitespace-pre-wrap text-sm text-text-primary leading-relaxed" style={{ background: "rgba(255,255,255,0.03)" }}>
              {message}
            </div>

            {video && (
              <VideoSection video={video} outreachId={result.outreach_id} />
            )}
          </div>
        )}

        {activeTab === "analysis" && (
          <div className="space-y-5">
            <div>
              <p className="text-sm text-text-primary leading-relaxed mb-3">
                {analysis.person_summary}
              </p>
              <p className="text-xs text-text-muted">
                Mejor approach: <span className="text-text-secondary">{analysis.best_approach}</span>
              </p>
            </div>

            <div>
              <h4 className="section-title mb-3">
                Pain Points
              </h4>
              <div className="flex flex-wrap gap-2">
                {analysis.pain_points?.map((p: string, i: number) => (
                  <span
                    key={i}
                    className="badge" style={{ background: "rgba(239, 68, 68, 0.08)", color: "#f87171" }}
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h4 className="section-title mb-3">
                Connection Hooks
              </h4>
              <div className="flex flex-wrap gap-2">
                {analysis.connection_hooks?.map((h: string, i: number) => (
                  <span
                    key={i}
                    className="badge" style={{ background: "rgba(0, 245, 160, 0.08)", color: "#00F5A0" }}
                  >
                    {h}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <h4 className="section-title mb-3">
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
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-text-muted">Industria</span>
                <p className="text-text-primary mt-0.5">{profile.industry}</p>
              </div>
              <div>
                <span className="text-text-muted">Ubicacion</span>
                <p className="text-text-primary mt-0.5">
                  {profile.location}, {profile.country}
                </p>
              </div>
            </div>
            {profile.summary && (
              <div>
                <span className="text-text-muted">Resumen</span>
                <p className="text-text-secondary mt-1 leading-relaxed">{profile.summary}</p>
              </div>
            )}
            {profile.experiences?.length > 0 && (
              <div>
                <span className="text-text-muted">Experiencia</span>
                <div className="mt-2 space-y-2">
                  {profile.experiences.map((exp: { title: string; company: string }, i: number) => (
                    <div key={i} className="pl-3" style={{ borderLeft: "2px solid rgba(255,255,255,0.06)" }}>
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
                <span className="text-text-muted">Skills</span>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {profile.skills.slice(0, 15).map((s: string, i: number) => (
                    <span
                      key={i}
                      className="badge" style={{ background: "rgba(255,255,255,0.04)", color: "#A0A0B8" }}
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
