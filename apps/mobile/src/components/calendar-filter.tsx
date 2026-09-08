import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Calendar } from '@dayline/domain';
import { usePreferences } from '../preferences';
import { persistPreferences } from '../database';
import { useTheme } from '../theme';
import { Body, Button } from './ui';

export function CalendarFilter({
  visible,
  onClose,
  calendars,
}: {
  visible: boolean;
  onClose(): void;
  calendars: Calendar[];
}) {
  const theme = useTheme();
  const { hiddenCalendars, update } = usePreferences();
  return (
    <Modal
      visible={visible}
      onRequestClose={onClose}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View
          style={{
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text
            accessibilityRole="header"
            style={{ fontSize: 24, color: theme.text, fontWeight: '700' }}
          >
            Calendars
          </Text>
          <Button label="Done" onPress={onClose} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <Body>
            Choose the calendars shown in every view. Your selection is saved on this device.
          </Body>
          {calendars.map((calendar) => {
            const checked = !hiddenCalendars.includes(calendar.id);
            return (
              <Pressable
                key={calendar.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                accessibilityLabel={`${calendar.title}, ${calendar.source}`}
                onPress={() => {
                  update({
                    hiddenCalendars: checked
                      ? [...hiddenCalendars, calendar.id]
                      : hiddenCalendars.filter((id) => id !== calendar.id),
                  });
                  void persistPreferences();
                }}
                style={{
                  padding: 16,
                  borderRadius: 14,
                  backgroundColor: theme.surface,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <View
                  style={{
                    height: 14,
                    width: 14,
                    borderRadius: 7,
                    backgroundColor: calendar.color,
                  }}
                />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ color: theme.text, fontSize: 17, fontWeight: '600' }}>
                    {calendar.title}
                  </Text>
                  <Body>{calendar.source}</Body>
                </View>
                <Text style={{ color: theme.accent, fontSize: 22 }}>{checked ? '✓' : '○'}</Text>
              </Pressable>
            );
          })}
          <Button
            label="Show all calendars"
            onPress={() => {
              update({ hiddenCalendars: [] });
              void persistPreferences();
            }}
          />
          <Body>
            Dayline is read-only in this milestone, including “On this device.” Create and edit
            events in Apple Calendar, then refresh here.
          </Body>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
