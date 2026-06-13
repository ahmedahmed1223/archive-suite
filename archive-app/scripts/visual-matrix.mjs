const ROUTES = [
  "dashboard",
  "archive",
  "detail",
  "search",
  "add",
  "transcriber",
  "projects",
  "backup",
  "settings"
];

const VIEWPORTS = [
  { id: "mobile-390", width: 390, height: 844 },
  { id: "mobile-430", width: 430, height: 932 },
  { id: "desktop-1440", width: 1440, height: 960 }
];

const THEMES = ["light", "dark"];
const STATES = ["data", "empty", "error"];

function row(route, viewport, theme, state) {
  return `- [ ] ${route} / ${viewport.id} / ${theme} / ${state}`;
}

console.log("# Visual QA Matrix");
console.log("");
console.log("Run against a local preview build. Capture screenshots for changed pages and mark the matching rows.");
console.log("");
for (const route of ROUTES) {
  console.log(`## ${route}`);
  for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
      for (const state of STATES) {
        console.log(row(route, viewport, theme, state));
      }
    }
  }
  console.log("");
}
