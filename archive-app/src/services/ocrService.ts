import { getCloudToken } from "../bootstrap/cloudSession.js";

export async function extractTextFromImage(
  imageFile: Blob,
  { signal }: { signal?: AbortSignal } = {}
): Promise<unknown> {
  const formData = new FormData();
  formData.append("file", imageFile);

  const headers: Record<string, string> = {};
  const token = getCloudToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch("/api/ocr", {
    method: "POST",
    body: formData,
    signal,
    headers
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({} as Record<string, unknown>));
    throw new Error((error.error as string | undefined) || "فشل التعرف الضوئي على النص");
  }

  return await response.json();
}
