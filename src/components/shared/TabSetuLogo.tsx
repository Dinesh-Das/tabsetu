import type { CSSProperties, ImgHTMLAttributes } from "react";

export const TABSETU_LOGO_SRC = "/icons/tabsetu.png";

interface TabSetuLogoProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "alt" | "src"> {
  decorative?: boolean;
  label?: string;
  size?: number;
}

export function TabSetuLogo({
  className = "",
  decorative = false,
  label = "TabSetu",
  size,
  style,
  ...imageProps
}: TabSetuLogoProps) {
  const resolvedStyle: CSSProperties | undefined = size
    ? { ...style, width: size, height: size }
    : style;

  return (
    <img
      {...imageProps}
      alt={decorative ? "" : label}
      aria-hidden={decorative || undefined}
      className={["tabsetu-logo", className].filter(Boolean).join(" ")}
      draggable={false}
      src={TABSETU_LOGO_SRC}
      style={resolvedStyle}
    />
  );
}
