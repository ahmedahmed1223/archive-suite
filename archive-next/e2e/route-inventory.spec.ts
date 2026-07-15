import { expect, test } from '@playwright/test';
import {
  discoverAppRoutes,
  EXCLUDED_ROUTES,
  PUBLIC_ROUTES,
  ROUTE_COVERAGE,
} from './fixtures/route-inventory';

/**
 * V1-303C: the coverage gate itself.
 *
 * Same contract as RouteScopeTest's test_every_registered_v1_route_is_classified
 * (V1-001), transplanted to the App Router: enumerate the routes that really
 * exist, diff against the fixture, fail on anything unaccounted for. Adding
 * `app/foo/page.tsx` without either an a11y entry or a written exclusion
 * reason turns this red — a route cannot become silently untested.
 *
 * These are pure filesystem assertions: no server, no auth, no axe. They stay
 * green (and keep guarding) even when the live env is unavailable.
 */

test.describe('@inventory a11y route coverage gate', () => {
  const discovered = discoverAppRoutes();
  const covered = new Set(ROUTE_COVERAGE.map((entry) => entry.route));
  const excluded = new Set(Object.keys(EXCLUDED_ROUTES));
  const publicRoutes = new Set(PUBLIC_ROUTES);

  test('every App Router page route is covered, public, or excluded with a reason', () => {
    const unaccounted = discovered.filter(
      (route) =>
        !covered.has(route) && !excluded.has(route) && !publicRoutes.has(route),
    );

    expect(
      unaccounted,
      'Authenticated route(s) with no a11y coverage. Add to ROUTE_COVERAGE in ' +
        'e2e/fixtures/route-inventory.ts (preferred), or to EXCLUDED_ROUTES with a ' +
        'reason, or to PUBLIC_ROUTES if genuinely unauthenticated (and cover it in ' +
        `e2e/accessibility.spec.ts): ${unaccounted.join(', ')}`,
    ).toEqual([]);
  });

  test('coverage table has no stale entries', () => {
    const real = new Set(discovered);
    const stale = ROUTE_COVERAGE.map((entry) => entry.route).filter(
      (route) => !real.has(route),
    );

    expect(
      stale,
      `ROUTE_COVERAGE references route(s) that no longer exist on disk: ${stale.join(', ')}`,
    ).toEqual([]);
  });

  test('exclusion and public lists have no stale entries', () => {
    const real = new Set(discovered);
    const stale = [...excluded, ...publicRoutes].filter((route) => !real.has(route));

    expect(
      stale,
      `EXCLUDED_ROUTES/PUBLIC_ROUTES reference route(s) that no longer exist: ${stale.join(', ')}`,
    ).toEqual([]);
  });

  test('no route is both covered and excluded', () => {
    const conflicting = [...covered].filter(
      (route) => excluded.has(route) || publicRoutes.has(route),
    );

    expect(
      conflicting,
      `Route(s) listed as covered AND excluded/public — pick one: ${conflicting.join(', ')}`,
    ).toEqual([]);
  });

  test('every covered route declares at least one state', () => {
    const stateless = ROUTE_COVERAGE.filter((entry) => entry.states.length === 0).map(
      (entry) => entry.route,
    );

    expect(
      stateless,
      `Covered route(s) declaring zero states would pass the gate without running axe: ${stateless.join(', ')}`,
    ).toEqual([]);
  });

  test('every excluded route carries a non-empty reason', () => {
    const unreasoned = Object.entries(EXCLUDED_ROUTES)
      .filter(([, reason]) => reason.trim().length === 0)
      .map(([route]) => route);

    expect(
      unreasoned,
      `Excluded route(s) with an empty reason — an exclusion must be a decision, ` +
        `not a silent gap: ${unreasoned.join(', ')}`,
    ).toEqual([]);
  });
});
