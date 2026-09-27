import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast, type ToastTone } from "./Toast";

function Trigger({ message, tone }: { message: string; tone: ToastTone }) {
  const { notify } = useToast();
  return <button type="button" onClick={() => notify(message, tone)}>Notificar</button>;
}

function renderTrigger(message = "Mensagem exata.", tone: ToastTone = "neutral") {
  return render(<ToastProvider><Trigger message={message} tone={tone} /></ToastProvider>);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("Toast", () => {
  it("uses polite status semantics and preserves the exact caller message for affirmed feedback", () => {
    renderTrigger("Ligação copiada.", "affirmed");
    fireEvent.click(screen.getByRole("button", { name: "Notificar" }));
    expect(screen.getByRole("status").textContent).toBe("Ligação copiada.");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("uses polite status semantics for neutral feedback", () => {
    renderTrigger("Transferência iniciada.", "neutral");
    fireEvent.click(screen.getByRole("button", { name: "Notificar" }));
    expect(screen.getByRole("status").textContent).toBe("Transferência iniciada.");
  });

  it("uses alert semantics for error feedback", () => {
    renderTrigger("Não foi possível copiar a ligação.", "error");
    fireEvent.click(screen.getByRole("button", { name: "Notificar" }));
    expect(screen.getByRole("alert").textContent).toBe("Não foi possível copiar a ligação.");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("auto-dismisses affirmed and neutral feedback after four seconds and errors after six", () => {
    vi.useFakeTimers();
    const { unmount } = renderTrigger("Confirmado.", "affirmed");
    fireEvent.click(screen.getByRole("button", { name: "Notificar" }));
    act(() => vi.advanceTimersByTime(3_999));
    expect(screen.getByRole("status")).toBeTruthy();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole("status")).toBeNull();
    unmount();

    renderTrigger("Falhou.", "error");
    fireEvent.click(screen.getByRole("button", { name: "Notificar" }));
    act(() => vi.advanceTimersByTime(5_999));
    expect(screen.getByRole("alert")).toBeTruthy();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("dismisses manually", () => {
    renderTrigger();
    const trigger = screen.getByRole("button", { name: "Notificar" });
    fireEvent.click(trigger);
    const close = screen.getByRole("button", { name: "Fechar notificação" });
    fireEvent.click(close);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("replaces the visible notification instead of stacking", () => {
    function ReplacementHarness() {
      const { notify } = useToast();
      return <><button type="button" onClick={() => notify("Primeira.", "neutral")}>Primeira</button><button type="button" onClick={() => notify("Segunda.", "error")}>Segunda</button></>;
    }
    render(<ToastProvider><ReplacementHarness /></ToastProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Primeira" }));
    fireEvent.click(screen.getByRole("button", { name: "Segunda" }));
    expect(screen.queryByText("Primeira.")).toBeNull();
    expect(screen.getByRole("alert").textContent).toBe("Segunda.");
    expect(screen.getAllByRole("button", { name: "Fechar notificação" })).toHaveLength(1);
  });

  it("restarts the lifetime when the same notification is repeated", () => {
    vi.useFakeTimers();
    renderTrigger("Repetida.", "neutral");
    const trigger = screen.getByRole("button", { name: "Notificar" });
    fireEvent.click(trigger);
    act(() => vi.advanceTimersByTime(3_000));
    fireEvent.click(trigger);
    act(() => vi.advanceTimersByTime(3_000));
    expect(screen.getByRole("status").textContent).toBe("Repetida.");
    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.queryByRole("status")).toBeNull();
  });
});
