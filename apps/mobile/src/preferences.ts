import { create } from 'zustand';

export type CalendarView = 'month' | 'week' | 'day' | 'agenda' | 'year';
export interface Preferences {
  view: CalendarView;
  dayCount: number;
  hiddenCalendars: string[];
}
export const defaultPreferences: Preferences = { view: 'month', dayCount: 7, hiddenCalendars: [] };
export const views: CalendarView[] = ['month', 'week', 'day', 'agenda', 'year'];

export function decodePreferences(value: string | undefined): Preferences {
  try {
    const parsed: unknown = JSON.parse(value ?? '{}');
    if (!parsed || typeof parsed !== 'object') return defaultPreferences;
    const item = parsed as Record<string, unknown>;
    return {
      view: views.includes(item.view as CalendarView) ? (item.view as CalendarView) : 'month',
      dayCount:
        typeof item.dayCount === 'number' && Number.isInteger(item.dayCount)
          ? Math.min(14, Math.max(1, item.dayCount))
          : 7,
      hiddenCalendars: Array.isArray(item.hiddenCalendars)
        ? [...new Set(item.hiddenCalendars.filter((id): id is string => typeof id === 'string'))]
        : [],
    };
  } catch {
    return defaultPreferences;
  }
}

interface PreferenceState extends Preferences {
  hydrated: boolean;
  saveError: boolean;
  hydrate(preferences: Preferences): void;
  update(preferences: Partial<Preferences>): void;
  markSaveError(failed: boolean): void;
}
export const usePreferences = create<PreferenceState>((set) => ({
  ...defaultPreferences,
  hydrated: false,
  saveError: false,
  hydrate: (preferences) => set({ ...preferences, hydrated: true }),
  update: (preferences) => set(preferences),
  markSaveError: (saveError) => set({ saveError }),
}));

export function preferenceSnapshot(): Preferences {
  const { view, dayCount, hiddenCalendars } = usePreferences.getState();
  return { view, dayCount, hiddenCalendars };
}
