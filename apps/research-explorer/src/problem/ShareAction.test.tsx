import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../presentation/Toast";
import { ShareAction } from "./ShareAction";

function renderShare() {
  return render(<ToastProvider><ShareAction title="Registo sintético" /></ToastProvider>);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ShareAction feedback", () => {
  it("shows affirmed feedback after native share succeeds", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, share });
    renderShare();
    fireEvent.click(screen.getByRole("button", { name: "Partilhar" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Ligação partilhada."));
    expect(share).toHaveBeenCalledWith({ title: "Registo sintético", url: window.location.href });
  });

  it("shows no feedback when native share is cancelled", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("Cancelado", "AbortError"));
    vi.stubGlobal("navigator", { ...navigator, share });
    renderShare();
    fireEvent.click(screen.getByRole("button", { name: "Partilhar" }));
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows error feedback when native share fails", async () => {
    vi.stubGlobal("navigator", { ...navigator, share: vi.fn().mockRejectedValue(new Error("indisponível")) });
    renderShare();
    fireEvent.click(screen.getByRole("button", { name: "Partilhar" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Não foi possível partilhar a ligação."));
  });

  it("shows affirmed feedback after clipboard copy succeeds", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, share: undefined, clipboard: { writeText } });
    renderShare();
    fireEvent.click(screen.getByRole("button", { name: "Partilhar" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Ligação copiada."));
    expect(writeText).toHaveBeenCalledWith(window.location.href);
  });

  it("shows error feedback when clipboard copy fails", async () => {
    vi.stubGlobal("navigator", { ...navigator, share: undefined, clipboard: { writeText: vi.fn().mockRejectedValue(new Error("bloqueado")) } });
    renderShare();
    fireEvent.click(screen.getByRole("button", { name: "Partilhar" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Não foi possível copiar a ligação."));
  });

  it("has no local duplicate live region or obsolete description", () => {
    const { container } = renderShare();
    const button = screen.getByRole("button", { name: "Partilhar" });
    expect(button.hasAttribute("aria-describedby")).toBe(false);
    expect(container.querySelector("#problem-share-status")).toBeNull();
    expect(container.querySelector("[aria-live]")).toBeNull();
  });
});
