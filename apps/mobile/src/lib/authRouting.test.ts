// Regression coverage: getPostAuthRoute() used to have no error check on
// either of its two queries at all, so a query failing (e.g. a transient
// "network hasn't reconnected yet" window right after the app is
// relaunched from a full kill) resolved to the exact same shape as
// "profile genuinely incomplete" — silently bouncing an already-onboarded,
// still-logged-in student back into the auth flow. These tests prove the
// retry-then-throw behavior that replaced that silent misroute.

import { getPostAuthRoute } from './authRouting';

// `mockFrom` is referenced inside the jest.mock() factory below even
// though it's declared after this point in the file — safe because
// babel-plugin-jest-hoist moves jest.mock() calls above both imports and
// local declarations at compile time, and specifically allows referencing
// a variable named /^mock/i from inside a hoisted factory.
const mockFrom = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

// Each chain below is a fresh object with its own jest.fn()s — sharing a
// single mock across multiple chains (e.g. one shared `.eq` reused for
// both the profile and the count query) means the second call's
// mockImplementation silently overwrites the first's, which is its own
// good way to produce a confusing "X is not a function" failure that has
// nothing to do with the code under test.
function singleQueryChain(result: { data: unknown; error: unknown }) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
  };
}

// The personality_scores lookup resolves directly off .eq() (a head:true
// count query), with no further .single() call.
function countQueryChain(result: { count: number; error: unknown }) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockResolvedValue(result),
  };
}

describe('getPostAuthRoute', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  const completeProfile = { full_name: 'Real Name', gender: 'female', year_of_study: 2 };

  it('routes to profile-creation when the profile is genuinely incomplete', async () => {
    mockFrom.mockReturnValueOnce(
      singleQueryChain({ data: { full_name: 'New user', gender: null, year_of_study: null }, error: null })
    );

    expect(await getPostAuthRoute('user-1')).toBe('/(auth)/profile-creation');
  });

  it('routes to personality-quiz when the profile is complete but no score exists', async () => {
    mockFrom.mockReturnValueOnce(singleQueryChain({ data: completeProfile, error: null }));
    mockFrom.mockReturnValueOnce(countQueryChain({ count: 0, error: null }));

    expect(await getPostAuthRoute('user-1')).toBe('/(auth)/personality-quiz');
  });

  it('routes to home when profile and quiz are both complete', async () => {
    mockFrom.mockReturnValueOnce(singleQueryChain({ data: completeProfile, error: null }));
    mockFrom.mockReturnValueOnce(countQueryChain({ count: 1, error: null }));

    expect(await getPostAuthRoute('user-1')).toBe('/(home)');
  });

  it('retries a failed profile query and succeeds once the transient failure clears', async () => {
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest
        .fn()
        .mockResolvedValueOnce({ data: null, error: { message: 'network error' } })
        .mockResolvedValueOnce({ data: completeProfile, error: null }),
    };
    // Keyed by table name rather than mockReturnValueOnce: withRetry calls
    // supabase.from('profiles') fresh on every retry attempt, not just
    // once, so a queue of one-shot return values runs out after the first
    // retry and starts handing back whatever chain was queued next
    // (the personality_scores one), not undefined — a more confusing
    // failure than a clean "wrong mock" one.
    mockFrom.mockImplementation((table: string) =>
      table === 'profiles' ? chain : countQueryChain({ count: 1, error: null })
    );

    expect(await getPostAuthRoute('user-1')).toBe('/(home)');
    expect(chain.single).toHaveBeenCalledTimes(2);
  }, 10000);

  it('throws instead of silently treating an exhausted-retry failure as an incomplete profile', async () => {
    const chain = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: { message: 'network error' } }),
    };
    mockFrom.mockImplementation(() => chain);

    await expect(getPostAuthRoute('user-1')).rejects.toEqual({ message: 'network error' });
    // 1 initial attempt + 3 retries, matching RETRY_DELAYS_MS's length.
    expect(chain.single).toHaveBeenCalledTimes(4);
  }, 10000);
});
