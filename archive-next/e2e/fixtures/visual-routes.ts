/**
 * V1-303A/E: the project's required breakpoints and the core routes exercised
 * at each of them. Shared by accessibility.spec.ts (axe) and
 * visual-regression.spec.ts (overflow + screenshot evidence) so the two gates
 * can never drift onto different route lists.
 *
 * Routes below don't require a live Laravel backend or auth cookie (see
 * next-migration-shell.spec.ts) — that is what keeps them usable as the
 * baseline "core routes" set for gates that run without a backend.
 */

export const CORE_ROUTES = [
  '/',
  '/login',
  '/help',
  '/reports',
  '/settings',
  '/archive',
  '/share/demo-token',
  '/media/jobs',
];

export const VIEWPORTS = [
  { name: 'mobile-375', width: 375, height: 812 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1280', width: 1280, height: 800 },
] as const;
