import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DataLoadError } from "../dataProvider/types";
import { ErrorNotice } from "./ErrorNotice";
import { dataLoadRecovery } from "./dataLoadRecovery";

describe("data load recovery", () => {
  const originalLocation = window.location;
  afterEach(() => Object.defineProperty(window, "location", { configurable: true, value: originalLocation }));
  it("requires explicit reload for a read-model version mismatch", () => {
    const reload = vi.fn();
    Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, reload } });
    const recovery = dataLoadRecovery(new DataLoadError("", "version_mismatch"), vi.fn());
    render(<ErrorNotice title="Os dados mudaram" message={recovery.message} action={recovery.action} />);

    expect(screen.getByText("Os dados publicados foram atualizados. Recarregue a página antes de continuar.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Recarregar página" }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("keeps ordinary network failures on the retry path", () => {
    const retry = vi.fn();
    const recovery = dataLoadRecovery(new DataLoadError("Falha temporária.", "network"), retry);
    render(<ErrorNotice title="Falha ao carregar" message={recovery.message} action={recovery.action} />);

    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Recarregar página" })).toBeNull();
  });
});
