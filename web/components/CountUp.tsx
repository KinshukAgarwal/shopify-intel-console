'use client';

import { animate, useInView } from 'motion/react';
import { useCallback, useEffect, useRef } from 'react';

interface CountUpProps {
  to: number;
  from?: number;
  direction?: 'up' | 'down';
  delay?: number;
  duration?: number;
  className?: string;
  startWhen?: boolean;
  separator?: string;
  onStart?: () => void;
  onEnd?: () => void;
}

/**
 * React Bits' count-up, with its spring swapped for a tween.
 *
 * The upstream component derives `damping`/`stiffness` from `duration`, and at
 * the durations this console uses the result is so overdamped that the number
 * is still a few percent of its target seconds after the animation is nominally
 * over — a KPI reading 13 when the answer is 400. A tween reaches the value in
 * exactly `duration`, which is what the prop already promised.
 */
export default function CountUp({
  to,
  from = 0,
  direction = 'up',
  delay = 0,
  duration = 2,
  className = '',
  startWhen = true,
  separator = '',
  onStart,
  onEnd
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '0px' });

  const start = direction === 'down' ? to : from;
  const end = direction === 'down' ? from : to;

  const decimals = (value: number) => {
    const [, fraction] = value.toString().split('.');
    return fraction && parseInt(fraction, 10) !== 0 ? fraction.length : 0;
  };
  const maxDecimals = Math.max(decimals(from), decimals(to));

  const formatValue = useCallback(
    (latest: number) => {
      const formatted = Intl.NumberFormat('en-US', {
        useGrouping: !!separator,
        minimumFractionDigits: maxDecimals,
        maximumFractionDigits: maxDecimals
      }).format(latest);
      return separator ? formatted.replace(/,/g, separator) : formatted;
    },
    [maxDecimals, separator]
  );

  useEffect(() => {
    if (ref.current) ref.current.textContent = formatValue(start);
  }, [formatValue, start]);

  useEffect(() => {
    if (!isInView || !startWhen) return;
    onStart?.();
    const controls = animate(start, end, {
      duration,
      delay,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => {
        if (ref.current) ref.current.textContent = formatValue(latest);
      },
      onComplete: () => onEnd?.()
    });
    return () => controls.stop();
    // onStart/onEnd are not deps: neither caller memoises them, and including
    // them would restart the animation on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInView, startWhen, start, end, duration, delay, formatValue]);

  return <span className={className} ref={ref} />;
}
