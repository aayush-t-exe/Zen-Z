// @/lib/supabase throws at import time without real env vars (it inits a
// live Supabase client) — mocked here since this file only exercises the
// pure routing logic in handleNotificationResponse, never Supabase itself.
jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockPush(...args) } }));

import { handleNotificationResponse } from './notifications';

function responseWithData(data: Record<string, unknown>) {
  return {
    notification: { request: { content: { data } } },
  } as any;
}

describe('handleNotificationResponse', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('routes a no_show notification to the no-show screen with its bookingId', () => {
    handleNotificationResponse(responseWithData({ type: 'no_show', bookingId: 'booking-1' }));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(home)/no-show',
      params: { bookingId: 'booking-1' },
    });
  });

  it('routes a groupId-bearing notification (e.g. group matched) to the group screen', () => {
    handleNotificationResponse(responseWithData({ type: 'group_matched', groupId: 'group-1' }));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(home)/group/[groupId]',
      params: { groupId: 'group-1' },
    });
  });

  it('falls back to the bookings tab for a type with no dedicated screen', () => {
    handleNotificationResponse(responseWithData({ type: 'post_event_feedback' }));
    expect(mockPush).toHaveBeenCalledWith('/(home)/bookings');
  });

  it('falls back to the bookings tab when data is missing entirely', () => {
    handleNotificationResponse(responseWithData({}));
    expect(mockPush).toHaveBeenCalledWith('/(home)/bookings');
  });

  it('does not treat a no_show type with a missing bookingId as the no-show route', () => {
    handleNotificationResponse(responseWithData({ type: 'no_show' }));
    expect(mockPush).toHaveBeenCalledWith('/(home)/bookings');
  });
});
