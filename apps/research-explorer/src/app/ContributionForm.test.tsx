import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContributionForm, contributionIssueContent, contributionIssueUrl, isPrefilledIssueUrlEligible, MAX_PREFILLED_ISSUE_URL_LENGTH, prefilledIssueUrl } from "./ContributionForm";
import { ToastProvider } from "../presentation/Toast";

function renderForm(initialSearch = "") {
  return render(<ToastProvider><ContributionForm initialSearch={initialSearch} /></ToastProvider>);
}

const problemOption = () => screen.getByRole("radio", { name: "Sugerir um problema" }) as HTMLInputElement;
const evidenceOption = () => screen.getByRole("radio", { name: "Contribuir para um problema existente" }) as HTMLInputElement;
const problemIdField = () => screen.queryByRole("textbox", { name: /Problema relacionado/ }) as HTMLInputElement | null;
const submit = () => screen.getByRole("button", { name: "Preparar issue no GitHub" });

function issueParams(url: string) {
  const parsed = new URL(url);
  return { origin: `${parsed.origin}${parsed.pathname}`, title: parsed.searchParams.get("title"), body: parsed.searchParams.get("body") };
}

afterEach(() => vi.restoreAllMocks());

describe("ContributionForm — fields and prefill", () => {
  it("starts with no contribution type selected, no related-problem field and empty text fields", () => {
    renderForm();
    expect(problemOption().checked).toBe(false);
    expect(evidenceOption().checked).toBe(false);
    expect(problemIdField()).toBeNull();
    expect((screen.getByRole("textbox", { name: /Resumo/ }) as HTMLInputElement).value).toBe("");
    expect((screen.getByRole("textbox", { name: /Descrição/ }) as HTMLTextAreaElement).value).toBe("");
    expect((screen.getByRole("textbox", { name: /Fonte ou ligação/ }) as HTMLInputElement).required).toBe(false);
  });

  it("groups the contribution type as a labelled fieldset of required radios", () => {
    renderForm();
    const group = screen.getByRole("group", { name: /Tipo de contribuição/ });
    expect(group.tagName).toBe("FIELDSET");
    expect(problemOption().required).toBe(true);
    expect(evidenceOption().required).toBe(true);
  });

  it("collects no name, email, phone, address or other personal identifier", () => {
    const { container } = renderForm();
    expect(screen.getAllByRole("textbox").map((field) => field.getAttribute("id") && document.querySelector(`label[for="${field.id}"]`)?.textContent))
      .toEqual(["Resumo (obrigatório)", "Descrição (obrigatório)", "Fonte ou ligação (opcional)"]);
    expect(container.querySelector('input[type="email"], input[type="tel"], [autocomplete~="name"], [autocomplete~="email"], [autocomplete~="tel"], [autocomplete*="address"]')).toBeNull();
    expect(container.textContent).not.toMatch(/\b(nome|e-?mail|telefone|morada)\b/i);
  });

  it("preselects a problem suggestion from ?type=problem", () => {
    renderForm("?type=problem");
    expect(problemOption().checked).toBe(true);
    expect(problemIdField()).toBeNull();
  });

  it("preselects an existing-problem contribution and prefills the PRB from ?type=evidence&prb=", () => {
    renderForm("?type=evidence&prb=PRB-0005");
    expect(evidenceOption().checked).toBe(true);
    expect(problemIdField()?.value).toBe("PRB-0005");
  });

  it.each([
    ["an unknown type", "?type=admin&prb=PRB-0005"],
    ["a non-canonical PRB ID", "?type=evidence&prb=<script>"],
    ["a PRB without an evidence type", "?prb=PRB-0005"],
  ])("ignores %s safely", (_label, search) => {
    renderForm(search);
    if (search.includes("type=evidence")) {
      expect(evidenceOption().checked).toBe(true);
      expect(problemIdField()?.value).toBe("");
    } else {
      expect(problemOption().checked).toBe(false);
      expect(evidenceOption().checked).toBe(false);
      expect(problemIdField()).toBeNull();
    }
  });

  it("does not write form state back to the URL", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/contact?type=problem");
    renderForm("?type=problem");
    await user.click(evidenceOption());
    await user.type(screen.getByRole("textbox", { name: /Resumo/ }), "Resumo");
    expect(window.location.search).toBe("?type=problem");
    window.history.replaceState(null, "", "/");
  });
});

