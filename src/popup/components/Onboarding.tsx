import { useState } from "react";
import { ArrowRight, ListChecks, PackagePlus, Sparkles, X } from "lucide-react";
import { useSettingsStore } from "@/store/settingsStore";

const STEPS = [
  {
    title: "Capture the current window",
    body: "Use Quick Save or Select Tabs to turn today’s browser mess into a named session.",
    icon: PackagePlus,
  },
  {
    title: "Reopen the whole workflow",
    body: "Saved sessions appear on Home. Open every tab together, or jump into a single saved link.",
    icon: ListChecks,
  },
  {
    title: "Collapse without losing context",
    body: "Collapse saves the window and closes those tabs, with a short undo safety net if your finger slips.",
    icon: Sparkles,
  },
] as const;

export default function Onboarding() {
  const updateSettings = useSettingsStore((state) => state.updateSettings);
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const Icon = current.icon;
  const isLastStep = step === STEPS.length - 1;

  const finish = () => updateSettings({ hasCompletedOnboarding: true });

  return (
    <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-labelledby="tabsetu-onboarding-title">
      <section className="onboarding-card animate-scale-in">
        <button className="onboarding-close" type="button" onClick={finish} title="Dismiss onboarding">
          <X size={18} />
        </button>
        <div className="onboarding-icon">
          <Icon size={28} />
        </div>
        <p className="onboarding-kicker">Welcome to TabSetu</p>
        <h2 id="tabsetu-onboarding-title">{current.title}</h2>
        <p>{current.body}</p>
        <div className="onboarding-dots" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((item, index) => (
            <span key={item.title} data-active={index === step || undefined} />
          ))}
        </div>
        <div className="onboarding-actions">
          <button className="mobile-secondary-button" type="button" onClick={finish}>
            Don’t show again
          </button>
          <button
            className="mobile-primary-button"
            type="button"
            onClick={() => {
              if (isLastStep) {
                finish();
                return;
              }

              setStep((currentStep) => currentStep + 1);
            }}
          >
            {isLastStep ? "Start using TabSetu" : "Next"}
            <ArrowRight size={17} />
          </button>
        </div>
      </section>
    </div>
  );
}
