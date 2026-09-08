import { useColorScheme } from 'react-native';

const light = {
  background: '#F7F7FB',
  surface: '#FFFFFF',
  text: '#202033',
  muted: '#626277',
  border: '#DFDFEA',
  accent: '#4E46BD',
  accentSoft: '#EBE9FC',
  onAccent: '#FFFFFF',
  danger: '#AE253D',
  today: '#B13E18',
  todaySoft: '#FFF0E8',
  line: '#EEEEF4',
};
const dark: typeof light = {
  background: '#14141D',
  surface: '#1E1E2B',
  text: '#F3F2FA',
  muted: '#B2B0C6',
  border: '#3C3B50',
  accent: '#B9AEFF',
  accentSoft: '#34304F',
  onAccent: '#20183F',
  danger: '#FF9DAF',
  today: '#FFAA80',
  todaySoft: '#3F2922',
  line: '#2B2A3C',
};
export function useTheme() {
  return useColorScheme() === 'dark' ? dark : light;
}
