import { useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { AuthPalette as Palette } from '@/constants/auth-palette';

// openAuthSessionAsync (payment.tsx) normally intercepts PayU's
// redirect before it ever reaches here, closing the in-app browser and
// resuming the still-mounted payment screen directly. This route only
// exists as the fallback for when that interception doesn't happen —
// the OS opens this deep link as a fresh app launch/foreground event
// instead — so there's still somewhere for the user to land other than
// an unmatched-route screen. payment.tsx re-derives the real
// payment_status from the database itself; nothing here is trusted.
export default function PaymentCallbackScreen() {
  const router = useRouter();
  const { slotId } = useLocalSearchParams<{ slotId: string }>();

  useEffect(() => {
    router.replace({
      pathname: '/payment' as any,
      params: { slotId },
    });
  }, [router, slotId]);

  return (
    <View style={{ flex: 1, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={Palette.text} />
    </View>
  );
}
