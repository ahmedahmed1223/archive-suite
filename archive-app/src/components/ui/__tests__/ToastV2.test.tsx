/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToastV2, ToastContainer } from "../ToastV2.jsx";
import { renderHook } from "@testing-library/react";
import { useToast } from "../../../hooks/useToast.js";

// Silence framer-motion in jsdom — it doesn't need real animation
vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      div: ({ children, ...rest }: React.HTMLAttributes<HTMLDivElement> & {
        children?: React.ReactNode;
        initial?: unknown;
        animate?: unknown;
        exit?: unknown;
        transition?: unknown;
        variants?: unknown;
      }) => {
        const { initial, animate, exit, transition, variants, ...domProps } = rest;
        return <div {...domProps}>{children}</div>;
      },
    },
  };
});

describe("ToastV2 component", () => {
  it("renders the message text", () => {
    render(<ToastV2 message="تم الحفظ بنجاح" variant="success" onClose={vi.fn()} />);
    expect(screen.getByText("تم الحفظ بنجاح")).toBeInTheDocument();
  });

  it("has role=alert for accessibility", () => {
    render(<ToastV2 message="رسالة" variant="info" onClose={vi.fn()} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("uses aria-live=assertive for error variant", () => {
    render(<ToastV2 message="خطأ" variant="error" onClose={vi.fn()} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("aria-live", "assertive");
  });

  it("uses aria-live=polite for non-error variants", () => {
    render(<ToastV2 message="معلومة" variant="info" onClose={vi.fn()} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveAttribute("aria-live", "polite");
  });

  it("renders close button and calls onClose on click", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ToastV2 message="رسالة" variant="success" onClose={onClose} />);
    const closeBtn = screen.getByRole("button");
    await user.click(closeBtn);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("applies success variant styling class", () => {
    render(<ToastV2 message="ناجح" variant="success" onClose={vi.fn()} />);
    const alert = screen.getByRole("alert");
    expect(alert.className).toMatch(/va-status-success/);
  });

  it("applies error variant styling class", () => {
    render(<ToastV2 message="خطأ" variant="error" onClose={vi.fn()} />);
    const alert = screen.getByRole("alert");
    expect(alert.className).toMatch(/va-status-danger/);
  });

  it("applies warning variant styling class", () => {
    render(<ToastV2 message="تحذير" variant="warning" onClose={vi.fn()} />);
    const alert = screen.getByRole("alert");
    expect(alert.className).toMatch(/va-status-warning/);
  });

  it("applies info variant styling class", () => {
    render(<ToastV2 message="معلومة" variant="info" onClose={vi.fn()} />);
    const alert = screen.getByRole("alert");
    expect(alert.className).toMatch(/va-status-info/);
  });

  it("auto-dismisses after duration ms", async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<ToastV2 message="رسالة" variant="info" onClose={onClose} duration={2000} />);
    expect(onClose).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(2000));
    expect(onClose).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it("does not auto-dismiss when duration=0", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<ToastV2 message="رسالة" variant="info" onClose={onClose} duration={0} />);
    act(() => vi.advanceTimersByTime(10000));
    expect(onClose).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("dismisses via Escape key", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ToastV2 message="رسالة" variant="info" onClose={onClose} />);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("useToast hook", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with no toasts", () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.toasts).toHaveLength(0);
  });

  it("showToast adds a toast to the queue", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.showToast({ message: "نجح", variant: "success" });
    });
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe("نجح");
    expect(result.current.toasts[0].variant).toBe("success");
  });

  it("caps active toasts at 3, dismissing oldest", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.showToast({ message: "أول" });
      result.current.showToast({ message: "ثاني" });
      result.current.showToast({ message: "ثالث" });
      result.current.showToast({ message: "رابع" });
    });
    expect(result.current.toasts).toHaveLength(3);
    // oldest (أول) should have been dropped
    const messages = result.current.toasts.map((t) => t.message);
    expect(messages).not.toContain("أول");
  });

  it("dismissToast removes a toast by id", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.showToast({ message: "رسالة" });
    });
    const id = result.current.toasts[0].id;
    act(() => {
      result.current.dismissToast(id);
    });
    expect(result.current.toasts).toHaveLength(0);
  });

  it("auto-dismisses toast after duration", () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.showToast({ message: "زوالي", duration: 1000 });
    });
    expect(result.current.toasts).toHaveLength(1);
    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.toasts).toHaveLength(0);
  });
});
