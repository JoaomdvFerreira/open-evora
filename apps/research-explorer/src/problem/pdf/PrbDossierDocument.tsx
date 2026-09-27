import { Fragment, type ReactNode } from "react";
import { Document, Link, Page, Path, Svg, Text, View } from "@react-pdf/renderer";
import { dossierDestination, type DossierDocumentModel, type DossierField, type DossierProse, type DossierRef, type DossierSectionId } from "./dossierPresentation";
import { styles } from "./dossierStyles";

/**
 * React-PDF layout of the dossier document model (dossierPresentation.ts):
 * an A4 portrait cover, then one flowing interior page run with a fixed
 * running header/footer and page numbers. Sections start on a new page;
 * inside a section content paginates naturally — item headings are kept
 * with the start of their content (`minPresenceAhead`), short record blocks
 * stay whole (`wrap={false}`), long ones continue across pages, and
 * paragraphs avoid single-line orphans/widows. Only React-PDF primitives are
 * used: no DOM, website CSS, canvas or image capture.
 */

const PAGE_SIZE = "A4";
const SEPARATOR = " · ";
/** Rows laid out in one unbreakable unit with a record heading, so a heading never ends a page alone. */
const HEADING_ROWS = 3;
/** Rough character budget below which a record block is short enough to keep whole instead of splitting across pages. */
const KEEP_TOGETHER_CHARACTERS = 900;
/**
 * Characters per line of a monospace value (IBM Plex Mono advances 0.6 em;
 * 7.4 pt in the ~315 pt value column fits ~70). React-PDF breaks lines only
 * at spaces, so long URLs and identifiers are laid out in explicit chunks.
 */
const MONO_LINE_CHARACTERS = 66;

/** Splits an unbroken token into lines, preferring to cut after URL punctuation. */
function monoLines(value: string): string[] {
  const lines: string[] = [];
  let rest = value;
  while (rest.length > MONO_LINE_CHARACTERS) {
    const chunk = rest.slice(0, MONO_LINE_CHARACTERS);
    const cut = Math.max(...["/", "?", "&", "=", "-", "_", "."].map((mark) => chunk.lastIndexOf(mark)));
    const end = cut >= MONO_LINE_CHARACTERS / 2 ? cut + 1 : MONO_LINE_CHARACTERS;
    lines.push(rest.slice(0, end));
    rest = rest.slice(end);
  }
  return [...lines, rest];
}

function Paragraphs({ paragraphs, style }: { paragraphs: string[]; style: (typeof styles)[keyof typeof styles] }) {
  return (
    <>
      {paragraphs.map((paragraph, index) => (
        <Text key={index} style={style} orphans={2} widows={2}>
          {paragraph}
        </Text>
      ))}
    </>
  );
}

function Refs({ refs }: { refs: DossierRef[] }) {
  return (
    <Text style={styles.fieldText}>
      {refs.map((ref, index) => (
        <Fragment key={`${ref.id}-${index}`}>
          {index > 0 && SEPARATOR}
          {ref.destination ? (
            <Link src={`#${ref.destination}`} style={styles.refLink}>
              {ref.id}
            </Link>
          ) : (
            <Text style={styles.mono}>{ref.id}</Text>
          )}
        </Fragment>
      ))}
    </Text>
  );
}

const EXTERNAL_MARK = "↗";

/**
 * No bundled dossier face carries U+2197, so a trailing "↗" in link text is
 * drawn as a small vector arrow inside the same link instead of a missing glyph.
 */
function ExternalLink({ href, text }: { href: string; text: string }) {
  const external = text.endsWith(EXTERNAL_MARK);
  return (
    <Link src={href} style={[styles.link, styles.externalLink]}>
      <Text style={styles.fieldText}>{external ? text.slice(0, -EXTERNAL_MARK.length).trimEnd() : text}</Text>
      {external && (
        <Svg viewBox="0 0 10 10" style={styles.externalMark}>
          <Path d="M2.5 7.5 L7.5 2.5 M3.5 2.5 H7.5 V6.5" stroke={styles.link.color} strokeWidth={1.1} fill="none" />
        </Svg>
      )}
    </Link>
  );
}

