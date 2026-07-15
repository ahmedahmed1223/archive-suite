# V1-501 Docker game-day

`scripts/game-day.mjs` is an opt-in, Docker-only game-day runner for the
canonical Laravel + Next stack. It defaults to a dry run: it creates a
redacted evidence record describing the drill, but never invokes Docker.

Run the default plan:

```powershell
node scripts/game-day.mjs
```

Plan selected scenarios:

```powershell
node scripts/game-day.mjs GD-DB-01 GD-WORKER-03
```

An operator may execute a prepared Docker drill only after reviewing the plan:

```powershell
node scripts/game-day.mjs --execute GD-DB-01
```

`GD-DISK-06` additionally requires an explicit acknowledgement because it
writes a bounded, runner-owned file at `/tmp/archive-game-day-fill` inside the
isolated application container:

```powershell
node scripts/game-day.mjs --execute --allow-disk-fault GD-DISK-06
```

## Safety and evidence

Each run uses an `archive-gameday-*` Compose project. Before an executed run,
the runner generates a temporary Compose file beside the canonical one with
fixed `container_name` entries removed; Compose can therefore scope containers,
networks, and named volumes to this drill. The temporary file is deleted in a
`finally` block. Cleanup is always requested with `docker compose down
--volumes --remove-orphans`, then the runner asks Compose for remaining objects
in that project. Evidence keeps `cleanup.proved` false unless that scoped query
is empty.

Evidence is written under `artifacts/game-day/` (or the caller-supplied output
directory) and redacts credentials, tokens, authorization headers, connection
credentials, and local paths. Evidence records detection, recovery, data-safety
constraints, commands, and cleanup proof; it is not a claim that recovery was
successful unless the operator has reviewed the generated record.

## Scenario registry

| Scenario | Docker fault | Recovery proof |
| --- | --- | --- |
| GD-DB-01 | stop/start PostgreSQL | database health and read/write smoke probe |
| GD-REDIS-02 | stop/start Redis | Redis health and resumed queue processing |
| GD-WORKER-03 | stop/start worker | worker health and queue drain |
| GD-REVERB-04 | stop/start Reverb | listener TCP health |
| GD-NET-05 | pause/unpause Laravel gateway | public health after unpause |
| GD-DISK-06 | bounded temporary container file | file removal and health |
| GD-CERT-07 | none | external public TLS validation and renewal evidence |

Native service-manager checks and real public-certificate checks are
external/manual requirements. The runner deliberately neither performs them
nor reports them as passed. Attach their operator evidence to the same release
or alpha record.
