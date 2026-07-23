"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Sparkles, ArrowLeft } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import { AuthShell } from "@/components/auth/AuthShell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          redirect_to: `${window.location.origin}/auth/callback?next=/reset-password`,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessage(data.message || "If an account exists for this email, a password reset link has been sent.");
      } else {
        setError("Failed to send reset link. Please try again later.");
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="chip-accent inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold shadow-sm mb-1">
            <Sparkles className="h-3.5 w-3.5 text-[color:var(--eve-accent)]" /> Password Recovery
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">Reset Password</h1>
          <p className="text-xs text-muted-foreground">Enter your email to receive a password reset link</p>
        </div>

        <form onSubmit={handleReset} className="space-y-4">
          {error && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs rounded-xl flex items-start gap-2">
              <span>{error}</span>
            </div>
          )}
          {message && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 text-xs rounded-xl flex items-start gap-2">
              <span>{message}</span>
            </div>
          )}
          
          <div>
            <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2">Work Email Address</label>
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
          
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>

        <div className="pt-4 border-t border-border/60 text-center">
          <Link href="/login" className="inline-flex items-center gap-1.5 text-xs font-bold text-[color:var(--eve-accent)] hover:underline transition-colors">
            <ArrowLeft size={14} /> Back to Sign In
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}

