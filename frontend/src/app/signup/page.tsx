"use client";

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
    if (password.length === 0) return { label: "", color: "bg-secondary", text: "text-muted-foreground" };
    if (score <= 2) return { label: "Weak", color: "bg-rose-500", text: "text-rose-500" };
    if (score <= 4) return { label: "Fair", color: "bg-amber-500", text: "text-amber-500" };
    return { label: "Strong", color: "bg-emerald-500", text: "text-emerald-500" };
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
        console.error("Sync failed", e);
      }
      // Auto-login (if email confirmation is disabled)
      router.push("/onboarding");
    } else {
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    }
  };

  return (
    <div className="min-h-screen bg-secondary flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-card rounded-2xl shadow-xl border border-border">
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <div className="h-12 w-12 bg-indigo-600 rounded-lg flex items-center justify-center text-foreground font-bold text-xl tracking-tighter">
              EVE
            </div>
          </div>
          <h2 className="text-2xl font-bold text-foreground text-center mb-2">Create Account</h2>
          <p className="text-muted-foreground text-center mb-8 text-sm">Start forecasting with confidence</p>

          <form onSubmit={handleSignup} className="space-y-4">
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
              <label className="block text-sm font-medium text-foreground mb-1">Full Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="pl-10 block w-full rounded-md border border-border px-3 py-2 text-foreground focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm outline-none transition-all"
                  placeholder="John Doe"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 block w-full rounded-md border border-border px-3 py-2 text-foreground focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm outline-none transition-all"
                  placeholder="founder@acmefashion.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 block w-full rounded-md border border-border px-3 py-2 text-foreground focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 sm:text-sm outline-none transition-all"
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
                  <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${strength.color} transition-all duration-300`} 
                      style={{ width: `${(strengthScore / 5) * 100}%` }}
                    />
                  </div>

                  {/* Rules Checklist */}
                  <ul className="space-y-1.5 text-xs text-muted-foreground mt-2">
                    <li className="flex items-center gap-1.5">
                      <span className={`w-3.5 h-3.5 flex items-center justify-center rounded-full text-[10px] font-bold ${hasMinLength ? "bg-emerald-100 text-emerald-700" : "bg-secondary text-slate-450"}`}>
                        {hasMinLength ? "✓" : "✕"}
                      </span>
                      <span>At least 8 characters</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className={`w-3.5 h-3.5 flex items-center justify-center rounded-full text-[10px] font-bold ${hasUppercase ? "bg-emerald-100 text-emerald-700" : "bg-secondary text-slate-450"}`}>
                        {hasUppercase ? "✓" : "✕"}
                      </span>
                      <span>At least one uppercase letter (A-Z)</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className={`w-3.5 h-3.5 flex items-center justify-center rounded-full text-[10px] font-bold ${hasLowercase ? "bg-emerald-100 text-emerald-700" : "bg-secondary text-slate-450"}`}>
                        {hasLowercase ? "✓" : "✕"}
                      </span>
                      <span>At least one lowercase letter (a-z)</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className={`w-3.5 h-3.5 flex items-center justify-center rounded-full text-[10px] font-bold ${hasNumber ? "bg-emerald-100 text-emerald-700" : "bg-secondary text-slate-450"}`}>
                        {hasNumber ? "✓" : "✕"}
                      </span>
                      <span>At least one number (0-9)</span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span className={`w-3.5 h-3.5 flex items-center justify-center rounded-full text-[10px] font-bold ${hasSpecialChar ? "bg-emerald-100 text-emerald-700" : "bg-secondary text-slate-450"}`}>
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
                className="mt-1 h-4 w-4 rounded border-border text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                required
              />
              <label htmlFor="agree-checkbox" className="text-xs text-muted-foreground cursor-pointer leading-normal select-none">
                I agree to the{" "}
                <Link href="/terms" className="font-semibold text-indigo-600 hover:text-indigo-500 transition-colors">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="font-semibold text-indigo-600 hover:text-indigo-500 transition-colors">
                  Privacy Policy
                </Link>
                .
              </label>
            </div>

            <button
              type="submit"
              disabled={loading || !isPasswordValid || !agree}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-foreground bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-6"
            >
              {loading ? "Creating account..." : "Sign Up"}
            </button>
          </form>
        </div>
        <div className="px-8 py-4 bg-secondary border-t border-border text-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500 transition-colors">
              Sign in
            </Link>
          </p>
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
