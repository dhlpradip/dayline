import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppleCalendarProvider, CalendarAccessError } from './apple-provider';
import { mapEvent, type NativeEvent } from './native-mapping';

const native = vi.hoisted(() => ({
  getCalendarPermissions: vi.fn(),
  requestCalendarPermissions: vi.fn(),
  getCalendars: vi.fn(),
  listEvents: vi.fn(),
  EntityTypes: { EVENT: 'event' },
}));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('expo-calendar', () => native);
const instance: NativeEvent = {
  id: 'series',
  calendarId: 'c',
  title: 'Occurrence',
  allDay: false,
  startDate: '2026-09-08T12:00:00Z',
  endDate: '2026-09-08T13:00:00Z',
  recurrenceRule: {},
};
beforeEach(() => {
  vi.resetAllMocks();
  native.getCalendarPermissions.mockResolvedValue({ granted: true, status: 'granted' });
  native.listEvents.mockResolvedValue([instance]);
  native.getCalendars.mockResolvedValue([]);
});
describe('Apple provider boundary', () => {
  it('uses SDK57 APIs with explicit event entity and Date boundaries', async () => {
    const provider = new AppleCalendarProvider();
    await provider.getCalendars();
    expect(native.getCalendars).toHaveBeenCalledWith('event');
    const range = { start: new Date('2026-09-08'), end: new Date('2026-09-09') };
    await provider.getEvents(range, ['apple-system:c', 'dayline-local:default']);
    expect(native.listEvents).toHaveBeenCalledWith(['c'], range.start, range.end);
    expect(native.getCalendarPermissions).toHaveBeenCalledWith(false);
    expect(native.requestCalendarPermissions).not.toHaveBeenCalled();
  });
  it('requests full access only when explicitly asked', async () => {
    native.requestCalendarPermissions.mockResolvedValue({ granted: true, status: 'granted' });
    await new AppleCalendarProvider().access(true);
    expect(native.requestCalendarPermissions).toHaveBeenCalledWith(false);
  });
  it('finds the exact recurring occurrence instead of substituting the series master', async () => {
    const other = {
      ...instance,
      startDate: '2026-09-09T12:00:00Z',
      endDate: '2026-09-09T13:00:00Z',
    };
    native.listEvents.mockResolvedValue([instance, other]);
    const result = await new AppleCalendarProvider().getEvent(mapEvent(other).id);
    expect(result?.start).toBe('2026-09-09T12:00:00.000Z');
    native.listEvents.mockResolvedValue([instance]);
    expect(await new AppleCalendarProvider().getEvent(mapEvent(other).id)).toBeNull();
  });
  it('rejects in-flight results after invalidation', async () => {
    const provider = new AppleCalendarProvider();
    let finish!: (events: NativeEvent[]) => void;
    native.listEvents.mockImplementation(
      () =>
        new Promise<NativeEvent[]>((resolve) => {
          finish = resolve;
        }),
    );
    const pending = provider.getEvents(
      { start: new Date('2026-09-08'), end: new Date('2026-09-09') },
      ['apple-system:c'],
    );
    const assertion = expect(pending).rejects.toBeInstanceOf(CalendarAccessError);
    await vi.waitFor(() => expect(native.listEvents).toHaveBeenCalled());
    provider.invalidate();
    finish([instance]);
    await assertion;
  });
  it('reports revocation even when the in-flight native operation rejects first', async () => {
    native.listEvents.mockImplementation(async () => {
      native.getCalendarPermissions.mockResolvedValue({ granted: false, status: 'denied' });
      throw new Error('Native calendar operation failed');
    });
    await expect(
      new AppleCalendarProvider().getEvents(
        { start: new Date('2026-09-08'), end: new Date('2026-09-09') },
        ['apple-system:c'],
      ),
    ).rejects.toBeInstanceOf(CalendarAccessError);
  });
  it('rejects revoked access and avoids querying all calendars for an empty filter', async () => {
    const provider = new AppleCalendarProvider();
    native.getCalendarPermissions.mockResolvedValue({ granted: false, status: 'denied' });
    await expect(provider.getCalendars()).rejects.toBeInstanceOf(CalendarAccessError);
    expect(native.getCalendars).not.toHaveBeenCalled();
    expect(await provider.getEvents({ start: new Date(), end: new Date() }, [])).toEqual([]);
    expect(native.listEvents).not.toHaveBeenCalled();
  });
});
