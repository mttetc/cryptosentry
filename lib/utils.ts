import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Calculate health score based on number of active alerts
 * @param alertCount Number of active alerts
 * @returns Health score between 0 and 100
 */
export function calculateHealthScore(alertCount: number): number {
  // Each alert reduces health by 10%
  return Math.max(0, 100 - (alertCount * 10));
}
