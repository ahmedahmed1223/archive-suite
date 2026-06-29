import { ArrowLeft, Check, Route, Shield, Sparkles, Users } from "lucide-react";
import * as React from "react";

import { ROLE_PROFILES, getRoleProfile, normalizeRoleProfileId } from "../../features/onboarding/roleProfiles.js";

const ICONS = {
  admin: Shield,
  editor: Sparkles,
  viewer: Users
};

export function RoleSelectionStep({
  value = "editor",
  onChange,
  onOpenPage,
  compact = false,
  className = ""
}: any) {
  const selectedId = normalizeRoleProfileId(value);
  const selectedProfile = getRoleProfile(selectedId);

  return (
    <section className={`space-y-4 text-right ${className}`} dir="rtl">
      {!compact && (
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-base-200 px-3 py-1 text-xs text-base-content/70">
            <Route className="h-4 w-4" aria-hidden="true" />
            تخصيص واجهي لا يغير الصلاحيات
          </div>
          <h2 className="text-xl font-bold text-base-content">كيف تريد استخدام الأرشيف؟</h2>
          <p className="text-sm leading-7 text-base-content/70">
            يحدد هذا الاختيار ترتيب المسارات المقترحة والأدوات المبرزة، بينما تبقى الصلاحيات الحقيقية من حساب المستخدم.
          </p>
        </div>
      )}

      <div className="grid auto-rows-fr gap-3 lg:grid-cols-3">
        {ROLE_PROFILES.map((profile: any) => {
          const Icon = (ICONS as any)[profile.id] || Sparkles;
          const active = profile.id === selectedId;
          return (
            <button
              key={profile.id}
              type="button"
              className={`card card-border bg-base-100 text-right text-base-content transition hover:border-primary/40 ${active ? "border-primary bg-primary/10" : "border-base-300"}`}
              onClick={() => onChange?.(profile.id)}
              aria-pressed={active}
            >
              <div className="card-body gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${active ? "border-primary/40 bg-primary text-primary-content" : "border-base-300 bg-base-200"}`}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  {active ? <Check className="h-5 w-5 text-primary" aria-hidden="true" /> : null}
                </div>
                <div>
                  <h3 className="card-title justify-start text-base">{profile.label}</h3>
                  <span className="badge badge-soft badge-sm mt-2">{profile.badge}</span>
                  <p className="mt-3 text-sm leading-7 text-base-content/70">{profile.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="card card-border bg-base-100 text-base-content">
        <div className="card-body gap-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold">مسارك المقترح: {selectedProfile.label}</h3>
              <p className="mt-1 text-sm text-base-content/70">{selectedProfile.description}</p>
            </div>
            <span className="badge badge-primary badge-soft">{selectedProfile.badge}</span>
          </div>
          <ul className="steps steps-vertical lg:steps-horizontal">
            {selectedProfile.steps.map((step: any) => (
              <li key={step.id} className="step step-primary" data-content="✓">
                <span className="font-semibold">{step.label}</span>
              </li>
            ))}
          </ul>
          <div className="grid gap-2 sm:grid-cols-3">
            {selectedProfile.steps.map((step: any) => (
              <button
                key={step.id}
                type="button"
                className="btn btn-sm btn-outline justify-between"
                onClick={() => onOpenPage?.(step.page)}
              >
                <span className="truncate">{step.label}</span>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default RoleSelectionStep;
