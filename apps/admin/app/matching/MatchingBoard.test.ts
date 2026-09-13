import { describe, expect, it } from 'vitest';
import { requiredGenderForGroup, pairKey, placementViolation, type Booking } from './MatchingBoard';

function makeBooking(
  overrides: Omit<Partial<Booking>, 'profile'> & { profile?: Partial<Booking['profile']> }
): Booking {
  const defaultProfile = { id: 'user-1', full_name: 'Test Student', gender: 'female', year_of_study: 2, photo_url: null };
  const { profile, ...rest } = overrides;
  return {
    id: 'booking-1',
    user_id: 'user-1',
    budget_band: 'mid',
    group_preference: 'mixed',
    plus_one: false,
    plus_one_name: null,
    movie_choice_type: null,
    movie_id: null,
    movie: null,
    ...rest,
    profile: { ...defaultProfile, ...profile },
  };
}

describe('requiredGenderForGroup', () => {
  it('requires female when any member wants a women_only group', () => {
    const members = [makeBooking({ group_preference: 'women_only' })];
    expect(requiredGenderForGroup(members)).toBe('female');
  });

  it('requires male when any member wants a men_only group', () => {
    const members = [makeBooking({ group_preference: 'men_only' })];
    expect(requiredGenderForGroup(members)).toBe('male');
  });

  it('has no requirement for an all-mixed group', () => {
    const members = [makeBooking({ group_preference: 'mixed' })];
    expect(requiredGenderForGroup(members)).toBeNull();
  });

  it('has no requirement for an empty group', () => {
    expect(requiredGenderForGroup([])).toBeNull();
  });
});

describe('pairKey', () => {
  it('is order-independent', () => {
    expect(pairKey('a', 'b')).toBe(pairKey('b', 'a'));
  });

  it('distinguishes different pairs', () => {
    expect(pairKey('a', 'b')).not.toBe(pairKey('a', 'c'));
  });
});

describe('placementViolation', () => {
  it('rejects a candidate wanting women_only when the group has a non-female member', () => {
    const candidate = makeBooking({
      user_id: 'a',
      group_preference: 'women_only',
      profile: { gender: 'female' },
    });
    const members = [makeBooking({ user_id: 'b', profile: { gender: 'male' } })];
    expect(placementViolation(candidate, members, new Set())).toMatch(/women-only/);
  });

  it('rejects a candidate wanting men_only when the group has a non-male member', () => {
    const candidate = makeBooking({
      user_id: 'a',
      group_preference: 'men_only',
      profile: { gender: 'male' },
    });
    const members = [makeBooking({ user_id: 'b', profile: { gender: 'female' } })];
    expect(placementViolation(candidate, members, new Set())).toMatch(/men-only/);
  });

  it('rejects a mixed candidate joining a group that already requires a specific gender', () => {
    const candidate = makeBooking({
      user_id: 'a',
      group_preference: 'mixed',
      profile: { gender: 'male' },
    });
    const members = [
      makeBooking({ user_id: 'b', group_preference: 'women_only', profile: { gender: 'female' } }),
    ];
    expect(placementViolation(candidate, members, new Set())).toMatch(/women-only/);
  });

  it('rejects a candidate blocked by an existing report against a member', () => {
    const candidate = makeBooking({ user_id: 'a' });
    const members = [makeBooking({ user_id: 'b' })];
    const blocked = new Set([pairKey('a', 'b')]);
    expect(placementViolation(candidate, members, blocked)).toMatch(/reported/);
  });

  it('allows a compatible candidate with no gender conflict or blocklist hit', () => {
    const candidate = makeBooking({ user_id: 'a', group_preference: 'mixed' });
    const members = [makeBooking({ user_id: 'b', group_preference: 'mixed' })];
    expect(placementViolation(candidate, members, new Set())).toBeNull();
  });

  // 0086_movies.sql: a choose_movie booking's movie_id is a hard constraint
  // the same way group_preference already is.
  it('rejects a candidate who chose a different movie than an existing member', () => {
    const candidate = makeBooking({ user_id: 'a', movie_choice_type: 'choose_movie', movie_id: 'movie-1' });
    const members = [makeBooking({ user_id: 'b', movie_choice_type: 'choose_movie', movie_id: 'movie-2' })];
    expect(placementViolation(candidate, members, new Set())).toMatch(/different movie/);
  });

  it('allows a candidate who chose the same movie as an existing member', () => {
    const candidate = makeBooking({ user_id: 'a', movie_choice_type: 'choose_movie', movie_id: 'movie-1' });
    const members = [makeBooking({ user_id: 'b', movie_choice_type: 'choose_movie', movie_id: 'movie-1' })];
    expect(placementViolation(candidate, members, new Set())).toBeNull();
  });

  it('allows a surprise_me candidate to join a group with a movie already chosen', () => {
    const candidate = makeBooking({ user_id: 'a', movie_choice_type: 'surprise_me', movie_id: null });
    const members = [makeBooking({ user_id: 'b', movie_choice_type: 'choose_movie', movie_id: 'movie-1' })];
    expect(placementViolation(candidate, members, new Set())).toBeNull();
  });

  it('allows a candidate who chose a movie to join an all-surprise_me group', () => {
    const candidate = makeBooking({ user_id: 'a', movie_choice_type: 'choose_movie', movie_id: 'movie-1' });
    const members = [makeBooking({ user_id: 'b', movie_choice_type: 'surprise_me', movie_id: null })];
    expect(placementViolation(candidate, members, new Set())).toBeNull();
  });
});
