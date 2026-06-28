import * as React from "react";

import { useAppStore } from "../../stores/index.js";
import { COUNT_UP_DURATION_MS, countUpValue } from "../../features/ui/countUp.js";

const identity = (n: number) => String(n);

export interface AnimatedNumberProps {
  value: number;
  format?: (n: number) => string;
  durationMs?: number;
  className?: string;
}

export function AnimatedNumber({
  value,
  format = identity,
  durationMs = COUNT_UP_DURATION_MS,
  className,
}: AnimatedNumberProps) {
  const motionLevel = useAppStore((s: any) => s.settings?.ui?.motionLevel || "full");
  const target = Number(value) || 0;

  const prefersReduced =
    motionLevel === "off" ||
    motionLevel === "reduced" ||
    (typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true);

  const [display, setDisplay] = React.useState(target);

  React.useEffect(() => {
    if (prefersReduced || typeof requestAnimationFrame === "undefined") {
      setDisplay(target);
      return undefined;
    }

    let frame = 0;
    const start =
      typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      setDisplay(countUpValue(target, elapsed / durationMs));
      if (elapsed < durationMs) {
        frame = requestAnimationFrame(tick);
      } else {
        setDisplay(target);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, prefersReduced, durationMs]);

  return (
    <span className={className} aria-label={format(target)}>
      {format(display)}
    </span>
  );
}

export default AnimatedNumber;
