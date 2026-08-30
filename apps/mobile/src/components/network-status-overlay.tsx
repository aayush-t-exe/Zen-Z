import { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';
import * as Network from 'expo-network';
import { AuthPalette as Palette } from '@/constants/auth-palette';
import { FontFamily } from '@/constants/fonts';

// A Wi-Fi-to-cellular handoff or a momentary blip shouldn't flash this
// dialog — only show it once the device has genuinely stayed offline for a
// beat, and only ever set it via the effect below (never straight from the
// hook's value) so a same-tick recovery cancels the pending timer instead
// of blinking the dialog open and shut.
const OFFLINE_DEBOUNCE_MS = 1500;

/**
 * App-wide offline notice — mounted once at the root so it appears over
 * whatever screen is up, in the app's own charcoal/cream art direction
 * rather than the unstyleable native Alert.
 */
export function NetworkStatusOverlay() {
  const networkState = Network.useNetworkState();
  const [visible, setVisible] = useState(false);

  // isConnected / isInternetReachable start out `undefined` until the OS
  // reports in — treating that as "online" avoids flashing this on cold
  // start before the first reading arrives.
  const isOffline = networkState.isConnected === false || networkState.isInternetReachable === false;

  useEffect(() => {
    if (isOffline) {
      const timer = setTimeout(() => setVisible(true), OFFLINE_DEBOUNCE_MS);
      return () => clearTimeout(timer);
    }
    // Hides immediately once the network hook reports back online — this
    // fires from that external update, not from `visible` driving its own
    // effect, so it isn't the cascading-render loop the lint rule guards
    // against (see the same reasoning in payment.tsx's fetchBooking effect).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(false);
  }, [isOffline]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      // Nothing meaningful to do while offline other than wait it out — the
      // Android back button shouldn't dismiss this onto a screen that can't
      // load anyway.
      onRequestClose={() => {}}>
      <View style={styles.scrim}>
        <View style={styles.card}>
          <Text style={styles.title}>The thread&rsquo;s gone quiet.</Text>
          <Text style={styles.body}>
            Check your connection — everything picks back up the moment you&rsquo;re online.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: Palette.paper,
    borderRadius: 28,
    borderWidth: 2.5,
    borderColor: Palette.ring,
    paddingVertical: 32,
    paddingHorizontal: 26,
    alignItems: 'center',
    gap: 10,
  },
  title: {
    color: Palette.line,
    fontSize: 21,
    fontWeight: '700',
    fontFamily: FontFamily.display.bold,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  body: {
    color: Palette.fieldInk,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: FontFamily.body.regular,
    textAlign: 'center',
  },
});
