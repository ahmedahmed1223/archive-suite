import type { MediaJob } from "./archive-api";

export interface MediaDerivativeArtifact {
  id: string;
  kind: string;
  key: string;
  url: string | null;
  children: MediaDerivativeJob[];
}

export interface MediaDerivativeJob {
  id: string;
  operation: MediaJob["operation"];
  status: MediaJob["status"];
  sourcePath: string | null;
  queuedAt: string | null;
  completedAt: string | null;
  error: string | null;
  artifacts: MediaDerivativeArtifact[];
}

export interface MediaDerivativeTree {
  recordId: string;
  sourcePath: string | null;
  jobs: MediaDerivativeJob[];
  jobCount: number;
  artifactCount: number;
}

interface IndexedArtifact {
  artifact: MediaDerivativeArtifact;
  jobIndex: number;
}

function normalizedPath(value: string | null | undefined): string {
  return (value ?? "").trim().replaceAll("\\", "/").replace(/^\.\//, "");
}

function dateValue(value: string | null | undefined): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
}

function artifactsFor(job: MediaJob): MediaDerivativeArtifact[] {
  const values = job.result?.artifacts;
  if (!Array.isArray(values)) return [];

  return values.flatMap((value, index) => {
    if (!value || typeof value !== "object") return [];
    const candidate = value as Record<string, unknown>;
    const key = normalizedPath(typeof candidate.key === "string" ? candidate.key : null);
    if (!key) return [];

    return [{
      id: `${job.id}:artifact:${index}`,
      kind: typeof candidate.kind === "string" && candidate.kind.trim() ? candidate.kind.trim() : "artifact",
      key,
      url: typeof candidate.url === "string" && candidate.url.trim() ? candidate.url : null,
      children: []
    }];
  });
}

/**
 * Reconstructs local media provenance from persisted media-job source paths and result artifacts.
 * A job is nested beneath the prior artifact whose key exactly matches its source path.
 */
export function buildMediaDerivativeTree(recordId: string, sourcePath: string | null | undefined, jobs: MediaJob[]): MediaDerivativeTree {
  const orderedJobs = jobs
    .filter((job) => job.recordId === recordId)
    .slice()
    .sort((left, right) => dateValue(left.queuedAt) - dateValue(right.queuedAt) || left.id.localeCompare(right.id));

  const nodes = orderedJobs.map<MediaDerivativeJob>((job) => ({
    id: job.id,
    operation: job.operation,
    status: job.status,
    sourcePath: normalizedPath(job.sourcePath) || null,
    queuedAt: job.queuedAt ?? null,
    completedAt: job.completedAt ?? null,
    error: job.error ?? null,
    artifacts: artifactsFor(job)
  }));
  const artifactsByKey = new Map<string, IndexedArtifact[]>();

  nodes.forEach((node, jobIndex) => {
    node.artifacts.forEach((artifact) => {
      const candidates = artifactsByKey.get(artifact.key) ?? [];
      candidates.push({ artifact, jobIndex });
      artifactsByKey.set(artifact.key, candidates);
    });
  });

  const rootJobs: MediaDerivativeJob[] = [];
  nodes.forEach((node, jobIndex) => {
    const candidates = node.sourcePath ? artifactsByKey.get(node.sourcePath) ?? [] : [];
    const parent = candidates.filter((candidate) => candidate.jobIndex < jobIndex).at(-1);
    if (parent) {
      parent.artifact.children.push(node);
      return;
    }

    rootJobs.push(node);
  });

  return {
    recordId,
    sourcePath: normalizedPath(sourcePath) || null,
    jobs: rootJobs,
    jobCount: nodes.length,
    artifactCount: nodes.reduce((count, node) => count + node.artifacts.length, 0)
  };
}
