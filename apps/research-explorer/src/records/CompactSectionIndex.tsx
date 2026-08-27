export interface CompactSectionIndexEntry {
  sectionId: string;
  anchorId: string;
  label: string;
}

/** A semantically neutral compact, in-flow index for editorial detail views. */
export function CompactSectionIndex({ label, sections, className = "" }: { label: string; sections: CompactSectionIndexEntry[]; className?: string }) {
  return (
    <details className={`problem-help compact-section-index ${className}`.trim()}>
      <summary>{label}</summary>
      <nav aria-label={`${label} (versão compacta)`} className="problem-help-section-index">
        <ul>
          {sections.map((section) => (
            <li key={section.sectionId}>
              <a href={`#${section.anchorId}`}>{section.label}</a>
            </li>
          ))}
        </ul>
      </nav>
    </details>
  );
}
