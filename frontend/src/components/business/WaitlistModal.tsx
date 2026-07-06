import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { API_BASE_URL } from "@/lib/api";

interface WaitlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: any;
  title?: string;
  description?: string;
  onSuccess?: () => void;
}

export function WaitlistModal({
  isOpen,
  onClose,
  profile,
  title = "Join Priority Waitlist",
  description = "Get early access to paid plans, launch discounts, and priority onboarding.",
  onSuccess
}: WaitlistModalProps) {
  const [companyName, setCompanyName] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [revenueRange, setRevenueRange] = useState("");
  const [challenge, setChallenge] = useState("");
  
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const token = localStorage.getItem("supabase.auth.token");
      const res = await fetch(`${API_BASE_URL}/api/waitlist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          name: profile?.full_name || "",
          email: profile?.email || "",
          company_name: companyName,
          company_website: companyWebsite,
          revenue_range: revenueRange,
          biggest_inventory_challenge: challenge
        })
      });

      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
        if (onSuccess) onSuccess();
      } else {
        setError(data.detail || "Something went wrong. Please try again.");
      }
    } catch (err: any) {
      setError("Failed to connect to the server. Please check your network.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md bg-card border border-border p-6 rounded-2xl shadow-xl">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-xl font-bold text-foreground tracking-tight">{title}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">{description}</DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-6 text-center space-y-4">
            <div className="h-12 w-12 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto text-xl">
              ✓
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-foreground">You're on the list!</h4>
              <p className="text-xs text-muted-foreground">Thank you for your interest. We'll contact you at {profile?.email} as soon as we launch paid plans.</p>
            </div>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-foreground text-xs font-semibold rounded-lg transition-all"
            >
              Back to EVE
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Name</label>
              <input
                type="text"
                disabled
                value={profile?.full_name || ""}
                className="w-full bg-sidebar-accent/50 border border-sidebar-border rounded-lg px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Email</label>
              <input
                type="email"
                disabled
                value={profile?.email || ""}
                className="w-full bg-sidebar-accent/50 border border-sidebar-border rounded-lg px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Company Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Aether Atelier"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full bg-sidebar-accent border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Company Website</label>
                <input
                  type="text"
                  placeholder="e.g. aether.com"
                  value={companyWebsite}
                  onChange={(e) => setCompanyWebsite(e.target.value)}
                  className="w-full bg-sidebar-accent border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Annual Revenue Range</label>
              <select
                value={revenueRange}
                onChange={(e) => setRevenueRange(e.target.value)}
                className="w-full bg-sidebar-accent border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-indigo-500 transition-colors"
              >
                <option value="">Select range...</option>
                <option value="under_100k">Under $100k</option>
                <option value="100k_500k">$100k - $500k</option>
                <option value="500k_2m">$500k - $2M</option>
                <option value="over_2m">$2M+</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Biggest Inventory Challenge</label>
              <textarea
                placeholder="e.g. Stockouts during peak season, fabric supplier delays"
                rows={2}
                value={challenge}
                onChange={(e) => setChallenge(e.target.value)}
                className="w-full bg-sidebar-accent border border-sidebar-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-indigo-500 transition-colors resize-none"
              />
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-sidebar-border hover:bg-sidebar-accent text-foreground text-xs font-semibold rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-foreground text-xs font-semibold rounded-lg transition-all"
              >
                {submitting ? "Submitting..." : "Join Priority Waitlist"}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
