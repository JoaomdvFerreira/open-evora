/** Editorial discovery terms. These are never research claims or public record fields. */
import { normalizeForSearch } from "../records/normalize";
export interface ProblemKeywords {
  id: string;
  primary: string[];
  secondary: string[];
  /** Scope cues used only with another matching query term, never alone. */
  contextual: string[];
}

// Approved singular/plural aliases omitted because the searcher's vowel+s
// fold gives the same match: PRB-0001 "autocarro" → "autocarros";
// PRB-0003 "passeio" → "passeios"; PRB-0004 "bicicletas" → "bicicleta"
// and "ciclovias" → "ciclovia". Each omitted query still matches its PRB.
// Every other approved term is present below. Add a new PRB as one entry.
export const problemKeywords: readonly ProblemKeywords[] = [
  {
    id: "PRB-0001",
    primary: ["autocarros", "transporte público", "autocarro à noite", "autocarro ao domingo"],
    secondary: ["bus", "TREVO", "horários", "atrasos", "pontualidade", "frequência", "mobilidade urbana", "horários dos autocarros", "autocarros atrasados"],
    contextual: ["transportes", "carreira", "linha"],
  },
  {
    id: "PRB-0002",
    primary: ["paragem", "paragens", "paragem de autocarro", "informação ao passageiro"],
    secondary: ["abrigo", "horários", "painel informativo", "tempo real", "braille", "aviso sonoro", "mapa das paragens", "TREVO", "informação nas paragens", "horários nas paragens", "acessibilidade das paragens"],
    contextual: ["acessibilidade"],
  },
  {
    id: "PRB-0003",
    primary: ["passeios", "cadeira de rodas", "barreiras arquitetónicas", "circulação pedonal"],
    secondary: ["mobilidade reduzida", "obstáculos", "passadeiras", "peões", "acesso para deficientes", "rampas", "acessibilidade pedonal", "barreiras nos passeios", "andar a pé"],
    contextual: ["acessibilidade", "terminal rodoviário"],
  },
  {
    id: "PRB-0004",
    primary: ["bicicleta", "ciclovia", "pista ciclável", "rede ciclável"],
    secondary: ["ciclistas", "pedalar", "mobilidade ciclável", "percurso de bicicleta", "via partilhada", "ciclomobilidade", "vias para bicicletas", "andar de bicicleta"],
    contextual: ["Santa Luzia", "Xarrama"],
  },
  {
    id: "PRB-0005",
    primary: ["trânsito", "congestionamento", "engarrafamento", "tráfego", "segurança rodoviária"],
    secondary: ["filas de trânsito", "carros", "circulação automóvel", "acidentes", "excesso de velocidade", "Variante Nascente", "veículos pesados", "trânsito lento"],
    contextual: ["circular"],
  },
  {
    id: "PRB-0006",
    primary: ["alojamento universitário", "residência universitária", "residências de estudantes", "quartos", "falta de quartos", "quartos estudantes"],
    secondary: ["alugar quarto", "camas", "renda estudantes", "Universidade de Évora", "SASUÉ", "alojamento académico", "alojamento estudantil", "quartos para estudantes", "casa para estudantes"],
    contextual: ["estudantes"],
  },
  {
    id: "PRB-0007",
    primary: ["cuidador", "cuidadores", "cuidador informal", "apoio ao cuidador"],
    secondary: ["cuidar de idosos", "apoio domiciliário", "descanso do cuidador", "sobrecarga", "apoio social", "apoio psicológico", "subsídio cuidador", "direitos do cuidador", "Cantinho do Cuidador", "cuidadores informais", "apoio a cuidadores", "informação para cuidadores"],
    contextual: [],
  },
  {
    id: "PRB-0008",
    primary: ["emprego", "desemprego", "ofertas de emprego", "formação profissional"],
    secondary: ["vagas", "recrutamento", "contratar", "falta de trabalhadores", "qualificações", "competências", "mercado de trabalho", "IEFP", "competências profissionais", "necessidades dos empregadores", "formação para o trabalho"],
    contextual: ["trabalho", "empresas"],
  },
  {
    id: "PRB-0009",
    primary: ["lixo", "recolha do lixo", "resíduos", "recolha de resíduos"],
    secondary: ["lixo na rua", "lixo acumulado", "contentores", "contentor cheio", "caixotes do lixo", "resíduos urbanos", "limpeza urbana", "higiene urbana", "lixo por recolher", "recolha atrasada", "lixo nas ruas", "recolha de lixo"],
    contextual: [],
  },
  {
    id: "PRB-0010",
    primary: ["buracos", "buracos na estrada", "estrada esburacada", "ruas degradadas", "piso degradado", "pavimento degradado"],
    secondary: ["estradas", "pavimento", "alcatrão", "asfalto", "reparação de ruas", "obras na estrada", "calçada", "manutenção das estradas", "vias municipais"],
    contextual: [],
  },
  {
    id: "PRB-0011",
    primary: ["barreira linguística", "intérprete", "acesso à saúde", "barreiras linguísticas na saúde"],
    secondary: ["imigrantes", "migrantes", "tradução", "centro de saúde", "atendimento médico", "mediação intercultural", "CLAIM", "migrantes na saúde", "tradução na saúde", "língua na saúde"],
    contextual: ["estrangeiros", "língua", "hospital", "consultas", "saúde mental"],
  },
  {
    id: "PRB-0012",
    primary: ["escola fechada", "Chafariz d'El-Rei", "escola Chafariz", "escola provisória", "Escola do Chafariz d'El-Rei"],
    secondary: ["obras na escola", "escola degradada", "problemas estruturais", "salas de aula", "monoblocos", "contentores escolares", "reabilitação escolar"],
    contextual: ["escola", "alunos", "aulas", "André de Resende"],
  },
  {
    id: "PRB-0013",
    primary: ["habitação", "renda alta", "arrendamento", "preço das casas", "habitação acessível", "falta de casas", "crise habitacional", "casas caras"],
    secondary: ["casas", "rendas", "casas para arrendar", "comprar casa", "habitação pública", "habitação social", "renda apoiada", "rendas caras", "habitação a preços comportáveis"],
    contextual: ["Malagueira"],
  },
];

export function validateProblemKeywords(entries: readonly ProblemKeywords[]): void {
  const ids = new Set<string>();
  for (const entry of entries) {
    if (!entry || typeof entry !== "object" || !/^PRB-(?!0000)\d{4}$/.test(entry.id)) throw new Error("Invalid keyword PRB ID");
    if (ids.has(entry.id)) throw new Error(`Duplicate keyword PRB ID: ${entry.id}`);
    ids.add(entry.id);
    if (Object.keys(entry).some((key) => !["id", "primary", "secondary", "contextual"].includes(key)) || !Array.isArray(entry.primary) || entry.primary.length === 0 || !Array.isArray(entry.secondary) || !Array.isArray(entry.contextual)) throw new Error(`Malformed keywords: ${entry.id}`);
    const terms = [...entry.primary, ...entry.secondary, ...entry.contextual];
    if (terms.some((term) => typeof term !== "string" || term.trim() !== term || term.length === 0 || !/[\p{L}\p{N}]/u.test(term))) throw new Error(`Malformed keywords: ${entry.id}`);
    if (new Set(terms.map(normalizeForSearch)).size !== terms.length) throw new Error(`Duplicate keyword term: ${entry.id}`);
  }
}

validateProblemKeywords(problemKeywords);
export const keywordsByProblemId = new Map(problemKeywords.map(({ id, primary, secondary, contextual }) => [id, { primary, secondary, contextual }]));
