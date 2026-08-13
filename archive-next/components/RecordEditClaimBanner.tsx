"use client";

import { useEffect, useMemo, useState } from "react";
import { createArchiveApiClient, type RecordEditClaim } from "@/lib/archive-api";
import { useAuthSession } from "@/lib/auth-session";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { getEchoClient } from "@/lib/echo";

// RT-804: renews our own claim (or picks one up if free) every 2 minutes —
// well under the backend's 5-minute TTL (RecordEditClaimController) — and
// never overwrites another user's active claim. Purely informational: it
// never blocks a save, it just tells you someone else is also in here.
const CLAIM_RENEW_INTERVAL_MS = 2 * 60 * 1000;

export default function RecordEditClaimBanner({ recordId }: Readonly<{ recordId: string }>) {
  const { t } = useLocale();
  const copy = t.pages.archiveDetail.recordEditClaim;
  const { user, accessToken } = useAuthSession();
  const api = useMemo(() => createArchiveApiClient(), []);
  const [claim, setClaim] = useState<RecordEditClaim | null>(null);

  useEffect(() => {
    let active = true;
    let heldByMe = false;

    const tick = async () => {
      const response = await api.recordEditClaim(recordId);
      if (!active || !response.ok) return;

      if (!response.claim || response.claim.claimedBy === user?.id) {
        const claimed = await api.claimRecordEdit(recordId);
        if (active && claimed.ok) {
          setClaim(claimed.claim);
          heldByMe = true;
        }
      } else {
        setClaim(response.claim);
        heldByMe = false;
      }
    };

    void tick();
    const interval = window.setInterval(() => void tick(), CLAIM_RENEW_INTERVAL_MS);

    return () => {
      active = false;
      window.clearInterval(interval);
      if (heldByMe) void api.releaseRecordEditClaim(recordId);
    };
  }, [api, recordId, user?.id]);

  useEffect(() => {
    const echo = getEchoClient({ accessToken });
    if (!echo) return;

    const channelName = `record-edit.${recordId}`;
    echo.private(channelName).listen(".record-edit.changed", (event: { claim: RecordEditClaim | null }) => {
      setClaim(event.claim);
    });

    return () => echo.leave(channelName);
  }, [accessToken, recordId]);

  if (!claim || claim.claimedBy === user?.id) return null;

  return (
    <div className="state-banner state-banner-info" role="status">
      {copy.othersEditing.replace("{name}", claim.claimedByName)}
    </div>
  );
}
