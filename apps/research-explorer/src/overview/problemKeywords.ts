/** Editorial discovery terms. These are never research claims or public record fields. */
import { normalizeForSearch } from "../records/normalize";
export interface ProblemKeywords {
  id: string;
  primary: string[];
  secondary: string[];
}

// Add a new PRB as one entry. The validator rejects duplicate IDs and malformed terms.
export const problemKeywords: readonly ProblemKeywords[] = [
  { id: "PRB-0001", primary: ["autocarros", "horários dos autocarros"], secondary: ["transportes públicos", "autocarros atrasados", "autocarros à noite"] },
  { id: "PRB-0002", primary: ["paragens de autocarro", "informação nas paragens"], secondary: ["horários nas paragens", "acessibilidade das paragens"] },
  { id: "PRB-0003", primary: ["passeios", "acessibilidade pedonal"], secondary: ["barreiras nos passeios", "andar a pé"] },
  { id: "PRB-0004", primary: ["bicicleta", "bicicletas", "ciclovia", "ciclovias"], secondary: ["vias para bicicletas", "rede ciclável", "andar de bicicleta"] },
  { id: "PRB-0005", primary: ["trânsito", "segurança rodoviária"], secondary: ["trânsito lento", "congestionamento", "variante nascente"] },
  { id: "PRB-0006", primary: ["quartos estudantes", "alojamento estudantil"], secondary: ["residências universitárias", "quartos para estudantes", "casa para estudantes"] },
  { id: "PRB-0007", primary: ["cuidadores informais"], secondary: ["apoio a cuidadores", "informação para cuidadores"] },
  { id: "PRB-0008", primary: ["emprego", "competências profissionais"], secondary: ["necessidades dos empregadores", "formação para o trabalho"] },
  { id: "PRB-0009", primary: ["lixo", "resíduos", "recolha de lixo"], secondary: ["contentores", "limpeza urbana", "higiene urbana"] },
  { id: "PRB-0010", primary: ["buracos", "pavimento degradado"], secondary: ["buracos na estrada", "ruas degradadas"] },
  { id: "PRB-0011", primary: ["barreiras linguísticas na saúde"], secondary: ["migrantes na saúde", "tradução na saúde", "língua na saúde"] },
  { id: "PRB-0012", primary: ["escola do chafariz d'el-rei"], secondary: ["escola fechada", "chafariz d'el-rei"] },
  { id: "PRB-0013", primary: ["casas caras", "habitação acessível"], secondary: ["preço das casas", "rendas caras", "habitação a preços comportáveis"] },
];

export function validateProblemKeywords(entries: readonly ProblemKeywords[]): void {
  const ids = new Set<string>();
  for (const entry of entries) {
    if (!entry || typeof entry !== "object" || !/^PRB-(?!0000)\d{4}$/.test(entry.id)) throw new Error("Invalid keyword PRB ID");
    if (ids.has(entry.id)) throw new Error(`Duplicate keyword PRB ID: ${entry.id}`);
    ids.add(entry.id);
    if (Object.keys(entry).some((key) => !["id", "primary", "secondary"].includes(key)) || !Array.isArray(entry.primary) || entry.primary.length === 0 || !Array.isArray(entry.secondary)) throw new Error(`Malformed keywords: ${entry.id}`);
    const terms = [...entry.primary, ...entry.secondary];
    if (terms.some((term) => typeof term !== "string" || term.trim() !== term || term.length === 0 || !/[\p{L}\p{N}]/u.test(term))) throw new Error(`Malformed keywords: ${entry.id}`);
    if (new Set(terms.map(normalizeForSearch)).size !== terms.length) throw new Error(`Duplicate keyword term: ${entry.id}`);
  }
}

validateProblemKeywords(problemKeywords);
export const keywordsByProblemId = new Map(problemKeywords.map(({ id, primary, secondary }) => [id, { primary, secondary }]));
