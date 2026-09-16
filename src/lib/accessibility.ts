export interface AccessibilityPreferences {
  largeText: boolean;
  highContrast: boolean;
  reduceMotion: boolean;
}

const KEY = 'blue-stage-accessibility-v1';
export const DEFAULT_ACCESSIBILITY: AccessibilityPreferences = {
  largeText: false,
  highContrast: false,
  reduceMotion: false
};

export function readAccessibility(): AccessibilityPreferences {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_ACCESSIBILITY;
    return { ...DEFAULT_ACCESSIBILITY, ...JSON.parse(raw) as Partial<AccessibilityPreferences> };
  } catch {
    return DEFAULT_ACCESSIBILITY;
  }
}

export function applyAccessibility(preferences: AccessibilityPreferences): void {
  const root = document.documentElement;
  root.dataset.largeText = preferences.largeText ? 'true' : 'false';
  root.dataset.highContrast = preferences.highContrast ? 'true' : 'false';
  root.dataset.reduceMotion = preferences.reduceMotion ? 'true' : 'false';
}

export function saveAccessibility(preferences: AccessibilityPreferences): void {
  try { localStorage.setItem(KEY, JSON.stringify(preferences)); } catch { /* optional local preference */ }
  applyAccessibility(preferences);
}

export function applySavedAccessibility(): void {
  applyAccessibility(readAccessibility());
}
