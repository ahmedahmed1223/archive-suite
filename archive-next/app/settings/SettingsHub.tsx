"use client";

import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useAuthSession } from "@/lib/auth-session";
import { useExperienceProfile } from "@/lib/experience-profile-context";
import AdministrationSection from "./AdministrationSection";
import MyExperienceSection from "./MyExperienceSection";
import MediaSection from "./MediaSection";
import NotificationsSection from "./NotificationsSection";
import PresetsSection from "./PresetsSection";
import NavigationCustomizationSection from "./NavigationCustomizationSection";
import ViewCustomizationSection from "./ViewCustomizationSection";

export default function SettingsHub() {
  const { t } = useLocale();
  const { user } = useAuthSession();
  const profile = useExperienceProfile();
  const copy = t.pages.settings.hub;
  // Client-side gate mirrors the codebase-wide convention (see WorkspaceCommandBar,
  // first-run, safety-preview). The real authorization boundary is server-side:
  // the PATCH endpoint rejects non-admin writes regardless of what renders here,
  // and per-capability `editable` already comes back false for non-admins.
  const isAdmin = user?.role === "admin";

  return (
    <article className="workspace-panel settings-hub" aria-label={copy.ariaLabel}>
      <div className="workspace-panel__header">
        <div>
          <h2>{copy.heading}</h2>
          <p>{copy.description}</p>
        </div>
      </div>

      {profile.status === "loading" && (
        <p className="helper-text" role="status">
          {copy.loading}
        </p>
      )}

      {profile.status === "fallback" && (
        <div className="state-banner state-banner-error" role="alert">
          <strong>{copy.fallbackTitle}</strong>
          <p className="helper-text">{profile.capabilitiesError || profile.experienceError || copy.fallbackDescription}</p>
          <button type="button" className="button button-secondary button-small" onClick={profile.retryLoad}>
            {copy.retry}
          </button>
        </div>
      )}

      {profile.writeConflict && (
        <div className="state-banner state-banner-info" role="alert">
          <strong>{copy.writeConflictTitle}</strong>
          <p className="helper-text">{profile.writeConflict.message}</p>
          <button type="button" className="button button-secondary button-small" onClick={profile.clearWriteConflict}>
            {copy.dismiss}
          </button>
        </div>
      )}

      <div className="settings-hub__sections">
        {isAdmin && <AdministrationSection capabilities={profile.capabilities} onUpdate={profile.updateCapabilities} />}
        <PresetsSection onUpdate={profile.updateExperience} />
        <MyExperienceSection experience={profile.experience} onUpdate={profile.updateExperience} />
        <NavigationCustomizationSection experience={profile.experience} capabilities={profile.capabilities} onUpdate={profile.updateExperience} />
        <MediaSection experience={profile.experience} capabilities={profile.capabilities} onUpdate={profile.updateExperience} />
        <ViewCustomizationSection experience={profile.experience} onUpdate={profile.updateExperience} />
        <NotificationsSection experience={profile.experience} onUpdate={profile.updateExperience} />
      </div>
    </article>
  );
}
