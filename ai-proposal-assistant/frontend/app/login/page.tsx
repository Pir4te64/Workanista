"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setMessage("Revisa tu email para confirmar tu cuenta.");
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setMessage("Te enviamos un link para restablecer tu contrasena.");
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const handleSubmit =
    mode === "login"
      ? handleLogin
      : mode === "signup"
      ? handleSignup
      : handleForgotPassword;

  return (
    <div className="min-h-screen flex">
      {/* Left side - Image */}
      <div className="hidden lg:flex lg:w-1/2 relative">
        <Image
          src="/intro.jpg"
          alt="CruzNegraDev"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-surface-black/90" />
        <div className="absolute inset-0 bg-gradient-to-t from-surface-black/95 via-transparent to-surface-black/50" />

        {/* Duck icon centered */}
        <div className="absolute inset-0 flex items-center justify-center">
          <Image
            src="/coldducklogo.png"
            alt="ColdDuck"
            width={600}
            height={600}
            className="opacity-90 drop-shadow-2xl"
          />
        </div>

        {/* Overlay content */}
        <div className="absolute bottom-0 left-0 right-0 p-12">
          <h2 className="text-4xl font-semibold text-text-primary mb-3 tracking-tight">
            ColdDuck
          </h2>
          <p className="text-base text-text-secondary max-w-md leading-relaxed">
            Tu asistente de outreach y propuestas impulsado por IA. Analiza perfiles, genera mensajes personalizados y gana mas proyectos.
          </p>
          <div className="flex items-center gap-2 mt-8">
            <div className="w-8 h-1 bg-brand-mint rounded-full" />
            <div className="w-4 h-1 bg-brand-mint/40 rounded-full" />
            <div className="w-2 h-1 bg-brand-mint/20 rounded-full" />
          </div>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-surface-black">
        <div className="w-full max-w-md space-y-8">
          {/* Logo */}
          <div className="text-center lg:text-left">
            <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
              {mode === "login"
                ? "Bienvenido"
                : mode === "signup"
                ? "Crear cuenta"
                : "Recuperar contrasena"}
            </h1>
            <p className="text-sm text-text-muted mt-2">
              {mode === "login"
                ? "Ingresa a tu cuenta para continuar"
                : mode === "signup"
                ? "Registrate para empezar a usar Workanista"
                : "Ingresa tu email y te enviaremos un link"}
            </p>
          </div>

          {/* Google OAuth */}
          {mode !== "forgot" && (
            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl text-text-primary transition-all duration-200 hover:shadow-glow"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span className="text-sm font-medium">Continuar con Google</span>
            </button>
          )}

          {mode !== "forgot" && (
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
              <span className="text-xs text-text-muted">o</span>
              <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
            </div>
          )}

          {/* Success message */}
          {message && (
            <div className="p-4 rounded-xl" style={{ background: "rgba(34, 197, 94, 0.06)", border: "1px solid rgba(34, 197, 94, 0.15)" }}>
              <p className="text-sm text-green-400">{message}</p>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="p-4 rounded-xl" style={{ background: "rgba(239, 68, 68, 0.06)", border: "1px solid rgba(239, 68, 68, 0.15)" }}>
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="section-title block mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                className="input-premium"
              />
            </div>

            {mode !== "forgot" && (
              <div>
                <label className="section-title block mb-2">
                  Contrasena
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="input-premium"
                />
              </div>
            )}

            {mode === "login" && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setMode("forgot");
                    setError(null);
                    setMessage(null);
                  }}
                  className="text-xs text-brand-mint/80 hover:text-brand-mint transition-colors"
                >
                  Olvidaste tu contrasena?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3"
            >
              {loading
                ? "Cargando..."
                : mode === "login"
                ? "Ingresar"
                : mode === "signup"
                ? "Crear cuenta"
                : "Enviar link"}
            </button>
          </form>

          {/* Toggle mode */}
          <div className="text-center text-sm text-text-muted">
            {mode === "login" ? (
              <>
                No tenes cuenta?{" "}
                <button
                  onClick={() => {
                    setMode("signup");
                    setError(null);
                    setMessage(null);
                  }}
                  className="text-brand-mint/80 hover:text-brand-mint transition-colors"
                >
                  Registrate
                </button>
              </>
            ) : (
              <>
                Ya tenes cuenta?{" "}
                <button
                  onClick={() => {
                    setMode("login");
                    setError(null);
                    setMessage(null);
                  }}
                  className="text-brand-mint/80 hover:text-brand-mint transition-colors"
                >
                  Ingresar
                </button>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="pt-8 text-center">
            <p className="text-[11px] text-text-muted/60">
              CruzNegraDev LLC &middot; Workanista
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
