import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/theme';
import { FontFamily } from '@/constants/fonts';

const DISMISSED_KEY = 'zenz.dismissedAddToHomeScreenBanner';

const WEB_APP_URL = 'https://zen-z-app.vercel.app';
// Hands the OS the URL to reopen in Safari proper. See the twin of this in
// apps/marketing/app/get-app/route.ts for why the scheme is used and why
// nothing depends on it working.
const SAFARI_URL = WEB_APP_URL.replace(/^https:\/\//, 'x-safari-https://');

// Kept in step with IOS_CANNOT_INSTALL in apps/marketing/app/get-app/route.ts.
// Add to Home Screen is Safari's Share sheet and nobody else's, so in any of
// these the steps below would send someone looking for a menu item that isn't
// there. Brave can't be on this list: its iOS User-Agent is deliberately
// identical to Safari's, so it reads as Safari here and gets the Safari copy.
const CANNOT_INSTALL =
  /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|DuckDuckGo|GSA\/|FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Line\/|Snapchat|LinkedInApp|MicroMessenger|Twitter/i;

// Safari-only, non-standard — not in the DOM lib's Navigator type.
type SafariNavigator = Navigator & { standalone?: boolean };

type InstallHint = 'none' | 'share-sheet' | 'open-in-safari';

function installHint(): InstallHint {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') {
    return 'none';
  }
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = (navigator as SafariNavigator).standalone === true;
  if (!isIOS || isStandalone) {
    return 'none';
  }
  return CANNOT_INSTALL.test(navigator.userAgent) ? 'open-in-safari' : 'share-sheet';
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
  const [hint, setHint] = useState<InstallHint>('none');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const detected = installHint();
    if (detected === 'none') {
      return;
    }
    setHint(detected);
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

  // Assigning location rather than opening a window: an in-app web view
  // blocks the popup, and the scheme hand-off has to look like a navigation
  // for the OS to pick it up.
  const openInSafari = () => {
    if (typeof window !== 'undefined') {
      window.location.href = SAFARI_URL;
    }
  };

  return (
    <View style={[styles.banner, { paddingTop: Math.max(10, insets.top) }]} pointerEvents="box-none">
      {hint === 'open-in-safari' ? (
        <Pressable onPress={openInSafari} style={styles.action}>
          <Text style={styles.text}>
            This browser can&apos;t add Zen-Z to your Home Screen.{' '}
            <Text style={styles.bold}>Open in Safari</Text> to install it.
          </Text>
        </Pressable>
      ) : (
        <Text style={styles.text}>
          Tap <Text style={styles.bold}>Share</Text> ↑ then{' '}
          <Text style={styles.bold}>Add to Home Screen</Text> for the full app.
        </Text>
      )}
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
  action: {
    flex: 1,
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
