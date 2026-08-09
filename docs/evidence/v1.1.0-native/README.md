# v1.1.0 Native release evidence

This tracked index defines the evidence that the `v1.1.0` release workflow must
attach to the public GitHub Release before Windows Native or Linux Native is
published.

- Windows: package checksum inventory plus the machine-readable result of
  `native-acceptance.mjs windows` from the clean, self-hosted Windows release
  runner.
- Linux: package checksum inventory plus the machine-readable result of
  `native-acceptance.mjs linux` from the isolated Docker/systemd runner.
- Both results bind the package digest, Git commit, product version, scenarios,
  and cleanup proof.

Historical local evidence is not release evidence. The tag workflow generates
fresh files from the tagged commit, and its publication job is blocked unless
both platform acceptance jobs succeed.
