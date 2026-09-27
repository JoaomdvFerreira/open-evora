import { useId, useState, type FormEvent } from "react";
import { useToast } from "../presentation/Toast";

const GITHUB_NEW_ISSUE_URL = "https://github.com/JoaomdvFerreira/open-evora/issues/new";

export type ContributionType = "problem" | "evidence";

const CONTRIBUTION_TYPE_LABELS: Record<ContributionType, string> = {
  problem: "Sugerir um problema",
  evidence: "Contribuir para um problema existente",
};

/** Canonical Problem ID shape used by the research corpus (e.g. PRB-0005). */
const PRB_ID_PATTERN = /^PRB-\d{4}$/;

export interface ContributionFields {
  type: ContributionType | "";
  problemId: string;
  summary: string;
  description: string;
  source: string;
}

type FieldName = "type" | "problemId" | "summary" | "description";
type FieldErrors = Partial<Record<FieldName, string>>;

function normalizeProblemId(value: string): string {
  return value.trim().toUpperCase();
}

/**
 * Initial form state from `?type=problem` or `?type=evidence&prb=PRB-0005`.
 * Unknown types and non-canonical PRB IDs are ignored; a PRB ID is only
 * prefilled alongside an existing-problem contribution. Read once — the form
 * never writes its state back to the URL.
 */
export function contributionPrefill(search: string): ContributionFields {
  const params = new URLSearchParams(search);
  const rawType = params.get("type");
  const type: ContributionType | "" = rawType === "problem" || rawType === "evidence" ? rawType : "";
  const rawProblemId = params.get("prb");
  const problemId = type === "evidence" && rawProblemId && PRB_ID_PATTERN.test(rawProblemId) ? rawProblemId : "";
  return { type, problemId, summary: "", description: "", source: "" };
}

function validate(fields: ContributionFields): FieldErrors {
  const errors: FieldErrors = {};
  if (!fields.type) errors.type = "Escolha o tipo de contribuição.";
  if (fields.type === "evidence") {
    const problemId = normalizeProblemId(fields.problemId);
    if (!problemId) errors.problemId = "Indique o problema relacionado.";
    else if (!PRB_ID_PATTERN.test(problemId)) errors.problemId = "Use o identificador do problema, por exemplo PRB-0005.";
  }
  if (!fields.summary.trim()) errors.summary = "Escreva um resumo.";
  if (!fields.description.trim()) errors.description = "Descreva a contribuição.";
  return errors;
}

/** GitHub new-issue URL carrying the contribution as a prefilled title and body. */
export function contributionIssueUrl(fields: ContributionFields): string {
  const type = fields.type || "problem";
  const summary = fields.summary.trim();
  const problemId = type === "evidence" ? normalizeProblemId(fields.problemId) : "";
  const source = fields.source.trim();
  const title = type === "evidence" ? `[Contribuição] ${problemId}: ${summary}` : `[Sugestão de problema] ${summary}`;
  const body = [
    `**Tipo de contribuição:** ${CONTRIBUTION_TYPE_LABELS[type]}`,
    ...(problemId ? [`**Problema relacionado:** ${problemId}`] : []),
    "",
    "### Resumo",
    summary,
    "",
    "### Descrição",
    fields.description.trim(),
    ...(source ? ["", "### Fonte ou ligação", source] : []),
  ].join("\n");
  const params = new URLSearchParams({ title, body });
  return `${GITHUB_NEW_ISSUE_URL}?${params.toString()}`;
}

function openInNewTab(url: string): boolean {
  try {
    const opened = window.open(url, "_blank");
    if (!opened) return false;
    opened.opener = null;
    return true;
  } catch {
    return false;
  }
}

/**
 * Contact-page contribution form. It collects no personal/contact data and
 * submits nothing itself: a valid form opens a prefilled public GitHub issue
 * in a new tab, where the citizen completes submission. Validation feedback
 * is inline; only the GitHub handoff outcome uses a toast.
 */
