export const shares = {
  dialogs: {
    remove: {
      title: "Remove link",
      message: "Remove this link from this browser's record only? This will not revoke the link on the server.",
      confirm: "Remove"
    },
    clear: {
      title: "Clear local history",
      message: "Clear the local link history only? This will not revoke share links.",
      confirm: "Clear"
    }
  },
  toolbar: {
    eyebrow: "Local to this device",
    title: "Share links",
    description: "Links created by the user in this browser, with quick copying and creation and expiry date tracking.",
    localShares: "Local shares",
    linkCount: "{count} links",
    incomingShares: "Incoming shares",
    cleared: "Cleared",
    clearAll: "Clear all"
  },
  empty: {
    title: "You have not created any share links yet",
    description: "Go to Files and select items to create a share link.",
    openFiles: "Open files"
  },
  list: {
    ariaLabel: "Created share links",
    title: "Link list",
    description: "These links are managed locally to make them easy to revisit and copy without syncing them between devices.",
    cardsAriaLabel: "Share-link cards",
    share: "Share",
    fallbackLink: "Share link",
    createdAt: "Created",
    expiresAt: "Expires",
    expiryDescription: "{date} — {detail} A local estimate based on the stated date; enforcement is on the server.",
    copied: "Copied",
    copy: "Copy",
    open: "Open",
    remove: "Remove"
  },
  expiry: {
    estimate: "(estimate)",
    noExpiry: { label: "No expiry", detail: "Review the link's permission before sharing it outside the team." },
    invalidDate: { label: "Date unavailable", detail: "Do not rely on the link until you verify its expiry date." },
    expired: { label: "Expired", detail: "Create a new link if sharing is still needed." },
    expiresSoon: { label: "Expires soon", detail: "Make sure the recipient can open it before it expires." },
    active: { label: "Active", detail: "The permissions used to create the link remain in effect." }
  },
  table: { ariaLabel: "Share-link list", item: "Item", link: "Link", createdAt: "Created", expiresAt: "Expires", actions: "Actions" }
} as const;
