import { describe, expect, it, vi } from "vitest";

import { createSftpFileStore } from "../index.js";

interface SftpClient {
  connect(opts: Record<string, unknown>): Promise<void>;
  end(): Promise<void>;
  mkdir(path: string, recursive: boolean): Promise<void>;
  put(data: Buffer, remote: string): Promise<void>;
  get(remote: string): Promise<Buffer | null>;
  delete(remote: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  stat(remote: string): Promise<{ size: number; modifyTime: number; isDirectory: boolean }>;
  list(path: string): Promise<Array<{ name: string; type: string; size: number; modifyTime: number }>>;
}

interface FakeSftpFile extends SftpClient {
  connect: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
  mkdir: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  rename: ReturnType<typeof vi.fn>;
  list: ReturnType<typeof vi.fn>;
  stat: ReturnType<typeof vi.fn>;
  _files: Map<string, Buffer>;
}

function fakeSftp(): FakeSftpFile {
  const files = new Map<string, Buffer>();
  const directories = new Set(["/archive"]);
  return {
    connect: vi.fn(async () => undefined),
    end: vi.fn(async () => undefined),
    mkdir: vi.fn(async (path) => directories.add(path as string)),
    put: vi.fn(async (value, path) => files.set(path as string, Buffer.from(value as Buffer))),
    get: vi.fn(async (path) => files.get(path as string) ?? null),
    delete: vi.fn(async (path) => files.delete(path as string)),
    rename: vi.fn(async (from, to) => { const f = files.get(from as string); if (f) { files.set(to as string, f); files.delete(from as string); } }),
    list: vi.fn(async (path) => [...files.entries()]
      .filter(([key]) => key.startsWith(`${path as string}/`))
      .map(([key, value]) => ({ name: key.slice((path as string).length + 1), type: "-", size: value.length, modifyTime: 1 }))),
    stat: vi.fn(async (path) => ({ size: (files.get(path as string)?.length || 0), modifyTime: 1, isDirectory: false })),
    _files: files
  };
}

describe("createSftpFileStore", () => {
  it("implements the file manager contract without exposing credentials", async () => {
    const client = fakeSftp();
    const store = createSftpFileStore({
      host: "sftp.local",
      username: "archive",
      password: "secret",
      root: "/archive",
      clientFactory: async () => client as unknown as SftpClient
    });

    await store.createFolder("raw");
    await store.putBlob("raw/a.txt", Buffer.from("a"));
    expect(await store.getBlob("raw/a.txt")).toEqual(Buffer.from("a"));
    expect(await store.list("raw")).toEqual(["raw/a.txt"]);
    await store.move("raw/a.txt", "done/a.txt");
    expect(await store.getBlob("done/a.txt")).toEqual(Buffer.from("a"));
    await store.remove("done/a.txt");
    expect(await store.getBlob("done/a.txt")).toBeNull();
    expect(store.describe()).toMatchObject({ kind: "sftp", host: "sftp.local", configured: true });
    expect(JSON.stringify(store.describe())).not.toContain("secret");
  });

  it("rejects traversal", async () => {
    const store = createSftpFileStore({ host: "h", username: "u", password: "p", clientFactory: async () => fakeSftp() as unknown as SftpClient });
    await expect(store.putBlob("../secret", Buffer.from("x"))).rejects.toThrow(/Invalid file key/i);
  });
});