describe("ContributionForm — validation", () => {
  it("shows inline errors linked to each missing required field, without opening GitHub or toasting", async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, "open");
    renderForm();
    await user.click(submit());

    expect(open).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("Escolha o tipo de contribuição.")).toBeTruthy();
    expect(problemOption().getAttribute("aria-describedby")).toBe(screen.getByText("Escolha o tipo de contribuição.").id);
    for (const [name, message] of [[/Resumo/, "Escreva um resumo."], [/Descrição/, "Descreva a contribuição."]] as const) {
      const field = screen.getByRole("textbox", { name });
      expect(field.getAttribute("aria-invalid")).toBe("true");
      expect(field.getAttribute("aria-describedby")).toBe(screen.getByText(message).id);
    }
  });

  it("focuses the first invalid control and exposes invalid radio state after submission", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(submit());
    expect(document.activeElement).toBe(problemOption());
    expect(problemOption().getAttribute("aria-invalid")).toBe("true");
    expect(evidenceOption().getAttribute("aria-invalid")).toBe("true");
  });

  it("keeps entered values when validation fails and focuses the remaining problem", async () => {
    const user = userEvent.setup();
    renderForm("?type=problem");
    const summary = screen.getByRole("textbox", { name: /Resumo/ }) as HTMLInputElement;
    await user.type(summary, "Passeio sem rampa");
    await user.click(submit());

    expect(summary.value).toBe("Passeio sem rampa");
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: /Descrição/ }));
  });

  it("requires a canonical related PRB for an existing-problem contribution", async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, "open");
    renderForm("?type=evidence");
    await user.type(screen.getByRole("textbox", { name: /Resumo/ }), "Resumo");
    await user.type(screen.getByRole("textbox", { name: /Descrição/ }), "Descrição");
    await user.click(submit());
    expect(problemIdField()?.getAttribute("aria-invalid")).toBe("true");
    expect(problemIdField()?.getAttribute("aria-describedby")).toContain(screen.getByText("Indique o problema relacionado.").id);

    await user.type(problemIdField()!, "problema 5");
    expect(screen.getByText("Use o identificador do problema, por exemplo PRB-0005.")).toBeTruthy();
    expect(open).not.toHaveBeenCalled();
  });

  it("clears an inline error as soon as the field becomes valid", async () => {
    const user = userEvent.setup();
    renderForm("?type=problem");
    await user.click(submit());
    await user.type(screen.getByRole("textbox", { name: /Resumo/ }), "Resumo");
    expect(screen.queryByText("Escreva um resumo.")).toBeNull();
    expect(screen.getByRole("textbox", { name: /Resumo/ }).getAttribute("aria-invalid")).toBeNull();
  });
});

