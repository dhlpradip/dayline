import { describe, expect, it } from 'vitest';
import { decodePreferences, defaultPreferences } from './preferences';

describe('persisted preferences', () => {
  it('round trips view, flexible day count and hidden calendar IDs', () => {
    const value = {
      view: 'week',
      dayCount: 14,
      hiddenCalendars: ['apple-system:work', 'dayline-local:default'],
    };
    expect(decodePreferences(JSON.stringify(value))).toEqual(value);
  });
  it('recovers corrupt, absent and invalid settings', () => {
    expect(decodePreferences(undefined)).toEqual(defaultPreferences);
    expect(decodePreferences('broken json')).toEqual(defaultPreferences);
    expect(decodePreferences('null')).toEqual(defaultPreferences);
    expect(
      decodePreferences('{"view":"tasks","dayCount":50,"hiddenCalendars":[1,"a","a"]}'),
    ).toEqual({ view: 'month', dayCount: 14, hiddenCalendars: ['a'] });
    expect(decodePreferences('{"dayCount":0}').dayCount).toBe(1);
    expect(decodePreferences('{"dayCount":1.5}').dayCount).toBe(7);
  });
});
