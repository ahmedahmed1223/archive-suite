# Archive Suite v1.1.0 Docker support evidence

The public release workflow regenerates Docker support evidence from the tagged
commit before publication. The release is blocked unless all of the following
checks pass:

- the canonical Laravel and Next.js images build from pinned inputs;
- the full Laravel and Next.js verification suites pass;
- the live Laravel/Next.js integration suite passes against Docker;
- both images pass vulnerability scanning and keyless Cosign verification;
- the offline bundle rehearsal starts the core stack, verifies its HTTP health,
  and proves cleanup; and
- the published image digests, SBOMs, license inventories, offline evidence,
  and SHA-256 checksums are attached to the GitHub Release.

Windows 10/11 uses Docker Desktop with Compose v2. Linux uses Docker Engine
with Compose v2. Both consume the same immutable release images and contract.

The authoritative machine-generated evidence is attached to the `v1.1.0`
GitHub Release. This tracked index exists so a supported-platform declaration
cannot be tagged without an explicit evidence contract.
