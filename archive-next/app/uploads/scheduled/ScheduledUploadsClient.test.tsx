// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ConfirmDialogProvider } from "@/components/ui/ConfirmDialog";

const {
  scheduledUploads,
  cancelScheduledUpload,
  retryScheduledUpload,
  rescheduleScheduledUpload
} = vi.hoisted(() => ({
  scheduledUploads: vi.fn(),
  cancelScheduledUpload: vi.fn(),
  retryScheduledUpload: vi.fn(),
  rescheduleScheduledUpload: vi.fn()
}));

vi.mock("@/lib/archive-api", () => ({
  createArchiveApiClient: () => ({
    scheduledUploads,
    cancelScheduledUpload,
    retryScheduledUpload,
    rescheduleScheduledUpload
  })
}));

import ScheduledUploadsClient from "./ScheduledUploadsClient";

function renderClient() {
  return render(
    <ConfirmDialogProvider>
      <ScheduledUploadsClient />
    </ConfirmDialogProvider>
  );
}

function schedule(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "sched-1",
    fileName: "clip.mp4",
    title: "مقابلة",
    status: "scheduled",
    scheduledAt: "2026-08-01T10:00:00.000Z",
    timeZone: "Europe/Istanbul",
    attempts: 0,
    failureCode: null,
    failureMessage: null,
    recordId: null,
    version: 1,
    createdAt: "2026-07-19T10:00:00.000Z",
    updatedAt: "2026-07-19T10:00:00.000Z",
    canReschedule: true,
    canCancel: true,
    canRetry: false,
    ...overrides
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ScheduledUploadsClient", () => {
  test("renders the empty state when there are no schedules", async () => {
    scheduledUploads.mockResolvedValue({ ok: true, schedules: [], nextCursor: null });
    renderClient();

    expect(await screen.findByText(/لا توجد رفعات مجدولة/)).toBeInTheDocument();
  });

  test("renders the error state when the initial fetch fails", async () => {
    scheduledUploads.mockResolvedValue({ ok: false, error: "تعذر الاتصال." });
    renderClient();

    expect(await screen.findByText("تعذر الاتصال.")).toBeInTheDocument();
  });

  test("lists schedules and filters by status tab", async () => {
    scheduledUploads.mockResolvedValue({
      ok: true,
      schedules: [
        schedule({ id: "s1", fileName: "one.mp4", status: "scheduled" }),
        schedule({ id: "s2", fileName: "two.mp4", status: "completed", recordId: "rec-2", canReschedule: false, canCancel: false })
      ],
      nextCursor: null
    });
    renderClient();

    expect(await screen.findByText("one.mp4")).toBeInTheDocument();
    expect(screen.getByText("two.mp4")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "مكتملة" }));

    expect(screen.queryByText("one.mp4")).not.toBeInTheDocument();
    expect(screen.getByText("two.mp4")).toBeInTheDocument();
  });

  test("filters by filename/title search", async () => {
    scheduledUploads.mockResolvedValue({
      ok: true,
      schedules: [schedule({ id: "s1", fileName: "clip.mp4" }), schedule({ id: "s2", fileName: "archive.mov", title: "توثيق" })],
      nextCursor: null
    });
    renderClient();

    await screen.findByText("clip.mp4");
    fireEvent.change(screen.getByLabelText("بحث بالملف أو العنوان"), { target: { value: "توثيق" } });

    expect(screen.queryByText("clip.mp4")).not.toBeInTheDocument();
    expect(screen.getByText("archive.mov")).toBeInTheDocument();
  });

  test("shows a record link only for completed schedules", async () => {
    scheduledUploads.mockResolvedValue({
      ok: true,
      schedules: [
        schedule({ id: "s1", status: "scheduled" }),
        schedule({ id: "s2", fileName: "done.mp4", status: "completed", recordId: "rec-9", canReschedule: false, canCancel: false })
      ],
      nextCursor: null
    });
    renderClient();

    await screen.findByText("done.mp4");
    const link = screen.getByRole("link", { name: /فتح السجل/ });
    expect(link).toHaveAttribute("href", "/archive/rec-9");
  });

  test("only offers actions the API marks as available", async () => {
    scheduledUploads.mockResolvedValue({
      ok: true,
      schedules: [schedule({ id: "s1", status: "failed", failureCode: "infrastructure_timeout", canReschedule: false, canCancel: false, canRetry: true })],
      nextCursor: null
    });
    renderClient();

    await screen.findByText("clip.mp4");
    expect(screen.queryByRole("button", { name: "إعادة الجدولة" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "إلغاء" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "إعادة المحاولة" })).toBeInTheDocument();
  });

  test("cancelling asks for confirmation and calls the API", async () => {
    scheduledUploads.mockResolvedValue({ ok: true, schedules: [schedule()], nextCursor: null });
    cancelScheduledUpload.mockResolvedValue({ ok: true, schedule: schedule({ status: "cancelled" }) });
    renderClient();

    await screen.findByText("clip.mp4");
    fireEvent.click(screen.getByRole("button", { name: "إلغاء" }));

    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "إلغاء الجدولة" }));

    await waitFor(() => expect(cancelScheduledUpload).toHaveBeenCalledWith("sched-1"));
  });

  test("retrying calls the API directly without a confirmation dialog", async () => {
    scheduledUploads.mockResolvedValue({
      ok: true,
      schedules: [schedule({ status: "failed", failureCode: "infrastructure_timeout", canReschedule: false, canCancel: false, canRetry: true })],
      nextCursor: null
    });
    retryScheduledUpload.mockResolvedValue({ ok: true, schedule: schedule({ status: "scheduled" }) });
    renderClient();

    await screen.findByText("clip.mp4");
    fireEvent.click(screen.getByRole("button", { name: "إعادة المحاولة" }));

    await waitFor(() => expect(retryScheduledUpload).toHaveBeenCalledWith("sched-1"));
  });

  test("a reschedule conflict refreshes the list instead of silently failing", async () => {
    scheduledUploads.mockResolvedValue({ ok: true, schedules: [schedule()], nextCursor: null });
    rescheduleScheduledUpload.mockResolvedValue({ ok: false, error: "تغيّرت الجدولة في الخلفية.", code: "stale_version" });
    renderClient();

    await screen.findByText("clip.mp4");
    fireEvent.click(screen.getByRole("button", { name: "إعادة الجدولة" }));

    const input = await screen.findByLabelText("موعد المعالجة الجديد");
    fireEvent.change(input, { target: { value: "2026-09-01T09:00" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ الموعد الجديد" }));

    await waitFor(() => expect(rescheduleScheduledUpload).toHaveBeenCalled());
    // refetch after the conflict
    await waitFor(() => expect(scheduledUploads).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("تغيّرت الجدولة في الخلفية.")).toBeInTheDocument();
  });
});
