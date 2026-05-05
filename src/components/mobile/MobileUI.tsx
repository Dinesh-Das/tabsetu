import type { ReactNode } from "react";
import {
  Bell,
  ChevronLeft,
  X,
  CalendarDays,
  FileText,
  FolderOpen,
  Home,
  User,
} from "lucide-react";
import { TabSetuLogo } from "@/components/shared/TabSetuLogo";

export type MobileNavView = "home" | "folders" | "schedules" | "reminders" | "notes";

interface MobileFrameProps {
  children: ReactNode;
  className?: string;
}

export function MobileFrame({ children, className = "" }: MobileFrameProps) {
  return <div className={`mobile-frame ${className}`}>{children}</div>;
}

interface MobileTopBarProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  trailing?: ReactNode;
}

export function MobileTopBar({ title = "TabSetu", subtitle, showBack, onBack, trailing }: MobileTopBarProps) {
  return (
    <header className="mobile-topbar">
      <div className="mobile-topbar-side">
        {showBack ? (
          <button className="mobile-icon-button" type="button" onClick={onBack} title="Back">
            <ChevronLeft size={22} />
          </button>
        ) : (
          <div className="mobile-brand-mark">
            <TabSetuLogo className="mobile-brand-logo" decorative />
          </div>
        )}
      </div>
      <div className="mobile-topbar-title">
        <strong>{title}</strong>
        {subtitle ? <span>{subtitle}</span> : null}
      </div>
      <div className="mobile-topbar-side mobile-topbar-side-right">
        {trailing ?? (
          <button className="mobile-avatar" type="button" title="Account">
            <User size={18} />
          </button>
        )}
      </div>
    </header>
  );
}

interface MobileAppShellProps {
  activeView: MobileNavView;
  onViewChange: (view: MobileNavView) => void;
  title?: string;
  subtitle?: string;
  trailing?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function MobileAppShell({
  activeView,
  onViewChange,
  title,
  subtitle,
  trailing,
  className = "",
  children,
}: MobileAppShellProps) {
  return (
    <MobileFrame className={className}>
      <MobileTopBar title={title} subtitle={subtitle} trailing={trailing} />
      <main className="mobile-content">{children}</main>
      <BottomNav activeView={activeView} onViewChange={onViewChange} />
    </MobileFrame>
  );
}

interface BottomNavProps {
  activeView: MobileNavView;
  onViewChange: (view: MobileNavView) => void;
}

export function BottomNav({ activeView, onViewChange }: BottomNavProps) {
  const items: Array<{ view: MobileNavView; label: string; icon: typeof Home }> = [
    { view: "home", label: "Home", icon: Home },
    { view: "folders", label: "Folders", icon: FolderOpen },
    { view: "schedules", label: "Schedules", icon: CalendarDays },
    { view: "reminders", label: "Reminders", icon: Bell },
    { view: "notes", label: "Notes", icon: FileText },
  ];

  return (
    <nav className="mobile-bottom-nav" aria-label="Primary">
      {items.map(({ view, label, icon: Icon }) => {
        const active = activeView === view;
        return (
          <button
            key={view}
            className="mobile-bottom-nav-item"
            data-active={active}
            type="button"
            onClick={() => onViewChange(view)}
          >
            <Icon size={23} strokeWidth={active ? 2.7 : 2.2} />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function GlassCard({ children, className = "", onClick }: GlassCardProps) {
  if (onClick) {
    return (
      <button className={`mobile-card ${className}`} onClick={onClick} type="button">
        {children}
      </button>
    );
  }

  return (
    <div className={`mobile-card ${className}`}>
      {children}
    </div>
  );
}

interface MobileIconButtonProps {
  children: ReactNode;
  title: string;
  onClick?: () => void;
  danger?: boolean;
  active?: boolean;
  className?: string;
}

export function MobileIconButton({
  children,
  title,
  onClick,
  danger,
  active,
  className = "",
}: MobileIconButtonProps) {
  return (
    <button
      className={`mobile-icon-button ${className}`}
      data-danger={danger || undefined}
      data-active={active || undefined}
      type="button"
      title={title}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

interface SegmentedControlProps<T extends string> {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  return (
    <div className="mobile-segmented" role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          data-active={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({ icon, title, description, action, compact }: EmptyStateProps) {
  return (
    <div className="mobile-empty" data-compact={compact || undefined}>
      <div className="mobile-empty-icon">{icon}</div>
      <h2>{title}</h2>
      <p>{description}</p>
      {action ? <div className="mobile-empty-action">{action}</div> : null}
    </div>
  );
}

interface TabRowProps {
  title: string;
  subtitle: string;
  favIconUrl?: string | null;
  selected?: boolean;
  onSelect?: () => void;
  showCheckbox?: boolean;
  actions?: ReactNode;
  preview?: ReactNode;
}

export function TabRow({ title, subtitle, favIconUrl, selected, onSelect, showCheckbox = true, actions, preview }: TabRowProps) {
  return (
    <div className="mobile-tab-row" data-selected={selected || undefined} onClick={onSelect}>
      {onSelect && showCheckbox ? (
        <span className="mobile-checkbox" data-checked={selected || undefined} aria-hidden />
      ) : null}
      <div className="mobile-favicon">
        {favIconUrl ? <img src={favIconUrl} alt="" /> : <TabSetuLogo className="mobile-favicon-logo" decorative />}
      </div>
      {preview ? <div className="mobile-tab-preview">{preview}</div> : null}
      <div className="mobile-tab-copy">
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      {actions ? <div className="mobile-tab-actions">{actions}</div> : null}
    </div>
  );
}

interface BottomSheetProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function BottomSheet({ title, subtitle, onClose, children, footer }: BottomSheetProps) {
  return (
    <div className="mobile-sheet-overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <section className="mobile-bottom-sheet" role="dialog" aria-modal="true" aria-labelledby="mobile-sheet-title">
        <div className="mobile-sheet-handle" />
        <div className="mobile-sheet-header">
          <div>
            <h2 id="mobile-sheet-title">{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <MobileIconButton title="Close" onClick={onClose}>
            <X size={18} />
          </MobileIconButton>
        </div>
        <div className="mobile-sheet-body">{children}</div>
        {footer ? <div className="mobile-sheet-footer">{footer}</div> : null}
      </section>
    </div>
  );
}
