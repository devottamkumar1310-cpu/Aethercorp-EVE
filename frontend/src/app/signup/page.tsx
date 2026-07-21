"use client";
import { logger } from "@/lib/logger";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Lock, Mail, User } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";

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
    if (password.length === 0) return { label: "", color: "bg-zinc-800", text: "text-zinc-550" };
    if (score <= 2) return { label: "Weak", color: "bg-rose-500", text: "text-rose-400" };
    if (score <= 4) return { label: "Fair", color: "bg-amber-500", text: "text-amber-400" };
    return { label: "Strong", color: "bg-emerald-500", text: "text-emerald-400" };
  };

  const strength = getStrengthText(strengthScore);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agree) {
      setError("You must agree to the Terms of Service and Privacy Policy.");
      return;
    }
    if (!isPasswordValid) {
      setError("Your password does not satisfy all requirements. Please verify that it meets all the complexity rules checked below.");
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
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data?.session) {
      // Sync with backend
      try {
        await fetch(`${API_BASE_URL}/api/auth/sync`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${data.session.access_token}` }
        });
      } catch (e) {
        logger.error("Sync failed", e);
      }
      // Auto-login (if email confirmation is disabled)
      router.push("/onboarding");
    } else {
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    }
  };

  return (
    <div className="eve-auth-shell min-h-screen bg-[#020203] text-white flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      {/* Background Star field & Glows */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="hero-stars" />
        <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-purple-500/10 rounded-full filter blur-[120px] opacity-40" />
      </div>

      <div className="eve-auth-card w-full max-w-md bg-white/[0.02] border border-white/[0.08] backdrop-blur-xl rounded-2xl shadow-2xl relative z-10">
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <div className="h-12 w-12 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-lg flex items-center justify-center text-white font-black text-xl tracking-tighter shadow-md shadow-purple-900/20">
              E
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white text-center mb-2">Create Account</h2>
          <p className="text-zinc-400 text-center mb-8 text-sm">Start forecasting with confidence</p>

          <form onSubmit={handleSignup} className="space-y-4">
            {error && (
              <div className="p-3 bg-rose-500/10 text-rose-400 text-sm rounded-md border border-rose-500/25">
                {error}
              </div>
            )}
            {message && (
              <div className="p-3 bg-emerald-500/10 !text-white [&_svg]:!text-white [&_svg]:!stroke-white text-sm rounded-md border border-emerald-500/25">
                {message}
              </div>
            )}
            
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Full Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-zinc-500" />
                </div>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="pl-10 block w-full bg-white/5 border border-white/10 rounded-lg py-2 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 sm:text-sm outline-none transition-all"
                  placeholder="John Doe"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-zinc-500" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 block w-full bg-white/5 border border-white/10 rounded-lg py-2 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 sm:text-sm outline-none transition-all"
                  placeholder="founder@acmefashion.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-zinc-500" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 block w-full bg-white/5 border border-white/10 rounded-lg py-2 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 sm:text-sm outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>

              {/* Password Strength Meter & Visual Indicators */}
              {password.length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-500">Password Strength:</span>
                    <span className={`font-semibold ${strength.text}`}>{strength.label}</span>
                  </div>
                  
                  {/* Strength Bar */}
                  <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${strength.color} transition-all duration-300`} 
                      style={{ width: `${(strengthScore / 5) * 100}%` }}
                    />
                  </div>

                  {/* Rules Checklist */}
                  <ul className="space-y-1.5 text-xs text-zinc-400 mt-2">
                    <li className="flex items-center gap-1.5">
                      <span className={`w-3.5 h-3.5 flex items-center justify-center rounded-full text-[10px] font-bold ${hasMinLength ? "bg-emerald-500/10 text-emerald-450 border border-emerald-500/25" : "bg-white/5 text-zinc-550 border border-white/10"}`}>
                        {hasMinLength ? "✓" : "✕"}
                      </span>
                      <span>At least 8 characters</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className={`w-3.5 h-3.5 flex items-center justify-center rounded-full text-[10px] font-bold ${hasUppercase ? "bg-emerald-500/10 text-emerald-450 border border-emerald-500/25" : "bg-white/5 text-zinc-550 border border-white/10"}`}>
                        {hasUppercase ? "✓" : "✕"}
                      </span>
                      <span>At least one uppercase letter (A-Z)</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className={`w-3.5 h-3.5 flex items-center justify-center rounded-full text-[10px] font-bold ${hasLowercase ? "bg-emerald-500/10 text-emerald-450 border border-emerald-500/25" : "bg-white/5 text-zinc-550 border border-white/10"}`}>
                        {hasLowercase ? "✓" : "✕"}
                      </span>
                      <span>At least one lowercase letter (a-z)</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className={`w-3.5 h-3.5 flex items-center justify-center rounded-full text-[10px] font-bold ${hasNumber ? "bg-emerald-500/10 text-emerald-450 border border-emerald-500/25" : "bg-white/5 text-zinc-550 border border-white/10"}`}>
                        {hasNumber ? "✓" : "✕"}
                      </span>
                      <span>At least one number (0-9)</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className={`w-3.5 h-3.5 flex items-center justify-center rounded-full text-[10px] font-bold ${hasSpecialChar ? "bg-emerald-500/10 text-emerald-450 border border-emerald-500/25" : "bg-white/5 text-zinc-550 border border-white/10"}`}>
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
                className="mt-1 h-4 w-4 rounded bg-white/5 border border-white/10 text-[#4F46E5] focus:ring-purple-500/50 cursor-pointer"
                required
              />
              <label htmlFor="agree-checkbox" className="text-xs text-zinc-400 cursor-pointer leading-normal select-none">
                I agree to the{" "}
                <Link href="/terms" className="font-semibold text-purple-400 hover:text-purple-300 transition-colors">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="font-semibold text-purple-400 hover:text-purple-300 transition-colors">
                  Privacy Policy
                </Link>
                .
              </label>
            </div>

            <button
              type="submit"
              disabled={loading || !isPasswordValid || !agree}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-md text-sm font-semibold text-white bg-[#4F46E5] hover:bg-[#4F46E5]/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-6 btn-primary-glow"
            >
              {loading ? "Creating account..." : "Sign Up"}
            </button>
          </form>
        </div>
        <div className="px-8 py-4 bg-white/[0.01] border-t border-white/[0.08] text-center">
          <p className="text-sm text-zinc-400">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-purple-400 hover:text-purple-300 transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
      <footer className="mt-8 text-center text-xs text-zinc-550 space-x-4">
        <Link href="/privacy" className="text-zinc-400 hover:text-white transition-colors">
          Privacy Policy
        </Link>
        <span>&bull;</span>
        <Link href="/terms" className="text-zinc-400 hover:text-white transition-colors">
          Terms of Service
        </Link>
        <span>&bull;</span>
        <a href="mailto:support@eveinventory.in" className="text-zinc-400 hover:text-white transition-colors">
          Contact
        </a>
      </footer>
    </div>
  );
}
