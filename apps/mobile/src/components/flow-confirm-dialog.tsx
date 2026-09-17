import { Modal, View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';

import { AuthPalette as Palette } from '@/constants/auth-palette';
import { FLOW_CONTENT_MAX, FLOW_SIDE_PADDING, FlowSurface, FlowText } from '@/constants/flow-theme';
import { FlowPillButton } from './flow-pill-button';

/**
 * The redesign's own stand-in for `Alert.alert` on the two confirmations that
 * actually end a session or the account itself (Sign Out, Delete Account) —
 * the OS alert draws its own system font and colors, which broke the black
 * canvas / FlowText look everywhere else in the signed-in app.
 *
 * Same shape as edit-profile.tsx's own unsaved-changes card (overlay, card
 * fill/radius, title/message sizes, link-button spacing) rather than a new
 * one invented for this — that's the one other themed confirm dialog in the
 * app, so this reuses it instead of drifting.
 *
 * The safe choice gets the prominent cream pill and the destructive one is a
 * plain red text row underneath, the same weighting that card uses for
 * "Don't save" next to its "Keep editing" pill — a fat-finger tap lands on
 * "keep everything", not on the irreversible action.
 */
export function FlowConfirmDialog({
  visible,
  title,
  message,
  destructiveLabel,
  cancelLabel = 'Cancel',
  loading = false,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message: string;
  /** The irreversible action's label — rendered as the red text row, not the pill. */
  destructiveLabel: string;
  cancelLabel?: string;
  /** True while the destructive action is in flight; swaps its label and blocks both buttons. */
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = Math.min(FLOW_CONTENT_MAX, screenWidth - FLOW_SIDE_PADDING * 2);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={[styles.card, { width: cardWidth }]}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.actions}>
            <FlowPillButton
              label={cancelLabel}
              width={cardWidth - CARD_PADDING * 2}
              onPress={onCancel}
              disabled={loading}
            />
            <Pressable
              onPress={onConfirm}
              disabled={loading}
              accessibilityRole="button"
              accessibilityState={{ disabled: loading, busy: loading }}
              accessibilityLabel={destructiveLabel}
              style={styles.linkButton}
              hitSlop={8}>
              <Text style={[styles.destructiveLabel, loading && styles.destructiveLabelInert]}>
                {loading ? `${destructiveLabel}…` : destructiveLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const CARD_PADDING = 24;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: FLOW_SIDE_PADDING,
  },
  card: {
    backgroundColor: '#0A0A0A',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: FlowSurface.stroke,
    padding: CARD_PADDING,
  },
  title: {
    ...FlowText.titleCompact,
    fontSize: 20,
    lineHeight: 24,
    marginBottom: 10,
  },
  message: {
    ...FlowText.subtitle,
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    marginTop: 24,
    gap: 16,
  },
  linkButton: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  destructiveLabel: {
    color: Palette.error,
    fontSize: 15,
    fontFamily: FlowText.panelLabel.fontFamily,
  },
  destructiveLabelInert: {
    opacity: 0.5,
  },
});
