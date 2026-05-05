import { afterEach, describe, expect, it, vi } from "vitest";
import { applyTheme, subscribeToSystemTheme } from "@/lib/theme";

function installThemeDom(prefersDark: boolean): {
  documentElement: { className: string };
  emitSystemChange: () => void;
  getListener: () => EventListenerOrEventListenerObject | null;
} {
  const documentElement = { className: "" };
  let listener: EventListenerOrEventListenerObject | null = null;
  const mediaQueryList = {
    matches: prefersDark,
    addEventListener: (_type: string, handler: EventListenerOrEventListenerObject): void => {
      listener = handler;
    },
    removeEventListener: (_type: string, handler: EventListenerOrEventListenerObject): void => {
      if (listener === handler) {
        listener = null;
      }
    },
  } as MediaQueryList;

  vi.stubGlobal("document", { documentElement });
  vi.stubGlobal("window", {
    matchMedia: vi.fn<(query: string) => MediaQueryList>(() => mediaQueryList),
  });

  return {
    documentElement,
    emitSystemChange: () => {
      if (typeof listener === "function") {
        listener(new Event("change"));
      }
    },
    getListener: () => listener,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("theme helpers", () => {
  it("applies an explicit dark theme", () => {
    const { documentElement } = installThemeDom(false);

    applyTheme("dark");

    expect(documentElement.className).toBe("dark");
  });

  it("resolves the system theme from matchMedia", () => {
    const { documentElement } = installThemeDom(true);

    applyTheme("system");

    expect(documentElement.className).toBe("dark");
  });

  it("subscribes and unsubscribes only while system theme is active", () => {
    const { emitSystemChange, getListener } = installThemeDom(false);
    const onChange = vi.fn<() => void>();

    const unsubscribe = subscribeToSystemTheme("system", onChange);
    expect(getListener()).not.toBeNull();

    emitSystemChange();
    expect(onChange).toHaveBeenCalledTimes(1);

    unsubscribe();
    expect(getListener()).toBeNull();
  });

  it("does not subscribe for explicit themes", () => {
    const { getListener } = installThemeDom(false);

    const unsubscribe = subscribeToSystemTheme("light", vi.fn<() => void>());
    unsubscribe();

    expect(getListener()).toBeNull();
  });
});
