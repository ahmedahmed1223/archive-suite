"use client";

import { useMemo, useState } from "react";
import type { ArchivalNode } from "@/lib/archive-api";
import styles from "./ArchivalHierarchyTree.module.css";

type HierarchyCopy = {
  expand: string;
  collapse: string;
  childCount: string;
  move: string;
  levelLabels: Record<ArchivalNode["level"], string>;
};

type TreeNode = ArchivalNode & { children: TreeNode[] };

function format(copy: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((result, [key, value]) => result.replace(`{${key}}`, String(value)), copy);
}

function buildTree(nodes: ArchivalNode[]): TreeNode[] {
  const index = new Map<string, TreeNode>();
  for (const node of nodes) index.set(node.id, { ...node, children: [] });

  const roots: TreeNode[] = [];
  for (const node of index.values()) {
    const parent = node.parentId ? index.get(node.parentId) : null;
    if (parent && parent.id !== node.id) parent.children.push(node);
    else roots.push(node);
  }

  const order = (items: TreeNode[]) => {
    items.sort((left, right) => left.position - right.position || left.title.localeCompare(right.title));
    items.forEach((item) => order(item.children));
  };
  order(roots);
  return roots;
}

export interface ArchivalHierarchyTreeProps {
  nodes: ArchivalNode[];
  copy: HierarchyCopy;
  ariaLabel?: string;
  onMove?: (node: ArchivalNode) => void;
}

/**
 * A structural view of archival placement. It derives nesting from parentId,
 * rather than trusting the display-only path returned by the API, so it stays
 * accurate immediately after a move operation.
 */
export default function ArchivalHierarchyTree({ nodes, copy, ariaLabel = "Archival hierarchy", onMove }: ArchivalHierarchyTreeProps) {
  const tree = useMemo(() => buildTree(nodes), [nodes]);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const toggle = (id: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderNode = (node: TreeNode): React.ReactNode => {
    const hasChildren = node.children.length > 0;
    const isCollapsed = collapsed.has(node.id);
    const disclosureLabel = isCollapsed
      ? format(copy.expand, { title: node.title })
      : format(copy.collapse, { title: node.title });

    return (
      <li key={node.id} role="treeitem" aria-level={(node.path?.length ?? 0) + 1} aria-expanded={hasChildren ? !isCollapsed : undefined}>
        <div className={styles.row}>
          <span className={styles.branch} aria-hidden="true" />
          {hasChildren ? (
            <button type="button" className={styles.disclosure} onClick={() => toggle(node.id)} aria-label={disclosureLabel}>
              <span aria-hidden="true">{isCollapsed ? "‹" : "⌄"}</span>
            </button>
          ) : <span className={styles.disclosurePlaceholder} aria-hidden="true" />}
          <div className={styles.identity}>
            <strong>{node.title}</strong>
            <span className={styles.meta}>
              <span className="badge">{copy.levelLabels[node.level]}</span>
              {node.referenceCode ? <code>{node.referenceCode}</code> : null}
              {hasChildren ? <span>{format(copy.childCount, { count: node.children.length })}</span> : null}
            </span>
          </div>
          {onMove ? (
            <button
              className="button button-secondary button-sm"
              type="button"
              onClick={() => {
                const { children: _children, ...archivalNode } = node;
                onMove(archivalNode);
              }}
            >
              {copy.move}
            </button>
          ) : null}
        </div>
        {hasChildren && !isCollapsed ? <ol role="group" className={styles.children}>{node.children.map(renderNode)}</ol> : null}
      </li>
    );
  };

  return <ol role="tree" aria-label={ariaLabel} className={styles.tree}>{tree.map(renderNode)}</ol>;
}
