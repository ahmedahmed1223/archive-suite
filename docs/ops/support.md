# Operations and support

[العربية](rc-launch-and-support.md) · [Documentation](../README.md)

This guide explains how to receive and handle Masar operational incidents.
Reports must include the release version, affected role and route, approximate
time, reproducible steps, and redacted diagnostics. Never include passwords,
tokens, connection strings, or real archive content.

Start diagnosis with health, queue, and backup status before restarting a
service. Use a redacted support bundle where needed. A report closes only after
an identified owner records the fix and its retest result.

| Severity | Meaning | Initial response |
| --- | --- | --- |
| P0 | Data exposure, data loss, or total outage | Immediate containment |
| P1 | Essential workflow unavailable without a safe workaround | Within one business day |
| P2 | Non-critical issue with a clear workaround | Within three business days |
