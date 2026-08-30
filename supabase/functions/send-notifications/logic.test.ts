import { describe, expect, it } from 'vitest';
import {
  partitionByPushToken,
  chunk,
  buildExpoMessages,
  resolveTicketOutcome,
  isAuthorizedCronCaller,
  MAX_ATTEMPTS,
} from './logic';

describe('partitionByPushToken', () => {
  it('splits rows into those with and without a push token', () => {
    const rows = [
      { id: '1', profiles: { push_token: 'ExponentPushToken[a]' } },
      { id: '2', profiles: { push_token: null } },
      { id: '3', profiles: null },
      { id: '4', profiles: { push_token: 'ExponentPushToken[b]' } },
    ];
    const { withToken, withoutToken } = partitionByPushToken(rows);
    expect(withToken.map((r) => r.id)).toEqual(['1', '4']);
    expect(withoutToken.map((r) => r.id)).toEqual(['2', '3']);
  });
});

describe('chunk', () => {
  it('splits items into batches of the given size', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('returns a single batch when items fit within one size', () => {
    expect(chunk([1, 2], 100)).toEqual([[1, 2]]);
  });

  it('returns an empty array for no items', () => {
    expect(chunk([], 100)).toEqual([]);
  });
});

describe('buildExpoMessages', () => {
  it('maps outbox rows into Expo push messages, tagging data with the type', () => {
    const batch = [
      {
        title: 'Your group is matched',
        body: 'Meet your crew',
        type: 'group_matched',
        data: { groupId: 'g1' },
        profiles: { push_token: 'ExponentPushToken[a]' },
      },
    ];
    expect(buildExpoMessages(batch)).toEqual([
      {
        to: 'ExponentPushToken[a]',
        title: 'Your group is matched',
        body: 'Meet your crew',
        data: { groupId: 'g1', type: 'group_matched' },
      },
    ]);
  });

  it('defaults data to just the type when the row has no data payload', () => {
    const batch = [{ title: 't', body: 'b', type: 'no_show', data: null, profiles: { push_token: 'tok' } }];
    expect(buildExpoMessages(batch)[0].data).toEqual({ type: 'no_show' });
  });
});

describe('isAuthorizedCronCaller', () => {
  const key = 'service-role-secret';

  it('accepts the exact service-role bearer token the cron job sends', () => {
    expect(isAuthorizedCronCaller(`Bearer ${key}`, key)).toBe(true);
  });

  it('rejects the anon key (or any other valid-but-wrong JWT)', () => {
    expect(isAuthorizedCronCaller('Bearer some-anon-or-user-jwt', key)).toBe(false);
  });

  it('rejects a missing Authorization header', () => {
    expect(isAuthorizedCronCaller(null, key)).toBe(false);
  });

  it('rejects a header missing the "Bearer " prefix', () => {
    expect(isAuthorizedCronCaller(key, key)).toBe(false);
  });
});

describe('resolveTicketOutcome', () => {
  it('marks sent when the response is ok and the ticket status is ok', () => {
    expect(resolveTicketOutcome({ ok: true, status: 200 }, { status: 'ok' }, 1)).toEqual({
      status: 'sent',
      error: null,
      clearPushToken: false,
    });
  });

  it('permanently fails and clears the push token on DeviceNotRegistered, even on the first attempt', () => {
    expect(
      resolveTicketOutcome(
        { ok: true, status: 200 },
        { status: 'error', message: 'DeviceNotRegistered', details: { error: 'DeviceNotRegistered' } },
        1
      )
    ).toEqual({
      status: 'failed',
      error: 'DeviceNotRegistered',
      clearPushToken: true,
    });
  });

  it('requeues a transient error (no specific Expo error code) for retry while under the attempt cap', () => {
    expect(
      resolveTicketOutcome({ ok: true, status: 200 }, { status: 'error', message: 'MessageRateExceeded' }, 1)
    ).toEqual({
      status: 'pending',
      error: 'MessageRateExceeded',
      clearPushToken: false,
    });
  });

  it('requeues an HTTP-level failure (no ticket at all) for retry while under the attempt cap', () => {
    expect(resolveTicketOutcome({ ok: false, status: 500 }, undefined, 1)).toEqual({
      status: 'pending',
      error: 'HTTP 500',
      clearPushToken: false,
    });
  });

  it('gives up permanently once a transient error has used up all its attempts', () => {
    expect(
      resolveTicketOutcome({ ok: false, status: 500 }, undefined, MAX_ATTEMPTS)
    ).toEqual({
      status: 'failed',
      error: 'HTTP 500',
      clearPushToken: false,
    });
  });
});
