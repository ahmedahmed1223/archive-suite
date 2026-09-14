"use client";

import type { ReactNode } from "react";
import { useId, useState } from "react";
import styles from "./studio.module.css";

export default function StudioAdvancedPanels({ label, children }: { label: string; children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();

  return (
    <section className={styles.advancedDisclosure}>
      <button
        type="button"
        className={`button button-secondary ${styles.advancedToggle}`}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setIsOpen((open) => !open)}
      >
        {label}
      </button>
      <div id={panelId} className={`${styles.advancedPanels} ${isOpen ? styles.isOpen : ""}`.trim()}>
        {children}
      </div>
    </section>
  );
}
