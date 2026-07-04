"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { X, Sparkles, LayoutDashboard, Package, Brain, Users2, ChevronLeft, ChevronRight } from "lucide-react";

interface TourStep {
  title: string;
  targetPath: string;
  targetId?: string;
  icon: any;
  explanation: string;
  bullets: string[];
}

export function ProductTour() {
  const router = useRouter();
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const tourSteps: TourStep[] = [
    {
      title: "Step 1: Inventory Intelligence",
      targetPath: "/dashboard/inventory",
      icon: Package,
      explanation: "Avoid cash flow blocks and supply gaps. EVE automatically monitors stock behavior to keep inventory optimized.",
      bullets: [
        "Dead Stock: Identify low-velocity items tying up capital.",
        "Reorder Recommendations: Get alerts when stock levels drop.",
        "Stockout Prediction: Forecast supply run-out days in advance."
      ]
    },
    {
      title: "Step 2: AI Assistant",
      targetPath: "/dashboard/eve",
      icon: Brain,
      explanation: "Interact directly with EVE, your Inventory & Operations AI Assistant. Get instant analyses and direct answers regarding your business.",
      bullets: [
        "Executive Insights: Live briefings based on daily operations.",
        "Business Analysis: Instant query responses on business data.",
        "Strategic Recommendations: Actionable plans for margin and growth improvement."
      ]
    },
    {
      title: "Step 3: Executive Board",
      targetPath: "/dashboard/eve",
      icon: Users2,
      explanation: "EVE orchestrates a team of specialized AI agents working together to run deep audits on your business data.",
      bullets: [
        "Finance Agent: Audits profitability, margins, and expenses.",
        "Operations Agent: Evaluates supplier performance and SKU safety stocks.",
        "Growth Agent: Targets customer expansion and sales growth opportunities.",
        "Executive Synthesis: Merges agent reports into a unified business strategy."
      ]
    },
    {
      title: "Step 4: Operations & Finance",
      targetPath: "/dashboard",
      icon: LayoutDashboard,
      explanation: "Monitor your core business health at a single glance. EVE tracks your live operations metrics and summarizes performance trends.",
      bullets: [
        "Revenue: Track gross income streams and trends.",
        "Profit: See net margins after subtracting expenses.",
        "Growth: Monitor client, project, and task completion growth.",
        "Inventory Health: Keep track of active SKU states."
      ]
    }
  ];

  useEffect(() => {
    // Show the tour automatically if not completed yet
    const completed = localStorage.getItem("eve_tour_completed");
    if (!completed) {
      // Small delay to let the app load
      const timer = setTimeout(() => {
        setActive(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  // Listen to custom event to restart the tour
  useEffect(() => {
    const handleRestart = () => {
      setCurrentStep(0);
      setActive(true);
      // Redirect to the first step path
      router.push(tourSteps[0].targetPath);
    };

    window.addEventListener("restart-eve-tour", handleRestart);
    return () => {
      window.removeEventListener("restart-eve-tour", handleRestart);
    };
  }, [router]);

  if (!active) return null;

  const step = tourSteps[currentStep];
  const Icon = step.icon;

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      // Navigate to path if different
      if (pathname !== tourSteps[nextStep].targetPath) {
        router.push(tourSteps[nextStep].targetPath);
      }
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      if (pathname !== tourSteps[prevStep].targetPath) {
        router.push(tourSteps[prevStep].targetPath);
      }
    }
  };

  const handleComplete = () => {
    localStorage.setItem("eve_tour_completed", "true");
    setActive(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] w-full max-w-md p-1 animate-fade-in">
      <div className="bg-card dark:bg-background backdrop-blur-lg border border-border rounded-2xl shadow-2xl p-6 text-foreground flex flex-col space-y-4 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
              <Sparkles size={16} />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">EVE Platform Tour</span>
          </div>
          <button
            onClick={handleComplete}
            className="text-muted-foreground hover:text-muted-foreground rounded-lg p-1 hover:bg-secondary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-foreground rounded-xl">
              <Icon size={20} />
            </div>
            <h3 className="text-base font-bold text-foreground">{step.title}</h3>
          </div>
          
          <p className="text-muted-foreground text-xs leading-relaxed">
            {step.explanation}
          </p>

          <ul className="space-y-2 pt-2 border-t border-border">
            {step.bullets.map((b, i) => {
              const parts = b.split(":");
              const label = parts[0];
              const desc = parts.slice(1).join(":");
              return (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <span className="text-indigo-400 font-bold mt-0.5">&bull;</span>
                  <span className="text-muted-foreground">
                    <strong className="text-foreground">{label}:</strong>{desc}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Progress and Footer Nav */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          {/* Progress dots */}
          <div className="flex gap-1.5">
            {tourSteps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === currentStep ? "w-6 bg-indigo-500" : "w-1.5 bg-secondary"
                }`}
              />
            ))}
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleComplete}
              className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              Skip
            </button>
            
            {currentStep > 0 && (
              <button
                onClick={handleBack}
                className="p-1.5 bg-secondary hover:bg-secondary text-foreground rounded-lg transition-all cursor-pointer"
                title="Previous step"
              >
                <ChevronLeft size={16} />
              </button>
            )}
            
            <button
              onClick={handleNext}
              className="flex items-center gap-1 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-foreground rounded-lg text-xs font-semibold transition-all cursor-pointer"
            >
              {currentStep === tourSteps.length - 1 ? "Finish" : "Next"}
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