export function ContributionForm({ initialSearch }: { initialSearch?: string }) {
  const { notify } = useToast();
  const baseId = useId();
  const [fields, setFields] = useState<ContributionFields>(() => contributionPrefill(initialSearch ?? window.location.search));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);

  const id = (name: string) => `${baseId}-${name}`;
  const errorId = (name: FieldName) => (errors[name] ? id(`${name}-error`) : undefined);

  function update<K extends keyof ContributionFields>(name: K, value: ContributionFields[K]) {
    const next = { ...fields, [name]: value };
    setFields(next);
    if (submitted) setErrors(validate(next));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    const nextErrors = validate(fields);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    if (openInNewTab(contributionIssueUrl(fields))) notify("Contribuição preparada. Complete o envio no GitHub.", "affirmed");
    else notify("Não foi possível abrir o GitHub.", "error");
  }

  const isEvidence = fields.type === "evidence";

  return (
    <form className="info-form" noValidate onSubmit={handleSubmit}>
      <fieldset className="info-form-field" aria-describedby={errorId("type")}>
        <legend className="info-form-label">Tipo de contribuição <span className="info-form-required">(obrigatório)</span></legend>
        <div className="info-form-options">
          {(Object.keys(CONTRIBUTION_TYPE_LABELS) as ContributionType[]).map((type) => (
            <label key={type} className="info-form-option">
              <input type="radio" name={id("type")} value={type} required checked={fields.type === type} onChange={() => update("type", type)} aria-describedby={errorId("type")} />
              <span>{CONTRIBUTION_TYPE_LABELS[type]}</span>
            </label>
          ))}
        </div>
        {errors.type && <p id={errorId("type")} className="info-form-error">{errors.type}</p>}
      </fieldset>

      {isEvidence && (
        <div className="info-form-field">
          <label className="info-form-label" htmlFor={id("problemId")}>Problema relacionado <span className="info-form-required">(obrigatório)</span></label>
          <p id={id("problemId-hint")} className="info-form-hint">Identificador do problema, por exemplo PRB-0005.</p>
          <input
            id={id("problemId")}
            className="info-form-control info-form-control--short"
            type="text"
            autoComplete="off"
            spellCheck={false}
            required
            value={fields.problemId}
            onChange={(event) => update("problemId", event.target.value)}
            aria-invalid={errors.problemId ? true : undefined}
            aria-describedby={[id("problemId-hint"), errorId("problemId")].filter(Boolean).join(" ")}
          />
          {errors.problemId && <p id={errorId("problemId")} className="info-form-error">{errors.problemId}</p>}
        </div>
      )}

      <div className="info-form-field">
        <label className="info-form-label" htmlFor={id("summary")}>Resumo <span className="info-form-required">(obrigatório)</span></label>
        <input
          id={id("summary")}
          className="info-form-control"
          type="text"
          autoComplete="off"
          required
          value={fields.summary}
          onChange={(event) => update("summary", event.target.value)}
          aria-invalid={errors.summary ? true : undefined}
          aria-describedby={errorId("summary")}
        />
        {errors.summary && <p id={errorId("summary")} className="info-form-error">{errors.summary}</p>}
      </div>

      <div className="info-form-field">
        <label className="info-form-label" htmlFor={id("description")}>Descrição <span className="info-form-required">(obrigatório)</span></label>
        <textarea
          id={id("description")}
          className="info-form-control info-form-control--multiline"
          rows={6}
          required
          value={fields.description}
          onChange={(event) => update("description", event.target.value)}
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={errorId("description")}
        />
        {errors.description && <p id={errorId("description")} className="info-form-error">{errors.description}</p>}
      </div>

      <div className="info-form-field">
        <label className="info-form-label" htmlFor={id("source")}>Fonte ou ligação <span className="info-form-optional">(opcional)</span></label>
        <input
          id={id("source")}
          className="info-form-control"
          type="text"
          inputMode="url"
          autoComplete="off"
          value={fields.source}
          onChange={(event) => update("source", event.target.value)}
        />
      </div>

      <div className="info-form-actions">
        <button type="submit" className="info-action-link info-form-submit">Preparar issue no GitHub<span aria-hidden="true"> ↗</span></button>
        <p className="info-form-hint">Abre um issue público pré-preenchido num novo separador. O envio só fica concluído no GitHub.</p>
      </div>
    </form>
  );
}
