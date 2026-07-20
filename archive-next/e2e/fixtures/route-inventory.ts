import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import type { RoleName } from './roles';

/**
 * V1-303C: a11y coverage inventory for the authenticated Next.js routes.
 *
 * Mirrors the mechanism RouteScopeTest (V1-001/V1-102H) uses on the Laravel
 * side: enumerate the routes that *actually exist* and diff them against a
 * hand-maintained fixture, so a new route fails the gate until somebody
 * classifies it. There the source of truth is Route::getRoutes(); here it is
 * the App Router filesystem (`app/**\/page.tsx`), which is the equivalent
 * authority for Next.js. A route that is neither covered nor explicitly
 * excluded-with-a-reason fails `route-inventory.spec.ts` — the point is that a
 * route can never go untested *silently*.
 *
 * Classification source: docs/scope/v1-route-scope.md + RouteScopeTest's
 * ROLE_FIXTURE (V1-102H). `role` is the LEAST-privileged role that can render
 * the route — testing /settings/users as viewer would only ever assert a 403
 * shell, so admin surfaces are exercised as admin.
 */

export type RouteState = 'loading' | 'empty' | 'error' | 'ready';

export interface RouteCoverage {
  /** Concrete, navigable URL path (dynamic segments already substituted). */
  readonly url: string;
  /** App Router source route, as it appears on disk. */
  readonly route: string;
  /** Least-privileged role that can meaningfully render this route. */
  readonly role: RoleName;
  /** States exercised by the axe gate for this route. */
  readonly states: readonly RouteState[];
}

export const ALL_STATES: readonly RouteState[] = ['loading', 'empty', 'error', 'ready'] as const;

/**
 * Routes reachable without a session. Covered by V1-303A's public axe gate
 * (e2e/accessibility.spec.ts) — listed here only so the inventory diff can
 * account for them rather than reporting them as uncovered.
 *
 * Source: `publicPathPrefixes` in lib/auth-session.tsx.
 */
export const PUBLIC_ROUTES: readonly string[] = [
  '/login',
  '/first-run',
  '/catalog',
  '/share/[token]',
  '/review/[token]',
];

/**
 * Authenticated routes excluded from the axe gate, each with a reason. An
 * entry here is a documented decision, not a silent gap — that is the whole
 * contract this file enforces.
 */
export const EXCLUDED_ROUTES: Readonly<Record<string, string>> = {
  // Renders the guest/redirect shell when unauthenticated, which V1-303A
  // already covers at 375/768/1280; the authenticated dashboard state is
  // covered below via '/' in ROUTE_COVERAGE.
};

/** Dynamic segments need a real id to navigate to; supplied per role at run time. */
export const DYNAMIC_ROUTE_PARAMS: Readonly<Record<string, (data: { recordUid: string }) => string>> = {
  '/archive/[id]': (data) => `/archive/${data.recordUid}`,
};

/**
 * The authenticated coverage table. Every authenticated route from the App
 * Router must appear here or in EXCLUDED_ROUTES.
 */
