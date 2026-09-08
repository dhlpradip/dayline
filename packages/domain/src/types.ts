export type ProviderId = 'apple-system' | 'dayline-local';
export interface DateRange {
  start: Date;
  end: Date;
}
export interface Calendar {
  id: string;
  externalId: string;
  providerId: ProviderId;
  title: string;
  color: string;
  source: string;
  readOnly: boolean;
  allowsModifications: boolean;
}
export interface CalendarEvent {
  id: string;
  externalId: string;
  providerId: ProviderId;
  calendarId: string;
  title: string;
  description: string | null;
  /** ISO instant for timed events; YYYY-MM-DD civil date for all-day events. */
  start: string;
  /** Exclusive boundary, including for all-day events. */
  end: string;
  allDay: boolean;
  timezone: string | null;
  location: string | null;
  url: string | null;
  recurring: boolean;
  originalStart: string | null;
  status: string | null;
}
export interface CalendarProviderCapabilities {
  read: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
  recurrence: boolean;
}
export interface CalendarProvider {
  readonly id: ProviderId;
  capabilities(): CalendarProviderCapabilities;
  getCalendars(): Promise<Calendar[]>;
  getEvents(range: DateRange, calendarIds: string[]): Promise<CalendarEvent[]>;
  getEvent(id: string): Promise<CalendarEvent | null>;
}
