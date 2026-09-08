import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppleCalendarProvider, type Access } from './apple-provider';
import { clearSystemHandles } from './event-navigation';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, gcTime: 5 * 60_000, retry: false } },
});
const apple = new AppleCalendarProvider();
interface CalendarContextValue {
  access: Access;
  epoch: number;
  apple: AppleCalendarProvider;
  checkAccess(request?: boolean): Promise<void>;
  refresh(): Promise<void>;
}
const CalendarContext = createContext<CalendarContextValue | null>(null);
export function CalendarServices({ children }: { children: ReactNode }) {
  const [access, setAccess] = useState<Access>('checking');
  const [epoch, setEpoch] = useState(0);
  const sequence = useRef(0);
  const mounted = useRef(false);
  const purge = useCallback(() => {
    apple.invalidate();
    queryClient.removeQueries({ queryKey: ['calendar-data', 'system'] });
    setEpoch((value) => value + 1);
  }, []);
  const checkAccess = useCallback(
    async (request = false) => {
      let current = ++sequence.current;
      setAccess('checking');
      purge();
      let result = await apple.access(request);
      if (!mounted.current) return;
      // The native permission sheet can trigger inactive/active callbacks before its promise settles.
      // Re-check once after that explicit request rather than letting an earlier foreground check win.
      if (request && current !== sequence.current && AppState.currentState === 'active') {
        current = ++sequence.current;
        result = await apple.access();
      }
      if (!mounted.current || current !== sequence.current) return;
      if (result !== 'granted') clearSystemHandles();
      setAccess(result);
    },
    [purge],
  );
  const refresh = useCallback(async () => {
    await checkAccess();
    await queryClient.invalidateQueries({ queryKey: ['calendar-data', 'local'] });
  }, [checkAccess]);
  useEffect(() => {
    mounted.current = true;
    void checkAccess();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
      else {
        sequence.current += 1;
        setAccess('checking');
        purge();
      }
    });
    return () => {
      mounted.current = false;
      subscription.remove();
      sequence.current += 1;
    };
  }, [checkAccess, purge, refresh]);
  return (
    <QueryClientProvider client={queryClient}>
      <CalendarContext.Provider value={{ access, epoch, apple, checkAccess, refresh }}>
        {children}
      </CalendarContext.Provider>
    </QueryClientProvider>
  );
}
export function useCalendarServices() {
  const context = useContext(CalendarContext);
  if (!context) throw new Error('Calendar services are not ready.');
  return context;
}
