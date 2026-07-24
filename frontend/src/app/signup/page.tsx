"use client";
import { logger } from "@/lib/logger";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Lock, Mail, User, AlertTriangle, CheckCircle, Loader2, Sparkles } from "lucide-react";
import { API_BASE_URL, apiFetch } from "@/lib/api";
import { AuthShell } from "@/components/auth/AuthShell";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Password validation rules
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const isPasswordValid = hasMinLength && hasUppercase && hasLowercase && hasNumber && hasSpecialChar;

  // Strength score out of 5
  const strengthScore = [
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecialChar
  ].filter(Boolean).length;

  const getStrengthText = (score: number) => {
    if (password.length === 0) return { label: "", color: "bg-muted", text: "text-muted-foreground" };
    if (score <= 2) return { label: "Weak", color: "bg-rose-500", text: "text-rose-600" };
    if (score <= 4) return { label: "Fair", color: "bg-amber-500", text: "text-amber-600" };
    return { label: "Strong", color: "bg-emerald-500", text: "text-emerald-600" };
  };

  const strength = getStrengthText(strengthScore);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agree) {
      setError("You must agree to the Terms of Service and Privacy Policy.");
      return;
    }
    if (!isPasswordValid) {
      setError("Your password does not satisfy all complexity requirements below.");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    
    const supabase = createClient();
    
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        }
      }
    });

    if (signUpError) {
      const raw = signUpError.message || "";
      if (/invalid/i.test(raw) && /email/i.test(raw)) {
        setError("We couldn't verify that email address — double-check for typos, or try a different email (a personal address works fine for your free trial).");
      } else if (/already registered|already exists/i.test(raw)) {
        setError("An account already exists for this email. Try signing in instead.");
      } else {
        setError(raw || "Something went wrong creating your account. Please try again.");
      }
      setLoading(false);
      return;
    }

    if (data?.session) {
      // Sync with backend
      try {
        await apiFetch(`${API_BASE_URL}/api/auth/sync`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${data.session.access_token}` }
        });
      } catch (e) {
        logger.error("Sync failed", e);
      }
      router.push("/onboarding");
    } else {
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    }
  };

  return (
    <AuthShell>
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="chip-accent inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold shadow-sm mb-1">
            <Sparkles className="h-3.5 w-3.5 text-[color:var(--eve-accent)]" /> Start Free Trial
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">Create Your Account</h1>
          <p className="text-xs text-muted-foreground">Get full executive access to EVE Operating System</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          {error && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs rounded-xl flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {message && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-xs rounded-xl flex items-start gap-2">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{message}</span>
            </div>
          )}
          
          <div>
            <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2">Full Name</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-2.5 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[color:var(--eve-accent)]/20 focus:border-[color:var(--eve-accent)] transition-all"
                placeholder="John Doe"
              />
            </div>
          </div>

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
            <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2">Password</label>
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

            {/* Password Strength Meter & Visual Indicators */}
            {password.length > 0 && (
              <div className="mt-3 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground">Password Strength:</span>
                  <span className={`font-semibold ${strength.text}`}>{strength.label}</span>
                </div>
                
                {/* Strength Bar */}
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden border border-border">
                  <div 
                    className={`h-full ${strength.color} transition-all duration-300`} 
                    style={{ width: `${(strengthScore / 5) * 100}%` }}
                  />
                </div>

                {/* Rules Checklist */}
                <ul className="space-y-1.5 text-xs text-muted-foreground mt-2">
                  <li className="flex items-center gap-1.5">
                    <span className={`w-4 h-4 flex items-center justify-center rounded-full text-[10px] font-bold ${hasMinLength ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/30" : "bg-muted text-muted-foreground border border-border"}`}>
                      {hasMinLength ? "✓" : "✕"}
                    </span>
                    <span>At least 8 characters</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className={`w-4 h-4 flex items-center justify-center rounded-full text-[10px] font-bold ${hasUppercase ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/30" : "bg-muted text-muted-foreground border border-border"}`}>
                      {hasUppercase ? "✓" : "✕"}
                    </span>
                    <span>At least one uppercase letter (A-Z)</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className={`w-4 h-4 flex items-center justify-center rounded-full text-[10px] font-bold ${hasLowercase ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/30" : "bg-muted text-muted-foreground border border-border"}`}>
                      {hasLowercase ? "✓" : "✕"}
                    </span>
                    <span>At least one lowercase letter (a-z)</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className={`w-4 h-4 flex items-center justify-center rounded-full text-[10px] font-bold ${hasNumber ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/30" : "bg-muted text-muted-foreground border border-border"}`}>
                      {hasNumber ? "✓" : "✕"}
                    </span>
                    <span>At least one number (0-9)</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className={`w-4 h-4 flex items-center justify-center rounded-full text-[10px] font-bold ${hasSpecialChar ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/30" : "bg-muted text-muted-foreground border border-border"}`}>
                      {hasSpecialChar ? "✓" : "✕"}
                    </span>
                    <span>At least one special character (!@#$%^&*)</span>
                  </li>
                </ul>
              </div>
            )}
          </div>
          
          <div className="flex items-start gap-2.5 my-4">
            <input
              id="agree-checkbox"
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              className="mt-1 h-4 w-4 rounded bg-background border border-border text-indigo-600 focus:ring-indigo-500/20 cursor-pointer"
              required
            />
            <label htmlFor="agree-checkbox" className="text-xs text-muted-foreground cursor-pointer leading-normal select-none">
              I agree to the{" "}
              <Link href="/terms" className="font-bold text-[color:var(--eve-accent)] hover:underline transition-colors">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="font-bold text-[color:var(--eve-accent)] hover:underline transition-colors">
                Privacy Policy
              </Link>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || !agree || !isPasswordValid}
            className="w-full py-3.5 px-4 text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
          >
            {loading ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating account...
              </span>
            ) : (
              "Start Free Trial"
            )}
          </button>
        </form>

        <div className="pt-4 border-t border-border/60 text-center">
          <p className="text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-bold text-[color:var(--eve-accent)] hover:underline transition-colors">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </AuthShell>
  );
}
