"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, CheckCircle, AlertTriangle, Loader2, Sparkles, ArrowLeft } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [sessionActive, setSessionActive] = useState<boolean>(false);
  const [checkingSession, setCheckingSession] = useState<boolean>(true);
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

  useEffect(() => {
    const supabase = createClient();
    
    // Parse error description from URL hash fragment if present (e.g. invalid/expired recovery token)
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const params = new URLSearchParams(hash.replace("#", "?"));
    const error = params.get("error_description") || params.get("error");
    
    if (error) {
      setErrorMsg(error.replace(/\+/g, " "));
      setCheckingSession(false);
      return;
    }

    // Check if user session was established by the redirect
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionActive(true);
      } else {
        setErrorMsg("Your password reset link is invalid or has expired. Please request a new link.");
      }
      setCheckingSession(false);
    });
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !confirmPassword) return;

    if (!isPasswordValid) {
      setErrorMsg("Password does not meet the complexity requirements.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccessMsg("Password updated successfully.");
        // Sign user out to finalize session cleanliness
        await supabase.auth.signOut();
        setTimeout(() => {
          router.push("/login?message=Password reset successfully. Please log in with your new password.");
        }, 2500);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <AuthShell>
        <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 size={24} className="animate-spin text-indigo-600" />
          <span className="text-sm font-medium">Verifying reset credentials...</span>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="chip-accent inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold shadow-sm mb-1">
            <Sparkles className="h-3.5 w-3.5 text-[color:var(--eve-accent)]" /> Security Credentials
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">Set New Password</h1>
          <p className="text-xs text-muted-foreground">Establish a new password for your EVE account</p>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs rounded-xl flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-xs rounded-xl flex items-start gap-2">
            <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {sessionActive && !successMsg ? (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2">New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--eve-accent)]/20 focus:border-[color:var(--eve-accent)] transition-all placeholder:text-muted-foreground"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Password Strength Meter & Visual Indicators */}
              {password.length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Strength:</span>
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

            <div>
              <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2">Confirm New Password</label>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--eve-accent)]/20 focus:border-[color:var(--eve-accent)] transition-all placeholder:text-muted-foreground"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !isPasswordValid}
              className="w-full py-3.5 px-4 text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
            >
              {loading ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating Key...
                </span>
              ) : (
                "Update Password"
              )}
            </button>
          </form>
        ) : (
          !successMsg && (
            <div className="space-y-4">
              <Link
                href="/forgot-password"
                className="w-full py-3 px-4 border border-border hover:bg-muted text-foreground rounded-xl text-xs font-bold transition-all cursor-pointer text-center block"
              >
                Request New Reset Email
              </Link>
            </div>
          )
        )}

        <div className="pt-4 border-t border-border/60 text-center">
          <Link href="/login" className="inline-flex items-center gap-1.5 text-xs font-bold text-[color:var(--eve-accent)] hover:underline transition-colors">
            <ArrowLeft size={14} /> Back to Sign In
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}


