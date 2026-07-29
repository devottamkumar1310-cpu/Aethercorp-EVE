"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, RefreshCw, CheckCircle, AlertCircle, Sparkles } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams?.get("email") || "";
  
  const [email, setEmail] = useState(emailParam);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    // Sync email from Supabase auth state if search param is missing
    const checkSession = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        if (user.email) setEmail(user.email);
        if (user.email_confirmed_at) {
          // If already verified, send them directly to dashboard
          router.push("/dashboard/inventory");
          return;
        }
      }
      setIsChecking(false);
    };
    checkSession();
  }, [router, supabase.auth]);

  // Handle countdown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleResend = async () => {
    if (!email) {
      setError("Email address is required.");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);

    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`
      }
    });

    setLoading(false);

    if (resendError) {
      setError(resendError.message);
    } else {
      setMessage("Verification email has been resent successfully!");
      setCooldown(60);
    }
  };

  if (isChecking) {
    return (
      <AuthShell>
        <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <RefreshCw size={24} className="animate-spin text-indigo-600" />
          <span className="text-sm font-medium">Verifying session...</span>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="chip-accent inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold shadow-sm mb-1">
            <Sparkles className="h-3.5 w-3.5 text-[color:var(--eve-accent)]" /> Verification Required
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">Verify Your Email</h1>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
            We sent a verification link to <span className="font-semibold text-foreground">{email || "your registered email"}</span>. Click it and you&apos;ll land straight in your workspace.
            {/* Two additions from the audit: this screen previously offered no
                escape from a typo'd address and no spam hint, making it a hard
                stop between signup and any value. */}
            <span className="block mt-3 text-xs text-muted-foreground">
              Not there in a minute? Check spam — it arrives from Supabase, not from eveinventory.in.
            </span>
            <span className="block mt-2 text-xs text-muted-foreground">
              Wrong address?{" "}
              <Link href="/signup" className="font-semibold text-[color:var(--eve-accent)] hover:underline">
                Sign up again with the right one
              </Link>
              .
            </span>
          </p>
        </div>

        {message && (
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-xs rounded-xl flex items-start gap-2">
            <CheckCircle size={16} className="shrink-0 mt-0.5" />
            <span>{message}</span>
          </div>
        )}

        {error && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs rounded-xl flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={handleResend}
            disabled={loading || cooldown > 0}
            className="w-full py-3.5 px-4 text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                Resending...
              </>
            ) : cooldown > 0 ? (
              `Resend link in ${cooldown}s`
            ) : (
              "Resend Verification Link"
            )}
          </button>
        </div>

        <div className="pt-4 border-t border-border/60 text-center">
          <Link 
            href="/login" 
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[color:var(--eve-accent)] hover:underline transition-colors"
          >
            <ArrowLeft size={14} /> Back to Sign In
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <AuthShell>
        <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <RefreshCw size={24} className="animate-spin text-indigo-600" />
        </div>
      </AuthShell>
    }>
      <VerifyEmailForm />
    </Suspense>
  );
}


