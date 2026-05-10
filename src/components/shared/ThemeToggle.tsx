import { Monitor, Moon, Sun } from "lucide-react";
import type { Settings } from "@/types";
import { useSettingsStore } from "@/store/settingsStore";

const THEME_OPTIONS: Array<{
  value: Settings["theme"];
  label: string;
  icon: typeof Sun;
}> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

interface Props {
  compact?: boolean;
}

export default function ThemeToggle({ compact = false }: Props) {
  const theme = useSettingsStore((state) => state.settings.theme);
  const updateSettings = useSettingsStore((state) => state.updateSettings);

  return (
    <div
      className="theme-toggle"
      data-compact={compact || undefined}
      role="group"
      aria-label="Theme"
    >
      {THEME_OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            data-active={active || undefined}
            onClick={() => updateSettings({ theme: option.value })}
            aria-pressed={active}
            title={`${option.label} theme`}
          >
            <Icon size={compact ? 14 : 15} />
            {!compact ? <span>{option.label}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
