import { useEffect, useRef, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { useSettingsStore } from "@/store/settingsStore";

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const STEPS = [
  {
    target: "save-session",
    title: "Save your tabs",
    body: "Click Save to capture all your open tabs as a session. You can restore them anytime.",
    cta: "Got it",
  },
  {
    target: "session-list",
    title: "Your saved sessions",
    body: "Your saved sessions appear here. Click any session to restore its tabs instantly.",
    cta: "Next",
  },
  {
    target: "collapse-tabs",
    title: "Collapse to clear your mind",
    body: "Collapse saves and closes all tabs at once. Use it to reset your workspace.",
    cta: "Let's go",
  },
] as const;

function getSpotlightRect(target: string): SpotlightRect | null {
  const element = document.querySelector(`[data-onboarding-target="${target}"]`);
  if (!element) {
    return null;
  }

  const rect = element.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  };
}

export default function Onboarding() {
  const updateSettings = useSettingsStore((state) => state.updateSettings);
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLastStep = step === STEPS.length - 1;
  const spotlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let animationFrameId: number;
    let lastRectString = "";

    const updateSpotlight = (): void => {
      const rect = getSpotlightRect(current.target);
      const spotlight = spotlightRef.current;

      if (rect && spotlight) {
        const padding = 8;
        const top = Math.max(rect.top - padding, 8);
        const left = Math.max(rect.left - padding, 8);
        const width = rect.width + padding * 2;
        const height = rect.height + padding * 2;

        const newRectString = `${top},${left},${width},${height}`;
        if (newRectString !== lastRectString) {
          spotlight.style.top = `${top}px`;
          spotlight.style.left = `${left}px`;
          spotlight.style.width = `${width}px`;
          spotlight.style.height = `${height}px`;
          spotlight.style.opacity = "1";
          spotlight.style.transition =
            lastRectString === "" ? "none" : "all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)";
          lastRectString = newRectString;
        }
      } else if (spotlight) {
        spotlight.style.opacity = "0";
      }

      animationFrameId = requestAnimationFrame(updateSpotlight);
    };

    animationFrameId = requestAnimationFrame(updateSpotlight);
    return () => cancelAnimationFrame(animationFrameId);
  }, [current.target]);

  const finish = (): void => updateSettings({ hasCompletedOnboarding: true });

  const advance = (): void => {
    if (isLastStep) {
      finish();
      return;
    }

    setStep((currentStep) => currentStep + 1);
  };

  return (
    <div
      className="onboarding-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tabsetu-onboarding-title"
    >
      <div className="onboarding-backdrop" aria-hidden />
      <div ref={spotlightRef} className="onboarding-spotlight" style={{ opacity: 0 }} aria-hidden />
      <section className="onboarding-card animate-scale-in">
        <button
          className="onboarding-close"
          type="button"
          onClick={finish}
          title="Dismiss onboarding"
        >
          <X size={18} />
        </button>
        <p className="onboarding-kicker">
          Step {step + 1} of {STEPS.length}
        </p>
        <h2 id="tabsetu-onboarding-title">{current.title}</h2>
        <p>{current.body}</p>
        <div className="onboarding-dots" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((item, index) => (
            <span key={item.title} data-active={index === step || undefined} />
          ))}
        </div>
        <div className="onboarding-actions">
          <button className="mobile-secondary-button" type="button" onClick={finish}>
            Don't show again
          </button>
          <button className="mobile-primary-button" type="button" onClick={advance}>
            {current.cta}
            <ArrowRight size={17} />
          </button>
        </div>
      </section>
    </div>
  );
}
