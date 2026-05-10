import { Fragment } from "react";
import type { CSSProperties } from "react";
import type { HighlightRange } from "@/lib/fuzzySearch";

interface Props {
  text: string;
  ranges?: HighlightRange[] | undefined;
  style?: CSSProperties | undefined;
}

export default function HighlightedText({ text, ranges = [], style }: Props) {
  if (!ranges.length) {
    return <span style={style}>{text}</span>;
  }

  const segments: Array<{ text: string; highlighted: boolean }> = [];
  let cursor = 0;

  for (const range of ranges) {
    if (range.start > cursor) {
      segments.push({
        text: text.slice(cursor, range.start),
        highlighted: false,
      });
    }

    segments.push({
      text: text.slice(range.start, range.end + 1),
      highlighted: true,
    });
    cursor = range.end + 1;
  }

  if (cursor < text.length) {
    segments.push({
      text: text.slice(cursor),
      highlighted: false,
    });
  }

  return (
    <span style={style}>
      {segments.map((segment, index) => (
        <Fragment key={`${segment.text}-${index}`}>
          {segment.highlighted ? (
            <mark
              style={{
                background: "var(--color-accent-dim)",
                color: "var(--color-text-primary)",
                padding: 0,
                borderRadius: 3,
              }}
            >
              {segment.text}
            </mark>
          ) : (
            segment.text
          )}
        </Fragment>
      ))}
    </span>
  );
}
