import { useEffect, useState } from 'react';
import { toLocalNum } from '@/shared/lib/utils/toLocalNum';
import { cn } from '@/shared/lib/utils/cn';

interface ScoreRingProps {
  /** Percentage 0–100. */
  percentage: number;
  /** Pass colours the ring green, otherwise red. */
  pass: boolean;
  className?: string;
}

const VIEWBOX = 120;
const STROKE = 8;
const RADIUS = (VIEWBOX - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Circular SVG progress ring. Animates the stroke from empty to the target
 * percentage on mount (1.2s ease). Sizing is driven by the parent via
 * `className` (the SVG scales to its box through the viewBox).
 */
export function ScoreRing({ percentage, pass, className }: ScoreRingProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(percentage)));
  const [offset, setOffset] = useState(CIRCUMFERENCE);
  const color = pass ? 'text-success-500' : 'text-danger-500';

  useEffect(() => {
    // Defer to the next frame so the transition runs from full → target.
    const id = requestAnimationFrame(() => {
      setOffset(CIRCUMFERENCE * (1 - clamped / 100));
    });
    return () => cancelAnimationFrame(id);
  }, [clamped]);

  return (
    <div className={cn('relative h-24 w-24 sm:h-[120px] sm:w-[120px]', className)}>
      <svg viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`} className="h-full w-full -rotate-90">
        <circle
          cx={VIEWBOX / 2}
          cy={VIEWBOX / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          className="stroke-gray-300"
        />
        <circle
          cx={VIEWBOX / 2}
          cy={VIEWBOX / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          stroke="currentColor"
          className={cn(color, 'transition-[stroke-dashoffset] duration-[1200ms] ease-[cubic-bezier(0.4,0,0.2,1)]')}
        />
      </svg>
      <span
        className={cn(
          'absolute inset-0 flex items-center justify-center text-[26px] font-extrabold sm:text-[30px]',
          color,
        )}
      >
        {toLocalNum(clamped)}٪
      </span>
    </div>
  );
}
