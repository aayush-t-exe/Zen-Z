import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/theme';
import { FontFamily } from '@/constants/fonts';

const DISMISSED_KEY = 'zenz.dismissedAddToHomeScreenBanner';

// Safari-only, non-standard — not in the DOM lib's Navigator type.
type SafariNavigator = Navigator & { standalone?: boolean };

function shouldOfferInstall(): boolean {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') {
    return false;
  }
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = (navigator as SafariNavigator).standalone === true;
  return isIOS && !isStandalone;
}

/**
 * App-wide nudge for iOS visitors reaching the web build directly (a shared
 * link, a bookmark, browser history) rather than through the JNU poster's QR
 * code, which already routes through zen-z.site/get-app's own instructions
 * page first. Safari has no install prompt to hook like Chrome's
 * `beforeinstallprompt` — Add to Home Screen only lives in the manual Share
 * sheet — so this is pointing at it, not triggering it.
 */
export function AddToHomeScreenBanner() {
  const [visible, setVisible] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!shouldOfferInstall()) {
      return;
    }
    let cancelled = false;
    AsyncStorage.getItem(DISMISSED_KEY)
      .then((dismissed) => {
        if (!cancelled && dismissed !== '1') {
          setVisible(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setVisible(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) {
    return null;
  }

  const dismiss = () => {
    setVisible(false);
    AsyncStorage.setItem(DISMISSED_KEY, '1').catch(() => {});
  };

  return (
    <View style={[styles.banner, { paddingTop: Math.max(10, insets.top) }]} pointerEvents="box-none">
      <Text style={styles.text}>
        Tap <Text style={styles.bold}>Share</Text> ↑ then{' '}
        <Text style={styles.bold}>Add to Home Screen</Text> for the full app.
      </Text>
      <Pressable onPress={dismiss} hitSlop={12} style={styles.dismiss}>
        <Text style={styles.dismissLabel}>×</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.dark.backgroundElement,
    paddingBottom: 10,
    paddingLeft: 16,
    paddingRight: 12,
    zIndex: 50,
  },
  text: {
    flex: 1,
    color: Colors.dark.text,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FontFamily.body.regular,
  },
  bold: {
    fontFamily: FontFamily.body.semiBold,
  },
  dismiss: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 18,
    lineHeight: 18,
  },
});
