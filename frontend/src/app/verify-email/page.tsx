"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Mail, ArrowLeft, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";

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
      <div data-theme="executive-light" className="eve-auth-shell min-h-screen bg-secondary flex flex-col justify-center items-center p-4 text-foreground">
        <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <RefreshCw size={24} className="animate-spin text-indigo-600" />
          <span className="text-sm font-medium">Verifying session...</span>
        </div>
      </div>
    );
  }

  return (
    <div data-theme="executive-light" className="eve-auth-shell min-h-screen bg-secondary text-foreground flex flex-col justify-center items-center p-4 font-sans relative">
      <div className="eve-auth-card w-full max-w-md bg-card rounded-2xl shadow-xl border border-border overflow-hidden relative z-10">
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <div className="h-12 w-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl tracking-tighter shadow-md shadow-indigo-600/20">
              EVE
            </div>
          </div>

          <h2 className="text-2xl font-bold text-foreground text-center mb-1.5">Verify Your Email</h2>
          <p className="text-muted-foreground text-center mb-6 text-xs leading-relaxed">
            We sent a verification link to <span className="font-semibold text-foreground">{email || "your registered email"}</span>. Please check your inbox and confirm.
          </p>

          {message && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-xs rounded-xl flex items-start gap-2 mb-4">
              <CheckCircle size={16} className="shrink-0 mt-0.5" />
              <span>{message}</span>
            </div>
          )}

          {error && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs rounded-xl flex items-start gap-2 mb-4">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handleResend}
              disabled={loading || cooldown > 0}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  Resending...
                </>
              ) : cooldown > 0 ? (
                `Resend in ${cooldown}s`
              ) : (
                "Resend Verification Link"
              )}
            </button>

            <div className="pt-4 border-t border-border flex flex-col gap-2.5">
              <Link 
                href="/login" 
                className="w-full py-2 px-4 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
              >
                <ArrowLeft size={14} /> Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
      <footer className="mt-8 text-center text-xs text-muted-foreground space-x-4">
        <Link href="/privacy" className="hover:text-foreground transition-colors">
          Privacy Policy
        </Link>
        <span>&bull;</span>
        <Link href="/terms" className="hover:text-foreground transition-colors">
          Terms of Service
        </Link>
        <span>&bull;</span>
        <a href="mailto:support@eveinventory.in" className="hover:text-foreground transition-colors">
          Contact
        </a>
      </footer>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div data-theme="executive-light" className="min-h-screen bg-secondary flex flex-col justify-center items-center p-4 text-foreground">
        <RefreshCw size={24} className="animate-spin text-indigo-600" />
      </div>
    }>
      <VerifyEmailForm />
    </Suspense>
  );
}

