"use client";

import { useState } from "react";
import { MessageSquare, Star, X, Loader2 } from "lucide-react";
import { submitFeedbackAPI } from "@/services/businessService";
import { toast } from "sonner";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionToken: string;
}

export default function FeedbackModal({ isOpen, onClose, sessionToken }: FeedbackModalProps) {
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [category, setCategory] = useState<string>("AI Response");
  const [description, setDescription] = useState<string>("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (description.trim().length < 5) {
      toast.error("Please provide a description with at least 5 characters.");
      return;
    }

    setLoading(true);
    try {
      const pageUrl = typeof window !== "undefined" ? window.location.pathname : "";
      await submitFeedbackAPI(sessionToken, {
        rating,
        category,
        description,
        page_url: pageUrl
      });
      toast.success("Feedback submitted! Thank you for helping improve EVE.");
      setDescription("");
      setRating(5);
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to submit feedback.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-card dark:bg-card border border-border dark:border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-250 dark:border-border">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
            <MessageSquare size={18} />
            <h3 className="font-semibold text-foreground dark:text-foreground">Submit Beta Feedback</h3>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-muted-foreground dark:hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="text-[11px] text-muted-foreground dark:text-muted-foreground bg-secondary dark:bg-background p-3 rounded-lg border border-border dark:border-slate-850 space-y-1">
            <p>Prefer our feedback form? <a href="https://forms.gle/qETMVJfDzHnF86xi7" target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-455 hover:underline font-semibold">Open Google Forms</a>.</p>
            <p>Or email us at: <a href="mailto:aethercorp.support@gmail.com" className="text-indigo-600 dark:text-indigo-455 hover:underline font-semibold">aethercorp.support@gmail.com</a></p>
          </div>
          {/* Rating */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground dark:text-muted-foreground mb-2">
              How is your experience with EVE?
            </label>
            <div className="flex gap-2 items-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(null)}
                  className="text-2xl transition-all outline-none focus:scale-110"
                >
                  <Star
                    size={26}
                    className={`${
                      star <= (hoverRating ?? rating)
                        ? "fill-amber-400 text-amber-400"
                        : "text-slate-350 dark:text-muted-foreground"
                    }`}
                  />
                </button>
              ))}
              <span className="ml-3 text-sm font-semibold text-muted-foreground dark:text-muted-foreground">
                {rating === 5 && "Excellent"}
                {rating === 4 && "Very Good"}
                {rating === 3 && "Good"}
                {rating === 2 && "Fair"}
                {rating === 1 && "Poor"}
              </span>
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground dark:text-muted-foreground mb-2">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-card dark:bg-background border border-slate-250 dark:border-border rounded-lg px-3 py-2 text-sm text-foreground dark:text-foreground outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="AI Response">AI Response / Accuracy</option>
              <option value="UI Bug">UI Bug / Layout Issue</option>
              <option value="Performance">Performance / Latency</option>
              <option value="Other">Other / Request</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground dark:text-muted-foreground mb-2">
              Details
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              required
              placeholder="Tell us what went well, what failed, or what we can improve..."
              className="w-full bg-card dark:bg-background border border-slate-250 dark:border-border rounded-lg px-3 py-2 text-sm text-foreground dark:text-foreground outline-none focus:border-indigo-500 transition-colors placeholder:text-muted-foreground dark:placeholder:text-muted-foreground resize-none"
            />
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || description.trim().length < 5}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-sm font-semibold text-foreground rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Feedback"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
