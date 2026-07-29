"use client";
import { logger } from "@/lib/logger";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Lock, Mail, AlertTriangle, CheckCircle, Loader2, Sparkles } from "lucide-react";
import { API_BASE_URL, apiFetch } from "@/lib/api";
import { AuthShell } from "@/components/auth/AuthShell";
import { track, identify } from "@/lib/analytics";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const infoMessage = searchParams?.get("message");
  const queryError = searchParams?.get("error");

  const handleGoogleLogin = async () => {
    setError(null);
    const supabase = createClient();
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // /onboarding forwards existing users to the dashboard automatically,
        // so first-time Google sign-ins still get workspace setup.
        redirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
      }
    });

    if (error) {
      setError(error.message);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      // Sync with backend
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          if (session.user?.id) identify(session.user.id);
          track("login_completed", { method: "email" });
          await apiFetch(`${API_BASE_URL}/api/auth/sync`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${session.access_token}` }
          });
        }
      } catch (e) {
        logger.error("Sync failed", e);
      }
      router.push("/dashboard/inventory");
    }
  };

  return (
    <AuthShell>
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="chip-accent inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold shadow-sm mb-1">
            <Sparkles className="h-3.5 w-3.5 text-[color:var(--eve-accent)]" /> EVE Portal Access
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">Welcome Back</h1>
          <p className="text-xs text-muted-foreground">Sign in to your inventory workspace</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs rounded-xl flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {queryError && !error && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs rounded-xl flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{queryError}</span>
            </div>
          )}
          {infoMessage && !error && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-xs rounded-xl flex items-start gap-2">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{infoMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2">Email</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Mail className="h-4 w-4 text-muted-foreground" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-2.5 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[color:var(--eve-accent)]/20 focus:border-[color:var(--eve-accent)] transition-all"
                placeholder="founder@acmefashion.com"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-bold text-foreground uppercase tracking-wider">Password</label>
              <Link href="/forgot-password" className="text-xs font-semibold text-[color:var(--eve-accent)] hover:underline transition-colors">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock className="h-4 w-4 text-muted-foreground" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-2.5 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[color:var(--eve-accent)]/20 focus:border-[color:var(--eve-accent)] transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
          >
            {loading ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-4 h-4 animate-spin" />
                Signing in...
              </span>
            ) : (
              "Sign In"
            )}
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-2 text-muted-foreground font-medium">Or continue with</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-2.5 py-3 px-4 border border-border rounded-xl text-xs font-bold text-foreground bg-secondary hover:bg-secondary/70 transition-all cursor-pointer shadow-sm"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
        </form>

        <div className="pt-4 border-t border-border/60 text-center">
          <p className="text-xs text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/signup" className="font-bold text-[color:var(--eve-accent)] hover:underline transition-colors">
              Start free trial
            </Link>
          </p>
        </div>
      </div>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <AuthShell>
        <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 size={24} className="animate-spin text-indigo-600" />
          <span className="text-sm font-medium">Loading login portal...</span>
        </div>
      </AuthShell>
    }>
      <LoginForm />
    </Suspense>
  );
}


