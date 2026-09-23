import { Alert, Platform } from 'react-native';
import { showAlert } from './alert';

describe('showAlert', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS });
    jest.restoreAllMocks();
  });

  function setOS(os: string) {
    Object.defineProperty(Platform, 'OS', { value: os });
  }

  it('delegates to Alert.alert on native, buttons untouched', () => {
    setOS('android');
    const spy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const buttons = [{ text: 'OK' }];
    showAlert('Title', 'Body', buttons);
    expect(spy).toHaveBeenCalledWith('Title', 'Body', buttons);
  });

  describe('on web', () => {
    beforeEach(() => {
      setOS('web');
      (globalThis as any).window = globalThis.window ?? {};
      (window as any).alert = jest.fn();
      (window as any).confirm = jest.fn();
    });

    it('shows an informational message with window.alert', () => {
      showAlert('Could not cancel', 'Network error');
      expect(window.alert).toHaveBeenCalledWith('Could not cancel\n\nNetwork error');
    });

    it('runs the action button when a cancel/action pair is confirmed', () => {
      (window.confirm as jest.Mock).mockReturnValue(true);
      const onLeave = jest.fn();
      const onCancel = jest.fn();
      showAlert('Leave this group?', 'Body', [
        { text: 'Cancel', style: 'cancel', onPress: onCancel },
        { text: 'Leave', style: 'destructive', onPress: onLeave },
      ]);
      expect(window.confirm).toHaveBeenCalledWith('Leave this group?\n\nBody');
      expect(onLeave).toHaveBeenCalledTimes(1);
      expect(onCancel).not.toHaveBeenCalled();
    });

    it('runs the cancel button, not the action, when the confirm is dismissed', () => {
      (window.confirm as jest.Mock).mockReturnValue(false);
      const onDelete = jest.fn();
      const onCancel = jest.fn();
      showAlert('Delete message?', undefined, [
        { text: 'Cancel', style: 'cancel', onPress: onCancel },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ]);
      expect(window.confirm).toHaveBeenCalledWith('Delete message?');
      expect(onDelete).not.toHaveBeenCalled();
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });
});
