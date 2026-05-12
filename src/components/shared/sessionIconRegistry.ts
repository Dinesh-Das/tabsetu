import {
  BookOpen,
  Briefcase,
  FlaskConical,
  Folder,
  Home,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { toLucideExportName } from "@/lib/sessionLabels";

const SESSION_ICON_REGISTRY: Record<string, LucideIcon> = {
  "book-open": BookOpen,
  BookOpen,
  briefcase: Briefcase,
  Briefcase,
  "flask-conical": FlaskConical,
  FlaskConical,
  folder: Folder,
  Folder,
  home: Home,
  Home,
  sparkles: Sparkles,
  Sparkles,
};

export function getSessionIcon(icon: string | null): LucideIcon | null {
  const trimmed = icon?.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.toLowerCase().replace(/[_\s]+/g, "-");
  return (
    SESSION_ICON_REGISTRY[normalized] ?? SESSION_ICON_REGISTRY[toLucideExportName(trimmed)] ?? null
  );
}
