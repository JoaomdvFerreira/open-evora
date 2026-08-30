import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProgressMessage } from "./ProgressMessage";
import { ErrorNotice } from "./ErrorNotice";

describe("ProgressMessage", () => {
  it("exposes role=status/aria-live=polite and the exact caller-supplied copy", () => {
    render(<ProgressMessage message="A carregar registos…" />);
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toBe("A carregar registos…");
  });
});

describe("ErrorNotice", () => {
  it("exposes role=alert with the exact caller-supplied title/message and no invented action", () => {
    render(<ErrorNotice title="Falha ao carregar" message="Erro de rede." />);
    const alert = screen.getByRole("alert");
    expect(screen.getByText("Falha ao carregar")).toBeTruthy();
    expect(screen.getByText("Erro de rede.")).toBeTruthy();
    expect(alert.querySelector("button")).toBeNull();
  });

  it("fires a caller-owned retry action exactly once per click", async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(
      <ErrorNotice
        title="Falha ao carregar"
        message="Erro de rede."
        action={
          <button type="button" onClick={onRetry}>
            Tentar novamente
          </button>
        }
      />
    );
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
