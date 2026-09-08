import type { CalendarEvent } from '@dayline/domain';

// Route params contain only an opaque session handle, never titles, notes, locations or event IDs.
const handles = new Map<string, Pick<CalendarEvent, 'id' | 'providerId'>>();
let counter = 0;
export function retainEvent(event: CalendarEvent): string {
  const token = `${Date.now().toString(36)}-${(++counter).toString(36)}-${Math.random().toString(36).slice(2)}`;
  if (handles.size >= 100) handles.delete(handles.keys().next().value!);
  handles.set(token, { id: event.id, providerId: event.providerId });
  return token;
}
export function resolveEvent(token: string) {
  return handles.get(token);
}
export function clearSystemHandles() {
  for (const [token, handle] of handles)
    if (handle.providerId === 'apple-system') handles.delete(token);
}
