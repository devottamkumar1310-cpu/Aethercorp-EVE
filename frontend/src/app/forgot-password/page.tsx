"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

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
    <div data-theme="executive-light" className="eve-auth-shell min-h-screen bg-secondary text-foreground flex flex-col justify-center items-center p-4 font-sans relative">
      <div className="eve-auth-card w-full max-w-md bg-card rounded-2xl shadow-xl overflow-hidden border border-border">
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <div className="h-12 w-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl tracking-tighter shadow-md shadow-indigo-600/20">
              EVE
            </div>
          </div>
          <h2 className="text-2xl font-bold text-foreground text-center mb-1.5">Reset Password</h2>
          <p className="text-xs text-muted-foreground text-center mb-8">Enter your email to receive a password reset link</p>

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
              <label className="block text-xs font-semibold text-foreground mb-1.5">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-2.5 text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="founder@acmefashion.com"
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-6 cursor-pointer"
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>
        </div>
        <div className="px-8 py-4 bg-muted/50 border-t border-border text-center flex justify-between">
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