function FieldValue({ field }: { field: DossierField }) {
  if (field.refs) return <Refs refs={field.refs} />;
  if (field.href) return <ExternalLink href={field.href} text={field.linkText ?? field.href} />;
  if (field.mono) {
    return (
      <>
        {monoLines(field.text ?? "").map((line, index) => (
          <Text key={index} style={[styles.fieldText, styles.mono]}>
            {line}
          </Text>
        ))}
      </>
    );
  }
  if (field.paragraphs) return <Paragraphs paragraphs={field.paragraphs} style={styles.fieldParagraph} />;
  return <Text style={styles.fieldText}>{field.text}</Text>;
}

function Fields({ fields, ruled = false, flush = false }: { fields: DossierField[]; ruled?: boolean; flush?: boolean }) {
  if (fields.length === 0) return null;
  return (
    <View style={[ruled ? styles.fieldTableRuled : styles.fieldTable, ...(flush ? [styles.flush] : [])]}>
      {fields.map((field, index) => (
        <View key={`${field.label}-${index}`} style={ruled ? styles.fieldRowRuled : styles.fieldRow} wrap={characterCount([field]) > KEEP_TOGETHER_CHARACTERS}>
          <Text style={styles.fieldLabel}>{field.label}</Text>
          <View style={styles.fieldValue}>
            <FieldValue field={field} />
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * Labels are laid out as siblings of the content they introduce, never as
 * the first child of a wrapper: React-PDF only honours `minPresenceAhead`
 * (keep-with-next) for an element that is not already first in its parent.
 */
function ProseBlock({ prose, style = styles.body }: { prose: DossierProse; style?: (typeof styles)[keyof typeof styles] }) {
  return (
    <>
      <Text style={styles.labelSpaced} minPresenceAhead={40}>
        {prose.label}
      </Text>
      <Paragraphs paragraphs={prose.paragraphs} style={style} />
    </>
  );
}

function Bullets({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <>
      <Text style={styles.limitsLabel} minPresenceAhead={24}>
        {label}
      </Text>
      {items.map((item, index) => (
        <View key={index} style={styles.bullet} wrap={false}>
          <Text style={styles.bulletMark}>•</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </>
  );
}

function Section({ id, title, intro, children }: { id: DossierSectionId; title: string; intro?: string; children: ReactNode }) {
  return (
    <View id={dossierDestination(id)} break>
      <Text style={styles.sectionTitle} minPresenceAhead={120}>
        {title}
      </Text>
      {intro && <Text style={styles.sectionIntro}>{intro}</Text>}
      {children}
    </View>
  );
}

function characterCount(...parts: (string | string[] | DossierField[])[]): number {
  return parts.flat().reduce<number>((total, part) => {
    if (typeof part === "string") return total + part.length;
    return total + part.label.length + (part.text?.length ?? 0) + characterCount(part.paragraphs ?? []) + ((part.linkText ?? part.href)?.length ?? 0) + (part.refs?.length ?? 0) * 12;
  }, 0);
}

function Cover({ cover }: { cover: DossierDocumentModel["cover"] }) {
  return (
    <Page size={PAGE_SIZE} orientation="portrait" style={styles.coverPage}>
      <Text style={styles.coverBrand}>{cover.brand}</Text>
      <Text style={styles.coverKicker}>{cover.kicker}</Text>
      <Text style={styles.coverId}>{cover.problemId}</Text>
      {cover.title && <Text style={styles.coverTitle}>{cover.title}</Text>}
      <View style={styles.coverRule} />
      {cover.context && <Text style={styles.coverContext}>{cover.context}</Text>}
      {cover.updated && <Text style={styles.coverUpdated}>{cover.updated}</Text>}
    </Page>
  );
}

function Contents({ contents }: { contents: DossierDocumentModel["contents"] }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>Índice</Text>
      <View style={{ marginTop: 12 }}>
        {contents.map((entry) => (
          <View key={entry.id} style={styles.contentsRow}>
            <Link src={`#${dossierDestination(entry.id)}`} style={styles.contentsLink}>
              <Text style={styles.contentsNumber}>{entry.number}</Text>
              <Text style={styles.contentsTitle}>{entry.title}</Text>
            </Link>
          </View>
        ))}
      </View>
    </View>
  );
}

function Summary({ summary }: { summary: DossierDocumentModel["summary"] }) {
  const cells = [...summary.states, ...summary.counts];
  return (
    <Section id="sintese" title="Síntese">
      {summary.title && <Text style={styles.summaryTitle}>{summary.title}</Text>}
      <View style={styles.stateGrid} wrap={false}>
        {cells.map((cell) => (
          <View key={cell.label} style={styles.stateCell}>
            <Text style={styles.stateLabel}>{cell.label}</Text>
            <Text style={styles.stateValue}>{cell.value}</Text>
          </View>
        ))}
      </View>
      <Fields fields={summary.facts} ruled />
      {summary.statement && <ProseBlock prose={summary.statement} style={styles.serifBody} />}
      {summary.causalReading && (
        <>
          <Text style={styles.labelSpaced} minPresenceAhead={60}>
            {summary.causalReading.label}
          </Text>
          <View style={styles.quote}>
            <Paragraphs paragraphs={summary.causalReading.paragraphs} style={styles.quoteText} />
          </View>
        </>
      )}
    </Section>
  );
}

function OpenQuestions({ section }: { section: NonNullable<DossierDocumentModel["openQuestions"]> }) {
  return (
    <Section id="questoes" title="Questões em aberto" intro={section.intro}>
      {section.items.map((item, index) => (
        <View key={item.number} style={index > 0 ? styles.itemDivider : undefined}>
          <View wrap={false}>
            <Text style={styles.label}>Questão {item.number}</Text>
            <Text style={styles.questionHeading}>{item.question}</Text>
            {item.prose.slice(0, 1).map((prose) => (
              <ProseBlock key={prose.label} prose={prose} />
            ))}
          </View>
          {item.prose.slice(1).map((prose) => (
            <ProseBlock key={prose.label} prose={prose} />
          ))}
          {item.evidence.length > 0 && (
            <View wrap={false}>
              <Text style={styles.labelSpaced}>Evidência relacionada</Text>
              <Refs refs={item.evidence} />
            </View>
          )}
        </View>
      ))}
    </Section>
  );
}

function InvestigationPath({ section }: { section: NonNullable<DossierDocumentModel["path"]> }) {
  return (
    <Section id="percurso" title="Percurso da investigação" intro={section.intro}>
      {section.stages.map((stage) => (
        <View key={stage.number} style={styles.stage} wrap={characterCount(stage.paragraphs) > KEEP_TOGETHER_CHARACTERS}>
          <Text style={styles.stageNumber}>{stage.number}</Text>
          <View style={styles.stageBody}>
            <Text style={styles.stageLabel} minPresenceAhead={40}>
              {stage.label}
            </Text>
            <Paragraphs paragraphs={stage.paragraphs} style={styles.body} />
            {stage.evidence.length > 0 && (
              <View style={styles.stageRefs}>
                <Text>
                  Evidência: <Refs refs={stage.evidence} />
                </Text>
              </View>
            )}
          </View>
        </View>
      ))}
    </Section>
  );
}

function Evidence({ section }: { section: NonNullable<DossierDocumentModel["evidence"]> }) {
  return (
    <Section id="evidencia" title="Evidência" intro={section.intro}>
      {section.items.map((item, index) => (
        <View
          key={item.id}
          id={item.destination}
          style={index > 0 ? styles.itemDivider : undefined}
          wrap={characterCount(item.summary, item.inferenceLimits, item.facts, item.relation) > KEEP_TOGETHER_CHARACTERS}
        >
          <View wrap={false}>
            <Text style={styles.itemId}>{item.id}</Text>
            {item.summary.map((paragraph, paragraphIndex) => (
              <Text key={paragraphIndex} style={styles.itemHeading}>
                {paragraph}
              </Text>
            ))}
            {item.relation.length > 0 && (
              <View style={styles.relationBar}>
                {item.relation.map((entry) => (
                  <Text key={entry.label} style={styles.relationEntry}>
                    {entry.label}: {entry.text}
                  </Text>
                ))}
              </View>
            )}
            <Fields fields={item.facts.slice(0, HEADING_ROWS)} flush />
          </View>
          <Fields fields={item.facts.slice(HEADING_ROWS)} />
          <Bullets label="Limites de inferência" items={item.inferenceLimits} />
        </View>
      ))}
    </Section>
  );
}

function Sources({ section }: { section: NonNullable<DossierDocumentModel["sources"]> }) {
  return (
    <Section id="fontes" title="Fontes" intro={section.intro}>
      {section.items.map((item, index) => (
        <View
          key={item.id}
          id={item.destination}
          style={index > 0 ? styles.itemDivider : undefined}
        >
          <View wrap={false}>
            <Text style={styles.itemId}>{item.id}</Text>
            {item.name && <Text style={styles.itemHeading}>{item.name}</Text>}
            <Fields fields={item.facts.slice(0, HEADING_ROWS)} flush />
          </View>
          <Fields fields={item.facts.slice(HEADING_ROWS)} />
          <Bullets label="Limitações da fonte" items={item.caveats} />
        </View>
      ))}
    </Section>
  );
}

function DecisionBasis({ section }: { section: NonNullable<DossierDocumentModel["decisionBasis"]> }) {
  return (
    <Section id="base" title="Base da investigação" intro={section.intro}>
      {section.blocks.map((block) => (
        <Fragment key={block.heading}>
          <Text style={styles.blockHeading} minPresenceAhead={48}>
            {block.heading}
          </Text>
          <Paragraphs paragraphs={block.paragraphs} style={styles.body} />
          <Fields fields={block.fields} />
        </Fragment>
      ))}
    </Section>
  );
}

function History({ section }: { section: NonNullable<DossierDocumentModel["history"]> }) {
  return (
    <Section id="historico" title="Histórico" intro={section.intro}>
      {section.entries.map((entry, index) => (
        <View key={index} style={styles.historyEntry} wrap={characterCount(entry.paragraphs, entry.fields) > KEEP_TOGETHER_CHARACTERS}>
          <Text style={styles.historyDate}>{entry.date ?? ""}</Text>
          <View style={styles.historyBody}>
            <Paragraphs paragraphs={entry.paragraphs} style={styles.body} />
            {entry.fields.map((field, fieldIndex) => (
              <View key={`${field.label}-${fieldIndex}`} style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>{field.label}</Text>
                <View style={styles.fieldValue}>
                  <FieldValue field={field} />
                </View>
              </View>
            ))}
          </View>
        </View>
      ))}
    </Section>
  );
}

function Audit({ audit }: { audit: DossierDocumentModel["audit"] }) {
  return (
    <Section id="auditoria" title="Auditoria">
      <Text style={styles.serifBody}>{audit.statement}</Text>
      <View style={{ marginTop: 10 }}>
        <Fields fields={audit.fields} ruled />
      </View>
      <View style={styles.note} wrap={false}>
        <Text style={styles.label}>Datas e acesso</Text>
        {audit.notes.map((note) => (
          <Text key={note} style={styles.noteText}>
            {note}
          </Text>
        ))}
      </View>
    </Section>
  );
}

export function PrbDossierDocument({ model }: { model: DossierDocumentModel }) {
  const { metadata } = model;
  return (
    <Document
      title={metadata.title}
      author={metadata.author}
      subject={metadata.subject}
      keywords={metadata.keywords}
      creator={metadata.creator}
      producer={metadata.producer}
      language={metadata.language}
      creationDate={metadata.creationDate}
      pageMode="useNone"
    >
      <Cover cover={model.cover} />
      <Page size={PAGE_SIZE} orientation="portrait" style={styles.page}>
        <View style={styles.runningHeader} fixed>
          <Text style={styles.runningHeaderText}>{model.runningHeader}</Text>
        </View>
        <Contents contents={model.contents} />
        <Summary summary={model.summary} />
        {model.openQuestions && <OpenQuestions section={model.openQuestions} />}
        {model.path && <InvestigationPath section={model.path} />}
        {model.evidence && <Evidence section={model.evidence} />}
        {model.sources && <Sources section={model.sources} />}
        {model.decisionBasis && <DecisionBasis section={model.decisionBasis} />}
        {model.history && <History section={model.history} />}
        <Audit audit={model.audit} />
        <View style={styles.runningFooter} fixed>
          <Text style={styles.runningFooterText} render={({ pageNumber, totalPages }) => `${model.runningFooter}${SEPARATOR}${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
