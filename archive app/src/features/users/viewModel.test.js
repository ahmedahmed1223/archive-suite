import { describe, expect, test } from "vitest";

import {
  createInvitationMetadata,
  createTemporaryPassword,
  createUserValue,
  isValidInviteEmail
} from "./viewModel.js";

describe("users view model invitations", () => {
  test("validates invitation email shape", () => {
    expect(isValidInviteEmail("editor@example.com")).toBe(true);
    expect(isValidInviteEmail("bad-email")).toBe(false);
  });

  test("creates a bounded temporary password from injected entropy", () => {
    const password = createTemporaryPassword(12, (bytes) => bytes.fill(3));

    expect(password).toHaveLength(12);
    expect(password).toMatch(/^[A-Za-z0-9!@#$%]+$/);
  });

  test("stores invitation metadata on normalized user values", () => {
    const invitedAt = "2026-06-13T08:00:00.000Z";
    const metadata = createInvitationMetadata({
      email: " New.User@Example.COM ",
      invitedBy: "admin",
      now: () => invitedAt
    });
    const user = createUserValue({
      username: "new.user",
      displayName: "New User",
      role: "viewer",
      ...metadata
    });

    expect(user).toMatchObject({
      email: "new.user@example.com",
      inviteStatus: "pending",
      invitedAt,
      invitedBy: "admin",
      mustChangePassword: true
    });
  });
});