export const ROUTE_COVERAGE: readonly RouteCoverage[] = [
  { url: '/', route: '/', role: 'viewer', states: ALL_STATES },
  { url: '/activity', route: '/activity', role: 'viewer', states: ALL_STATES },
  { url: '/analytics', route: '/analytics', role: 'viewer', states: ALL_STATES },
  { url: '/archive', route: '/archive', role: 'viewer', states: ALL_STATES },
  { url: '/archive/[id]', route: '/archive/[id]', role: 'viewer', states: ALL_STATES },
  { url: '/automation', route: '/automation', role: 'editor', states: ALL_STATES },
  { url: '/backup', route: '/backup', role: 'admin', states: ALL_STATES },
  { url: '/broadcast', route: '/broadcast', role: 'viewer', states: ALL_STATES },
  { url: '/collaboration', route: '/collaboration', role: 'viewer', states: ALL_STATES },
  { url: '/collections', route: '/collections', role: 'viewer', states: ALL_STATES },
  { url: '/copilot', route: '/copilot', role: 'viewer', states: ALL_STATES },
  { url: '/data-center', route: '/data-center', role: 'admin', states: ALL_STATES },
  { url: '/discover', route: '/discover', role: 'viewer', states: ALL_STATES },
  { url: '/duplicates', route: '/duplicates', role: 'viewer', states: ALL_STATES },
  { url: '/errors', route: '/errors', role: 'viewer', states: ALL_STATES },
  { url: '/favorites', route: '/favorites', role: 'viewer', states: ALL_STATES },
  { url: '/files', route: '/files', role: 'viewer', states: ALL_STATES },
  { url: '/graph', route: '/graph', role: 'viewer', states: ALL_STATES },
  { url: '/help', route: '/help', role: 'viewer', states: ALL_STATES },
  { url: '/inbox', route: '/inbox', role: 'viewer', states: ALL_STATES },
  { url: '/ingest', route: '/ingest', role: 'editor', states: ALL_STATES },
  { url: '/kanban', route: '/kanban', role: 'viewer', states: ALL_STATES },
  { url: '/map', route: '/map', role: 'viewer', states: ALL_STATES },
  { url: '/media/compare', route: '/media/compare', role: 'viewer', states: ALL_STATES },
  { url: '/media/jobs', route: '/media/jobs', role: 'viewer', states: ALL_STATES },
  { url: '/media/play', route: '/media/play', role: 'viewer', states: ALL_STATES },
  { url: '/media/review', route: '/media/review', role: 'viewer', states: ALL_STATES },
  { url: '/notifications', route: '/notifications', role: 'viewer', states: ALL_STATES },
  { url: '/plugins', route: '/plugins', role: 'admin', states: ALL_STATES },
  { url: '/projects', route: '/projects', role: 'viewer', states: ALL_STATES },
  { url: '/reading-lists', route: '/reading-lists', role: 'viewer', states: ALL_STATES },
  { url: '/reports', route: '/reports', role: 'admin', states: ALL_STATES },
  { url: '/rights', route: '/rights', role: 'viewer', states: ALL_STATES },
  { url: '/search', route: '/search', role: 'viewer', states: ALL_STATES },
  { url: '/search/saved', route: '/search/saved', role: 'viewer', states: ALL_STATES },
  { url: '/settings', route: '/settings', role: 'viewer', states: ALL_STATES },
  { url: '/settings/users', route: '/settings/users', role: 'admin', states: ALL_STATES },
  { url: '/shares', route: '/shares', role: 'editor', states: ALL_STATES },
  { url: '/shares/with-me', route: '/shares/with-me', role: 'viewer', states: ALL_STATES },
  { url: '/status', route: '/status', role: 'admin', states: ALL_STATES },
  { url: '/sync', route: '/sync', role: 'viewer', states: ALL_STATES },
  { url: '/system/control', route: '/system/control', role: 'admin', states: ALL_STATES },
  { url: '/tags', route: '/tags', role: 'viewer', states: ALL_STATES },
  { url: '/timeline', route: '/timeline', role: 'viewer', states: ALL_STATES },
  { url: '/transcriber', route: '/transcriber', role: 'viewer', states: ALL_STATES },
  // GET /v1/trash is ROLE_ANY (RouteScopeTest ROLE_FIXTURE, V1-731) — only the
  // restore/purge actions escalate to editor/admin, and those are buttons on
  // the page, not a precondition for rendering it.
  { url: '/trash', route: '/trash', role: 'viewer', states: ALL_STATES },
  { url: '/types', route: '/types', role: 'viewer', states: ALL_STATES },
  { url: '/uploads', route: '/uploads', role: 'editor', states: ALL_STATES },
  { url: '/uploads/scheduled', route: '/uploads/scheduled', role: 'editor', states: ALL_STATES },
  { url: '/vocabulary', route: '/vocabulary', role: 'editor', states: ALL_STATES },
];

/**
 * Enumerates the App Router's real page routes off disk — the Next.js
 * equivalent of Laravel's Route::getRoutes(). Route groups `(group)` and
 * private `_folders` are not URL segments; parallel/intercepting routes
 * (`@slot`, `(.)`) are not standalone pages.
 */
export function discoverAppRoutes(appDir = path.resolve('app')): string[] {
  const routes: string[] = [];

  function walk(dir: string, urlSegments: string[]): void {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);

      if (!statSync(full).isDirectory()) {
        if (entry === 'page.tsx' || entry === 'page.ts') {
          routes.push(`/${urlSegments.join('/')}`);
        }
        continue;
      }

      // `api` holds route handlers, not pages.
      if (entry === 'api' || entry.startsWith('_') || entry.startsWith('@')) {
        continue;
      }

      // Route groups don't contribute a URL segment.
      const isGroup = entry.startsWith('(') && entry.endsWith(')');
      walk(full, isGroup ? urlSegments : [...urlSegments, entry]);
    }
  }

  walk(appDir, []);

  return routes.sort();
}
