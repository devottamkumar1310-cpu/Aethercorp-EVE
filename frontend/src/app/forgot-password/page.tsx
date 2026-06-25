"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
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
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <div className="h-12 w-12 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl tracking-tighter">
              EVE
            </div>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-2">Reset Password</h2>
          <p className="text-slate-500 text-center mb-8 text-sm">Enter your email to receive a reset link</p>

          <form onSubmit={handleReset} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-700 text-sm rounded-md border border-red-200">
                {error}
              </div>
            )}
            {message && (
              <div className="p-3 bg-emerald-50 text-emerald-700 text-sm rounded-md border border-emerald-200">
                {message}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm outline-none transition-all"
                  placeholder="founder@acmefashion.com"
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-6"
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>
        </div>
        <div className="px-8 py-4 bg-slate-50 border-t border-slate-200 text-center flex justify-between">
          <Link href="/login" className="text-sm font-medium text-indigo-600 hover:text-indigo-500 transition-colors">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
