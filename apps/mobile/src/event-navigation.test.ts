import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from '@dayline/domain';
import { clearSystemHandles, resolveEvent, retainEvent } from './event-navigation';

describe('private event routes', () => {
  it('keeps event identifiers and details out of route tokens, and clears system handles on revoke', () => {
    const system: CalendarEvent = {
      id: 'private-source-id',
      externalId: 'external',
      providerId: 'apple-system',
      calendarId: 'private-calendar',
      title: 'Private appointment',
      description: 'Private notes',
      start: '2026-09-08',
      end: '2026-09-09',
      allDay: true,
      timezone: null,
      location: null,
      url: null,
      recurring: false,
      originalStart: null,
      status: null,
    };
    const token = retainEvent(system);
    const localToken = retainEvent({ ...system, providerId: 'dayline-local', id: 'local-id' });
    expect(token).not.toContain(system.id);
    expect(token).not.toContain(system.title);
    expect(resolveEvent(token)).toEqual({ id: system.id, providerId: 'apple-system' });
    clearSystemHandles();
    expect(resolveEvent(token)).toBeUndefined();
    expect(resolveEvent(localToken)?.id).toBe('local-id');
  });
});
