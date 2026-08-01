# Sidebar scroll controls

## Goal

Make the desktop sidebar easier to navigate when its grouped routes exceed the visible height, without exposing a native scrollbar.

## Design

The existing `.route-links` element remains the single keyboard-focusable navigation container. On desktop it gains two compact, icon-only controls: one before and one after the route groups. Each control scrolls the same container by a bounded amount using smooth motion unless reduced motion is requested. The controls are disabled at their respective limits, so their state communicates whether more navigation is available.

The container retains `overflow-y: auto` and keyboard/mouse/touch scrolling. CSS hides the visual scrollbar cross-browser only in the desktop sidebar; it does not remove scrollability. Mobile retains its existing drawer behavior and native scrolling.

## Accessibility and constraints

- Buttons have explicit Arabic accessible labels and tooltips.
- Disabled state is synchronized on scroll, resize, and group expansion/collapse.
- Scroll movement honors `prefers-reduced-motion`.
- No packages, API changes, or persisted preferences are introduced.
