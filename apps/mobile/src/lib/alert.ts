import { Alert, Platform, type AlertButton } from 'react-native';

/**
 * Drop-in replacement for Alert.alert that also works on web.
 *
 * react-native-web's Alert.alert is an empty function, so on the web build
 * (what iPhone students use) every error message silently vanished, and any
 * action that only ran inside an Alert button's onPress (leave group, delete
 * message) did nothing at all. On web this falls back to the browser's own
 * dialogs: window.confirm when there's a cancel + action pair, window.alert
 * otherwise, then runs the chosen button's onPress exactly as native would.
 */
export function showAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }

  const text = message ? `${title}\n\n${message}` : title;
  const cancelButton = buttons?.find((b) => b.style === 'cancel');
  const actionButton = buttons?.find((b) => b.style !== 'cancel');

  if (cancelButton && actionButton) {
    if (window.confirm(text)) {
      actionButton.onPress?.();
    } else {
      cancelButton.onPress?.();
    }
    return;
  }

  window.alert(text);
  (actionButton ?? cancelButton)?.onPress?.();
}
