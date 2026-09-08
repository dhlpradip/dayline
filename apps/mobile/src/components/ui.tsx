import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';
import { useTheme } from '../theme';

export function Button({
  label,
  onPress,
  selected = false,
  disabled = false,
  accessibilityLabel,
  style,
}: {
  label: string;
  onPress(): void;
  selected?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 44,
          minWidth: 44,
          paddingHorizontal: 13,
          paddingVertical: 10,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 12,
          backgroundColor: selected ? theme.accentSoft : 'transparent',
          opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
        },
        style,
      ]}
    >
      <Text
        style={{ color: selected ? theme.accent : theme.text, fontWeight: '600', fontSize: 14 }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Notice({
  title,
  children,
  error = false,
}: {
  title: string;
  children?: ReactNode;
  error?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={{
        padding: 14,
        marginHorizontal: 16,
        marginVertical: 6,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: theme.border,
        backgroundColor: theme.surface,
        gap: 6,
      }}
    >
      <Text
        accessibilityRole={error ? 'alert' : 'header'}
        style={{ color: error ? theme.danger : theme.text, fontWeight: '600', fontSize: 15 }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}
export function Body({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <Text style={{ color: theme.muted, fontSize: 14, lineHeight: 21 }}>{children}</Text>;
}
