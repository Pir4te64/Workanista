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
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-surface-black/80" />
        <div className="absolute inset-0 bg-gradient-to-t from-surface-black/90 via-transparent to-surface-black/40" />

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
          <h2 className="text-4xl font-bold text-text-primary mb-3">
            ColdDuck
          </h2>
          <p className="text-lg text-text-secondary max-w-md">
            Tu asistente de outreach y propuestas impulsado por IA. Analiza perfiles, genera mensajes personalizados y gana mas proyectos.
          </p>
          <div className="flex items-center gap-2 mt-6">
            <div className="w-8 h-1 bg-brand-mint rounded-full" />
            <div className="w-4 h-1 bg-brand-mint/50 rounded-full" />
            <div className="w-2 h-1 bg-brand-mint/25 rounded-full" />
          </div>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-surface-black">
        <div className="w-full max-w-md space-y-8">
          {/* Logo */}
          <div className="text-center lg:text-left">
            <h1 className="text-2xl font-bold text-text-primary">
              {mode === "login"
                ? "Bienvenido"
                : mode === "signup"
                ? "Crear cuenta"
                : "Recuperar contrasena"}
            </h1>
            <p className="text-sm text-text-secondary mt-2">
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
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-surface-card border border-surface-border rounded-xl text-text-primary hover:bg-surface-card-hover transition-colors"
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
              Continuar con Google
            </button>
          )}

          {mode !== "forgot" && (
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-surface-border" />
              <span className="text-xs text-text-muted">o</span>
              <div className="flex-1 h-px bg-surface-border" />
            </div>
          )}

          {/* Success message */}
          {message && (
            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
              <p className="text-sm text-green-400">{message}</p>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-sm text-text-secondary mb-1.5 block">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                className="w-full bg-surface-card border border-surface-border rounded-xl px-4 py-3 text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-mint/50 focus:border-brand-mint transition-colors"
              />
            </div>

            {mode !== "forgot" && (
              <div>
                <label className="text-sm text-text-secondary mb-1.5 block">
                  Contrasena
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full bg-surface-card border border-surface-border rounded-xl px-4 py-3 text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-mint/50 focus:border-brand-mint transition-colors"
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
                  className="text-xs text-brand-mint hover:text-brand-mint-light transition-colors"
                >
                  Olvidaste tu contrasena?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-brand-mint hover:bg-brand-mint-dark disabled:bg-surface-border disabled:text-text-muted text-text-dark font-semibold rounded-xl transition-colors"
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
                  className="text-brand-mint hover:text-brand-mint-light transition-colors"
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
                  className="text-brand-mint hover:text-brand-mint-light transition-colors"
                >
                  Ingresar
                </button>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="pt-8 text-center">
            <p className="text-xs text-text-muted">
              CruzNegraDev LLC &middot; Workanista
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
