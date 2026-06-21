"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Lock, Eye, EyeOff, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";

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

    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters long.");
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
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-sans text-slate-100">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
        <p className="text-slate-400 text-sm tracking-wider animate-pulse">Verifying reset credentials...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 font-sans text-slate-100">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden relative">
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <div className="h-12 w-12 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl tracking-tighter shadow-lg shadow-indigo-600/30">
              EVE
            </div>
          </div>
          <h2 className="text-2xl font-bold text-slate-100 text-center mb-2">Set New Password</h2>
          <p className="text-slate-400 text-center mb-8 text-xs">Establish a new operational key for your EVE portal</p>

          {errorMsg && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-start gap-2 mb-6">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-start gap-2 mb-6">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {sessionActive && !successMsg ? (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">New Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-600"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-350 transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Confirm New Password</label>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-600"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900/50 disabled:text-slate-550 transition-all cursor-pointer mt-6"
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
                  className="w-full flex justify-center py-3 px-4 border border-slate-800 hover:border-slate-700 bg-slate-950 text-slate-300 rounded-xl text-sm font-semibold transition-all cursor-pointer text-center"
                >
                  Request New Reset Email
                </Link>
              </div>
            )
          )}
        </div>
        
        <div className="px-8 py-4 bg-slate-950/60 border-t border-slate-800 text-center">
          <Link href="/login" className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
