import { ColorValue } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface TabBarIconProps {
  name: React.ComponentProps<typeof Feather>['name'];
  color: ColorValue;
  size?: number;
}

export function TabBarIcon({ name, color, size = 24 }: TabBarIconProps) {
  return <Feather name={name} size={size} color={color as string} />;
}