describe("ContributionForm — GitHub handoff", () => {
  it("uses the inclusive application-owned bound for the complete URL", () => {
    expect(MAX_PREFILLED_ISSUE_URL_LENGTH).toBe(7000);
    expect(isPrefilledIssueUrlEligible("x".repeat(7000))).toBe(true);
    expect(isPrefilledIssueUrlEligible("x".repeat(7001))).toBe(false);
  });

  it("builds a new-issue URL on the project repository with encoded title and body", () => {
    const fields = {
      type: "evidence",
      problemId: " prb-0005 ",
      summary: "Passeio & rampa #3",
      description: "Linha 1\nLinha 2 — ação?=100%",
      source: "https://example.test/doc?a=1&b=2",
    } as const;
    const content = contributionIssueContent(fields);
    const url = prefilledIssueUrl(content);
    expect(contributionIssueUrl(fields)).toBe(url);
    expect(url).not.toMatch(/[\s#&]rampa|\n/);
    const { origin, title, body } = issueParams(url);
    expect(origin).toBe("https://github.com/JoaomdvFerreira/open-evora/issues/new");
    expect(title).toBe("[Contribuição] PRB-0005: Passeio & rampa #3");
    expect(body).toBe([
      "**Tipo de contribuição:** Contribuir para um problema existente",
      "**Problema relacionado:** PRB-0005",
      "",
      "### Resumo",
      "Passeio & rampa #3",
      "",
      "### Descrição",
      "Linha 1\nLinha 2 — ação?=100%",
      "",
      "### Fonte ou ligação",
      "https://example.test/doc?a=1&b=2",
    ].join("\n"));
    expect(content).toEqual({ title, body });
  });

  it("omits the related problem and source from a problem suggestion without them", () => {
    const { title, body } = issueParams(contributionIssueUrl({ type: "problem", problemId: "PRB-0005", summary: "Resumo", description: "Descrição", source: "" }));
    expect(title).toBe("[Sugestão de problema] Resumo");
    expect(body).not.toContain("Problema relacionado");
    expect(body).not.toContain("Fonte ou ligação");
  });

  it("opens the prepared issue in a new tab, confirms with an affirmed toast and keeps the form filled", async () => {
    const user = userEvent.setup();
    const tab = { opener: {} } as unknown as Window;
    const open = vi.spyOn(window, "open").mockReturnValue(tab);
    renderForm("?type=evidence&prb=PRB-0005");
    await user.type(screen.getByRole("textbox", { name: /Resumo/ }), "Resumo");
    await user.type(screen.getByRole("textbox", { name: /Descrição/ }), "Descrição");
    await user.click(submit());

    expect(open).toHaveBeenCalledTimes(1);
    const [url, target] = open.mock.calls[0];
    expect(target).toBe("_blank");
    expect(issueParams(String(url)).title).toBe("[Contribuição] PRB-0005: Resumo");
    expect(tab.opener).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("Contribuição preparada. Complete o envio no GitHub.");
    expect((screen.getByRole("textbox", { name: /Resumo/ }) as HTMLInputElement).value).toBe("Resumo");
    expect(problemIdField()?.value).toBe("PRB-0005");
  });

  it.each([
    ["blocked", () => null],
    ["failing", () => { throw new Error("blocked"); }],
  ])("shows the durable recovery panel when opening GitHub is %s", async (_label, behaviour) => {
    const user = userEvent.setup();
    vi.spyOn(window, "open").mockImplementation(behaviour);
    renderForm("?type=problem");
    await user.type(screen.getByRole("textbox", { name: /Resumo/ }), "Resumo");
    await user.type(screen.getByRole("textbox", { name: /Descrição/ }), "Descrição");
    await user.click(submit());

    expect(screen.getByRole("heading", { name: "Contribuição preparada manualmente" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Título preparado" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Conteúdo preparado" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Abrir novo issue no GitHub/ }).getAttribute("href")).toBe("https://github.com/JoaomdvFerreira/open-evora/issues/new");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("routes over-limit content to a full, copyable snapshot without opening the long URL", async () => {
    const user = userEvent.setup();
    const open = vi.spyOn(window, "open");
    renderForm("?type=problem");
    await user.type(screen.getByRole("textbox", { name: /Resumo/ }), "Resumo");
    const longBody = "x".repeat(8000);
    fireEvent.change(screen.getByRole("textbox", { name: /Descrição/ }), { target: { value: longBody } });
    await user.click(submit());
    expect(open).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Contribuição preparada manualmente" })).toBeTruthy();
    expect((screen.getByRole("textbox", { name: "Conteúdo preparado" }) as HTMLTextAreaElement).value).toContain(longBody);
    expect((screen.getByRole("textbox", { name: /Descrição/ }) as HTMLTextAreaElement).value).toBe(longBody);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("link", { name: /Abrir novo issue no GitHub/ }).getAttribute("href")).toBe("https://github.com/JoaomdvFerreira/open-evora/issues/new");
    expect(contributionIssueUrl({ type: "problem", problemId: "", summary: "s", description: "d", source: "" }).length).toBeLessThan(MAX_PREFILLED_ISSUE_URL_LENGTH);
  });

  it("keeps a prepared snapshot stable until the next valid submit and clears it after normal handoff", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "open").mockReturnValue(null);
    renderForm("?type=problem");
    const summary = screen.getByRole("textbox", { name: /Resumo/ });
    const description = screen.getByRole("textbox", { name: /Descrição/ });
    fireEvent.change(summary, { target: { value: "Primeiro" } });
    fireEvent.change(description, { target: { value: "Conteúdo original" } });
    await user.click(submit());
    const preparedTitle = screen.getByRole("textbox", { name: "Título preparado" }) as HTMLInputElement;
    expect(preparedTitle.value).toBe("[Sugestão de problema] Primeiro");
    fireEvent.change(summary, { target: { value: "Segundo" } });
    expect(preparedTitle.value).toBe("[Sugestão de problema] Primeiro");
    await user.click(submit());
    expect((screen.getByRole("textbox", { name: "Título preparado" }) as HTMLInputElement).value).toBe("[Sugestão de problema] Segundo");
    fireEvent.change(description, { target: { value: "" } });
    await user.click(submit());
    expect((screen.getByRole("textbox", { name: "Título preparado" }) as HTMLInputElement).value).toBe("[Sugestão de problema] Segundo");
    fireEvent.change(description, { target: { value: "Descrição válida" } });
    vi.mocked(window.open).mockReturnValue({ opener: {} } as unknown as Window);
    fireEvent.change(description, { target: { value: "Curto" } });
    await user.click(submit());
    expect(screen.queryByRole("heading", { name: "Contribuição preparada manualmente" })).toBeNull();
  });

  it("copies only after explicit actions and leaves prepared values visible when copying fails", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "open").mockReturnValue(null);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    Object.defineProperty(document, "execCommand", { configurable: true, value: vi.fn(() => false) });
    renderForm("?type=problem");
    await user.type(screen.getByRole("textbox", { name: /Resumo/ }), "Resumo");
    await user.type(screen.getByRole("textbox", { name: /Descrição/ }), "Descrição");
    await user.click(submit());
    const writeText = navigator.clipboard.writeText as ReturnType<typeof vi.fn>;
    expect(writeText).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Copiar título" }));
    expect(writeText).toHaveBeenCalledWith("[Sugestão de problema] Resumo");
    expect(screen.getByRole("alert").textContent).toBe("Não foi possível copiar o título. Selecione-o manualmente.");
    expect((screen.getByRole("textbox", { name: "Título preparado" }) as HTMLInputElement).value).toBe("[Sugestão de problema] Resumo");
    await user.click(screen.getByRole("button", { name: "Copiar conteúdo" }));
    expect(screen.getByRole("alert").textContent).toBe("Não foi possível copiar o conteúdo. Selecione-o manualmente.");
    expect((screen.getByRole("textbox", { name: "Conteúdo preparado" }) as HTMLTextAreaElement).value).toContain("Descrição");
  });

  it("copies the exact prepared title and body after their respective actions", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "open").mockReturnValue(null);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    renderForm("?type=problem");
    fireEvent.change(screen.getByRole("textbox", { name: /Resumo/ }), { target: { value: "Resumo exato" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Descrição/ }), { target: { value: "Descrição exata" } });
    await user.click(submit());
    expect(writeText).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Copiar título" }));
    expect(writeText).toHaveBeenLastCalledWith("[Sugestão de problema] Resumo exato");
    expect(screen.getByRole("status").textContent).toBe("Título copiado.");
    await user.click(screen.getByRole("button", { name: "Copiar conteúdo" }));
    expect(writeText).toHaveBeenLastCalledWith("**Tipo de contribuição:** Sugerir um problema\n\n### Resumo\nResumo exato\n\n### Descrição\nDescrição exata");
    expect(screen.getByRole("status").textContent).toBe("Conteúdo copiado.");
  });
});
