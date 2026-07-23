"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";

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
    if (password.length === 0) return { label: "", color: "bg-card", text: "text-muted-foreground" };
    if (score <= 2) return { label: "Weak", color: "bg-rose-500", text: "text-rose-500" };
    if (score <= 4) return { label: "Fair", color: "bg-amber-500", text: "text-amber-550" };
    return { label: "Strong", color: "bg-emerald-500", text: "text-emerald-400" };
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
      <div data-theme="executive-light" className="eve-auth-shell min-h-screen bg-secondary flex flex-col items-center justify-center p-4 font-sans text-foreground">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
        <p className="text-muted-foreground text-sm tracking-wider animate-pulse">Verifying reset credentials...</p>
      </div>
    );
  }

  return (
    <div data-theme="executive-light" className="eve-auth-shell min-h-screen bg-secondary text-foreground flex flex-col justify-center items-center p-4 font-sans relative">
      <div className="eve-auth-card w-full max-w-md bg-card border border-border rounded-2xl shadow-xl overflow-hidden relative z-10">
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <div className="h-12 w-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl tracking-tighter shadow-md shadow-indigo-600/20">
              EVE
            </div>
          </div>
          <h2 className="text-2xl font-bold text-foreground text-center mb-1.5">Set New Password</h2>
          <p className="text-xs text-muted-foreground text-center mb-8">Establish a new operational key for your EVE portal</p>

          {errorMsg && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs rounded-xl flex items-start gap-2 mb-6">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-xs rounded-xl flex items-start gap-2 mb-6">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {sessionActive && !successMsg ? (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">New Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-muted-foreground"
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
                <label className="block text-xs font-semibold text-foreground mb-1.5">Confirm New Password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-muted-foreground"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !isPasswordValid}
                className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer mt-6"
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
                  className="w-full flex justify-center py-2.5 px-4 border border-border hover:bg-muted text-foreground rounded-xl text-sm font-semibold transition-all cursor-pointer text-center"
                >
                  Request New Reset Email
                </Link>
              </div>
            )
          )}
        </div>
        
        <div className="px-8 py-4 bg-muted/50 border-t border-border text-center">
          <Link href="/login" className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 transition-colors">
            Back to login
          </Link>
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

