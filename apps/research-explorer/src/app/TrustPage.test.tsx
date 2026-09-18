import { afterEach, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "./App";
import type { DataProvider } from "../dataProvider/types";

const provider: DataProvider = {
  getManifest: () => Promise.reject(new Error("not used on trust pages")),
  listRecords: () => Promise.resolve([]),
  getRecord: () => Promise.reject(new Error("not used")),
  getEdges: () => Promise.resolve([]),
};

afterEach(() => window.history.replaceState(null, "", "/"));

it("renders the approved privacy surface without a data dependency", () => {
  window.history.replaceState(null, "", "/privacy");
  render(<App dataProvider={provider} />);

  expect(screen.getByRole("heading", { name: "Privacidade" })).toBeTruthy();
  expect(screen.getByText(/sem criar uma conta/)).toBeTruthy();
  expect(screen.getAllByRole("link", { name: "Correções" }).every((link) => link.getAttribute("href") === "/corrections")).toBe(true);
});

it("renders the owner-confirmed About accountability facts in the shared trust structure", () => {
  window.history.replaceState(null, "", "/about");
  render(<App dataProvider={provider} />);

  expect(screen.getByRole("heading", { name: "Sobre o Open Évora" })).toBeTruthy();
  expect(screen.getByText("Projeto Open Évora")).toBeTruthy();
  expect(screen.getByText("Projeto independente")).toBeTruthy();
  expect(screen.getByText("Autofinanciado")).toBeTruthy();
  expect(screen.getAllByRole("link", { name: "Sobre" }).some((link) => link.getAttribute("aria-current") === "page")).toBe(true);
  expect(screen.getAllByRole("link", { name: "Metodologia" }).every((link) => link.getAttribute("href") === "/methodology")).toBe(true);
});

it("renders the approved corrections action to the canonical public Issues page", () => {
  window.history.replaceState(null, "", "/corrections");
  render(<App dataProvider={provider} />);

  expect(screen.getByRole("heading", { name: "Correções" })).toBeTruthy();
  expect(screen.getByRole("link", { name: /GitHub Issues do projeto Open Évora/ }).getAttribute("href")).toBe("https://github.com/JoaomdvFerreira/open-evora/issues");
});
