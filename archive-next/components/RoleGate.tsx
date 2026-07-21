"use client";

import type { ReactNode } from "react";
import { useAuthSession } from "@/lib/auth-session";
import { can, type Capability } from "@/lib/role-capabilities";

export function useCapability(capability: Capability): boolean {
  const { user } = useAuthSession();
  return can(user?.role, capability);
}

type Props = {
  capability: Capability;
  children: ReactNode;
  fallback?: ReactNode;
};

export default function RoleGate({ capability, children, fallback }: Props) {
  const allowed = useCapability(capability);
  return <>{allowed ? children : (fallback ?? null)}</>;
}
