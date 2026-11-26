export function triggerHaptic(pattern: number | number[] = 8): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore in unsupported browsers or restricted contexts
    }
  }
}

export const SPRING_SNAPPY = {
  type: 'spring' as const,
  stiffness: 460,
  damping: 32,
  mass: 0.8,
};

export const SPRING_GENTLE = {
  type: 'spring' as const,
  stiffness: 280,
  damping: 26,
};

