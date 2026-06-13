/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ApiKeysSettings } from "./ApiKeysSettings.jsx";

function jsonRes(body, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

describe("ApiKeysSettings", () => {
  it("lists existing keys on mount (prefix only, no secret)", async () => {
    const fetchImpl = vi.fn(async () => jsonRes({
      ok: true,
      keys: [{ id: "k1", name: "WordPress", prefix: "ak_1a2b3c4d", scopes: ["read"] }],
    }));

    render(<ApiKeysSettings baseUrl="https://api.test" fetchImpl={fetchImpl} />);

    await waitFor(() => expect(screen.getByText("WordPress")).toBeInTheDocument());
    expect(screen.getByText(/ak_1a2b3c4d/)).toBeInTheDocument();
    expect(fetchImpl.mock.calls[0][0]).toBe("https://api.test/api/api-keys");
  });

  it("creates a key and reveals the plaintext exactly once", async () => {
    const fetchImpl = vi.fn(async (url, init) => {
      if (init?.method === "POST") {
        return jsonRes({ ok: true, apiKey: { id: "k9", name: "CI", prefix: "ak_99", scopes: ["read"], key: "ak_99_PLAINTEXTSECRET" } }, true, 201);
      }
      return jsonRes({ ok: true, keys: [] }); // list calls
    });

    render(<ApiKeysSettings baseUrl="https://api.test" fetchImpl={fetchImpl} />);

    fireEvent.click(screen.getByRole("button", { name: /إنشاء مفتاح/ }));
    fireEvent.change(screen.getByPlaceholderText(/اسم المفتاح/), { target: { value: "CI" } });
    fireEvent.click(screen.getByRole("button", { name: "إنشاء" }));

    // the one-time plaintext is shown
    await waitFor(() => expect(screen.getByText("ak_99_PLAINTEXTSECRET")).toBeInTheDocument());
    const postCall = fetchImpl.mock.calls.find((c) => c[1]?.method === "POST");
    expect(JSON.parse(postCall[1].body)).toMatchObject({ name: "CI", scopes: ["read"] });
  });

  it("revokes a key via DELETE", async () => {
    const fetchImpl = vi.fn(async (url, init) => {
      if (init?.method === "DELETE") return jsonRes({ ok: true });
      return jsonRes({ ok: true, keys: [{ id: "k1", name: "Old", prefix: "ak_dead", scopes: ["read"] }] });
    });

    render(<ApiKeysSettings baseUrl="https://api.test" fetchImpl={fetchImpl} />);
    await waitFor(() => expect(screen.getByText("Old")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /إبطال Old/ }));

    await waitFor(() => {
      const del = fetchImpl.mock.calls.find((c) => c[1]?.method === "DELETE");
      expect(del[0]).toBe("https://api.test/api/api-keys/k1");
    });
  });
});
