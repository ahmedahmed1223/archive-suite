// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import RoleGate, { useCapability } from "@/components/RoleGate";

const mockUseAuthSession = vi.fn();

vi.mock("@/lib/auth-session", () => ({
  useAuthSession: () => mockUseAuthSession()
}));

function CapabilityProbe({
  capability
}: {
  capability: "records.edit" | "users.manage" | "system.control" | "backup.manage";
}) {
  const allowed = useCapability(capability);
  return <span>{allowed ? "allowed" : "denied"}</span>;
}

afterEach(() => {
  cleanup();
  mockUseAuthSession.mockReset();
});

describe("RoleGate", () => {
  test("renders children when the role has the capability", () => {
    mockUseAuthSession.mockReturnValue({ user: { role: "admin" } });

    render(
      <RoleGate capability="records.edit">
        <span>secret content</span>
      </RoleGate>
    );

    expect(screen.getByText("secret content")).toBeTruthy();
  });

  test("renders the fallback when the role lacks the capability", () => {
    mockUseAuthSession.mockReturnValue({ user: { role: "viewer" } });

    render(
      <RoleGate capability="records.bulkDelete" fallback={<span>no access</span>}>
        <span>secret content</span>
      </RoleGate>
    );

    expect(screen.queryByText("secret content")).toBeNull();
    expect(screen.getByText("no access")).toBeTruthy();
  });

  test("renders nothing when denied and no fallback is given", () => {
    mockUseAuthSession.mockReturnValue({ user: { role: "viewer" } });

    const { container } = render(
      <RoleGate capability="records.bulkDelete">
        <span>secret content</span>
      </RoleGate>
    );

    expect(container.textContent).toBe("");
  });

  test("useCapability reflects role capability via a probe component", () => {
    mockUseAuthSession.mockReturnValue({ user: { role: "editor" } });

    render(<CapabilityProbe capability="records.edit" />);
    expect(screen.getByText("allowed")).toBeTruthy();
  });

  test("useCapability denies when role lacks the capability", () => {
    mockUseAuthSession.mockReturnValue({ user: { role: "editor" } });

    render(<CapabilityProbe capability="users.manage" />);
    expect(screen.getByText("denied")).toBeTruthy();
  });

  test("admin renders admin-only content gated by users.manage", () => {
    mockUseAuthSession.mockReturnValue({ user: { role: "admin" } });

    render(
      <RoleGate capability="users.manage">
        <span>user administration</span>
      </RoleGate>
    );

    expect(screen.getByText("user administration")).toBeTruthy();
  });

  test("editor is denied admin-only capabilities not granted to editor", () => {
    mockUseAuthSession.mockReturnValue({ user: { role: "editor" } });

    render(
      <RoleGate capability="system.control" fallback={<span>no access</span>}>
        <span>system controls</span>
      </RoleGate>
    );

    expect(screen.queryByText("system controls")).toBeNull();
    expect(screen.getByText("no access")).toBeTruthy();
  });

  test("useCapability grants admin every capability, including system.control and backup.manage", () => {
    mockUseAuthSession.mockReturnValue({ user: { role: "admin" } });

    render(<CapabilityProbe capability="system.control" />);
    expect(screen.getByText("allowed")).toBeTruthy();

    cleanup();
    mockUseAuthSession.mockReturnValue({ user: { role: "admin" } });
    render(<CapabilityProbe capability="backup.manage" />);
    expect(screen.getByText("allowed")).toBeTruthy();
  });
});
