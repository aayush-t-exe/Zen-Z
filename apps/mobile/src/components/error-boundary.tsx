import { Component, ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { AuthPalette as Palette } from '@/constants/auth-palette';
import { FontFamily } from '@/constants/fonts';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// App-wide render-crash catch, mounted once at the root (see _layout.tsx).
// Without this, any render-time exception (a null field, an unexpected API
// shape) white-screens the entire app with no recovery — "Try again" resets
// this boundary's subtree, which is enough for the common case (a bad value
// on one screen) since Expo Router remounts the current route underneath it.
// Styled like NetworkStatusOverlay (AuthPalette, not theme.ts) — same
// precedent: an emergency, session-agnostic overlay that has to render
// correctly whether the crash happened signed-in or signed-out.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error('Unhandled render error:', error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.scrim}>
          <View style={styles.card}>
            <Text style={styles.title}>Something went off script.</Text>
            <Text style={styles.body}>
              That wasn&rsquo;t supposed to happen. Give it another try.
            </Text>
            <Pressable style={styles.button} onPress={this.handleRetry}>
              <Text style={styles.buttonLabel}>Try again</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: Palette.canvas,
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
    gap: 14,
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
  button: {
    marginTop: 4,
    backgroundColor: Palette.line,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  buttonLabel: {
    color: Palette.paper,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FontFamily.body.semiBold,
  },
});
