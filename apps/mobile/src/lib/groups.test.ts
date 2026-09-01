import { fetchMyBookings } from './groups';

// @/lib/supabase throws at import time without real env vars (it inits a
// live Supabase client) — mocked here so fetchMyBookings can be tested
// against canned query results instead of a live database. jest.mock calls
// (and the mock-prefixed consts they reference) are hoisted above all
// imports by babel-plugin-jest-hoist regardless of source order, so this
// runs before the import above despite appearing after it in source.
const mockFrom = jest.fn();
jest.mock('@/lib/supabase', () => ({ supabase: { from: (...args: unknown[]) => mockFrom(...args) } }));

function queryReturning(rows: unknown[]) {
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    neq: () => Promise.resolve({ data: rows, error: null }),
  };
  return builder;
}

describe('fetchMyBookings', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it('sorts bookings by slot_datetime ascending, regardless of fetch order', () => {
    const rows = [
      { id: 'b-later', status: 'pending_match', payment_status: 'paid', slot_id: 's3', slots: { slot_datetime: '2026-08-20T19:00:00Z', activity_types: { name: 'Dinner', emoji: '🍽️' } } },
      { id: 'b-earliest', status: 'pending_match', payment_status: 'paid', slot_id: 's1', slots: { slot_datetime: '2026-08-15T19:00:00Z', activity_types: { name: 'Café', emoji: '☕' } } },
      { id: 'b-middle', status: 'pending_match', payment_status: 'paid', slot_id: 's2', slots: { slot_datetime: '2026-08-17T19:00:00Z', activity_types: { name: 'Movie', emoji: '🎬' } } },
    ];
    mockFrom.mockReturnValue(queryReturning(rows));

    return fetchMyBookings('user-1').then((result) => {
      expect(result.data.map((b) => b.id)).toEqual(['b-earliest', 'b-middle', 'b-later']);
      expect(result.error).toBeNull();
    });
  });

  it('falls back to defaults when the activity join is missing', async () => {
    mockFrom.mockReturnValue(
      queryReturning([{ id: 'b1', status: 'pending_match', payment_status: 'unpaid', slot_id: 's1', slots: null }])
    );

    const result = await fetchMyBookings('user-1');
    expect(result.data[0].activity_name).toBe('Activity');
    expect(result.data[0].activity_emoji).toBe('');
  });

  it('returns an empty array and a user-safe error message when the query errors', async () => {
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ neq: () => Promise.resolve({ data: null, error: new Error('boom') }) }) }),
    });

    const result = await fetchMyBookings('user-1');
    expect(result.data).toEqual([]);
    expect(result.error).toBe('boom');
  });
});
