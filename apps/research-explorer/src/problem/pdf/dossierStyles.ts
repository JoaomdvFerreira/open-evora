import { StyleSheet } from "@react-pdf/renderer";
import { DOSSIER_FONT_FAMILIES } from "./dossierFonts";

/**
 * PDF-only visual system for the dossier: an A4 editorial/audit layout in a
 * restrained Open Évora palette (warm paper, ink, one terracotta accent,
 * neutral rules and surfaces). Deliberately independent of the website CSS.
 */

const SERIF = DOSSIER_FONT_FAMILIES.serif;
const SANS = DOSSIER_FONT_FAMILIES.sans;
const MONO = DOSSIER_FONT_FAMILIES.mono;

const PALETTE = {
  page: "#FAF7F0",
  ink: "#25211D",
  muted: "#6E675F",
  accent: "#A55436",
  accentDeep: "#77351F",
  surface: "#F1ECE3",
  rule: "#D6CEC2",
  ruleSoft: "#E7DED2",
} as const;

const LABEL = { fontFamily: SANS, fontWeight: 600, fontSize: 6.8, letterSpacing: 0.5, textTransform: "uppercase", color: PALETTE.muted } as const;

export const styles = StyleSheet.create({
  coverPage: { backgroundColor: PALETTE.page, paddingTop: 96, paddingHorizontal: 60, paddingBottom: 72, fontFamily: SANS, color: PALETTE.ink },
  coverBrand: { fontFamily: SANS, fontWeight: 600, fontSize: 9.5, letterSpacing: 0.8, textTransform: "uppercase", color: PALETTE.accent },
  coverKicker: { marginTop: 72, fontSize: 9.5, color: PALETTE.muted },
  coverId: { marginTop: 10, fontFamily: MONO, fontSize: 11, color: PALETTE.accentDeep },
  coverTitle: { marginTop: 22, fontFamily: SERIF, fontWeight: 700, fontSize: 26, lineHeight: 1.25, color: PALETTE.ink },
  coverRule: { marginTop: 26, width: 150, borderBottomWidth: 1.2, borderBottomColor: PALETTE.accent },
  coverContext: { marginTop: 24, fontSize: 9.5, color: PALETTE.muted, lineHeight: 1.45 },
  coverUpdated: { marginTop: 12, fontSize: 8, color: PALETTE.ink },

  page: { backgroundColor: PALETTE.page, paddingTop: 70, paddingBottom: 66, paddingHorizontal: 58, fontFamily: SANS, fontSize: 9.2, color: PALETTE.ink },
  runningHeader: { position: "absolute", top: 26, left: 52, right: 52, paddingBottom: 6, borderBottomWidth: 0.5, borderBottomColor: PALETTE.ruleSoft },
  runningFooter: { position: "absolute", bottom: 26, left: 52, right: 52, paddingTop: 6, borderTopWidth: 0.5, borderTopColor: PALETTE.ruleSoft },
  runningHeaderText: { fontSize: 6.8, letterSpacing: 0.4, textTransform: "uppercase", color: PALETTE.muted },
  runningFooterText: { fontSize: 6.8, color: PALETTE.muted, textAlign: "right" },

  sectionTitle: { fontFamily: SANS, fontWeight: 600, fontSize: 17, lineHeight: 1.25, color: PALETTE.ink, marginBottom: 6 },
  sectionIntro: { fontSize: 7.8, color: PALETTE.muted, marginBottom: 16, lineHeight: 1.45 },

  contentsRow: { paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: PALETTE.ruleSoft },
  contentsLink: { flexDirection: "row", textDecoration: "none", color: PALETTE.ink },
  contentsNumber: { width: 30, fontFamily: MONO, fontSize: 8.5, color: PALETTE.accent },
  contentsTitle: { fontSize: 9.5, color: PALETTE.ink },

  summaryTitle: { fontFamily: SERIF, fontWeight: 700, fontSize: 14, lineHeight: 1.3, marginBottom: 16 },
  stateGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: 18, borderTopWidth: 0.5, borderLeftWidth: 0.5, borderColor: PALETTE.rule, backgroundColor: PALETTE.surface, marginBottom: 18 },
  stateCell: { width: "33.333%", paddingVertical: 8, paddingHorizontal: 10, borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: PALETTE.rule },
  stateLabel: { ...LABEL, fontSize: 6.2 },
  stateValue: { marginTop: 2, fontFamily: SERIF, fontWeight: 700, fontSize: 12.5, lineHeight: 1.2 },

  label: LABEL,
  labelSpaced: { ...LABEL, marginTop: 12, marginBottom: 3 },
  fieldTable: { marginHorizontal: 18, marginBottom: 6 },
  fieldTableRuled: { marginHorizontal: 18, marginBottom: 16, borderTopWidth: 0.5, borderTopColor: PALETTE.ruleSoft },
  flush: { marginBottom: 0 },
  fieldRow: { flexDirection: "row", paddingVertical: 2.5 },
  fieldRowRuled: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: PALETTE.ruleSoft },
  fieldLabel: { width: 128, paddingRight: 10, fontFamily: SANS, fontWeight: 600, fontSize: 7, lineHeight: 1.55, color: PALETTE.muted },
  fieldValue: { flex: 1 },
  fieldText: { fontSize: 8, lineHeight: 1.45 },
  fieldParagraph: { fontSize: 8, lineHeight: 1.45, marginBottom: 4 },
  mono: { fontFamily: MONO, fontSize: 7.4 },
  link: { color: PALETTE.accentDeep, textDecoration: "none" },
  externalLink: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start" },
  externalMark: { width: 6, height: 6, marginLeft: 2.5 },
  refLink: { fontFamily: MONO, fontSize: 7.4, color: PALETTE.accentDeep, textDecoration: "none" },

  serifBody: { fontFamily: SERIF, fontSize: 10.6, lineHeight: 1.5, marginBottom: 6 },
  body: { fontSize: 9.2, lineHeight: 1.5, marginBottom: 5 },
  quote: { marginTop: 4, marginHorizontal: 18, paddingVertical: 10, paddingLeft: 14, paddingRight: 12, borderLeftWidth: 2, borderLeftColor: PALETTE.accent, backgroundColor: PALETTE.surface },
  quoteText: { fontFamily: SERIF, fontSize: 10.2, lineHeight: 1.5 },

  itemDivider: { borderTopWidth: 0.5, borderTopColor: PALETTE.rule, marginTop: 14, paddingTop: 14 },
  itemId: { fontFamily: MONO, fontSize: 8.6, color: PALETTE.accent, marginBottom: 4 },
  itemHeading: { fontFamily: SERIF, fontWeight: 700, fontSize: 11.4, lineHeight: 1.35, marginBottom: 8 },
  questionHeading: { fontFamily: SERIF, fontWeight: 700, fontSize: 12.6, lineHeight: 1.35, marginBottom: 6 },
  relationBar: { flexDirection: "row", marginHorizontal: 18, marginBottom: 8, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: PALETTE.surface, borderWidth: 0.5, borderColor: PALETTE.ruleSoft },
  relationEntry: { flex: 1, fontSize: 7.8 },
  limitsLabel: { ...LABEL, marginHorizontal: 18, marginTop: 6 },
  bullet: { flexDirection: "row", marginTop: 2, marginHorizontal: 18 },
  bulletMark: { width: 10, fontSize: 7.8, color: PALETTE.muted },
  bulletText: { flex: 1, fontSize: 7.8, lineHeight: 1.45 },

  stage: { flexDirection: "row", marginLeft: 18, marginBottom: 14 },
  stageNumber: { width: 26, fontFamily: MONO, fontSize: 9.5, color: PALETTE.accent, paddingTop: 1 },
  stageBody: { flex: 1, paddingLeft: 12, borderLeftWidth: 0.5, borderLeftColor: PALETTE.rule, paddingBottom: 4 },
  stageLabel: { fontFamily: SANS, fontWeight: 600, fontSize: 10.5, marginBottom: 6 },
  stageRefs: { marginTop: 4, fontSize: 7.4, color: PALETTE.muted },

  historyEntry: { flexDirection: "row", marginHorizontal: 18, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: PALETTE.ruleSoft },
  historyDate: { width: 112, fontFamily: MONO, fontSize: 7.6, color: PALETTE.accentDeep, paddingTop: 1.5 },
  historyBody: { flex: 1 },

  blockHeading: { fontFamily: SANS, fontWeight: 600, fontSize: 10, marginTop: 10, marginBottom: 4 },
  note: { marginTop: 14 },
  noteText: { fontSize: 8.2, lineHeight: 1.5, marginTop: 3 },
});
