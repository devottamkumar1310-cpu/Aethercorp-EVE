"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Mail, ArrowLeft, RefreshCw, CheckCircle, AlertCircle, ArrowRight } from "lucide-react";

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
          router.push("/dashboard/eve");
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
      <div className="min-h-screen bg-secondary flex flex-col justify-center items-center p-4">
        <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <RefreshCw size={24} className="animate-spin text-indigo-600" />
          <span className="text-sm font-medium">Verifying session...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-card rounded-2xl shadow-xl border border-border overflow-hidden">
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <div className="h-12 w-12 bg-indigo-50/80 rounded-full flex items-center justify-center text-indigo-600">
              <Mail className="h-6 w-6" />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-foreground text-center mb-2">Verify Your Email</h2>
          <p className="text-muted-foreground text-center mb-6 text-sm">
            We sent a verification link to <span className="font-semibold text-foreground">{email || "your registered email"}</span>. Please check your inbox and confirm.
          </p>

          {message && (
            <div className="p-3 bg-emerald-50 text-emerald-700 text-sm rounded-md border border-emerald-250 mb-4 flex items-start gap-2">
              <CheckCircle size={16} className="shrink-0 mt-0.5" />
              <span>{message}</span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-md border border-red-200 mb-4 flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handleResend}
              disabled={loading || cooldown > 0}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-300 text-foreground rounded-lg text-sm font-semibold transition-all shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
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
                className="w-full py-2 px-4 bg-secondary hover:bg-secondary text-foreground rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-1.5"
              >
                <ArrowLeft size={14} /> Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-secondary flex flex-col justify-center items-center p-4">
        <RefreshCw size={24} className="animate-spin text-indigo-600" />
      </div>
    }>
      <VerifyEmailForm />
    </Suspense>
  );
}
