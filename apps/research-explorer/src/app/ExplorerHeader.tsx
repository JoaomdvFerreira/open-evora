import { Logo } from "../presentation/Logo";
import { useUnavailableNote } from "../presentation/UnavailableNote";

export function ExplorerHeader({ activeView, onOverview, onRecords }: {
  activeView: string;
  onOverview: () => void;
  onRecords: () => void;
}) {
  const { id: grafoNoteId, describedBy: grafoNote } = useUnavailableNote("Em desenvolvimento");
  return (
    <header className="explorer-chrome">
      <div className="explorer-chrome-inner shell-frame">
        <h1>
          <Logo form="full" className="explorer-logo explorer-logo--full" />
          <Logo form="compact" className="explorer-logo explorer-logo--compact" />
          <span className="explorer-subtitle">Explorador de Investigação</span>
        </h1>
        <nav aria-label="Vistas do Explorador de Investigação" className="explorer-navigation">
          <button type="button" aria-current={activeView === "overview" ? "page" : undefined} onClick={onOverview}>Visão geral</button>
          <button type="button" aria-current={activeView === "records" ? "page" : undefined} onClick={onRecords}>Registos</button>
          <span className="unavailable-control">
            <button type="button" aria-disabled="true" title="Em desenvolvimento" aria-describedby={grafoNoteId}>Grafo</button>
            {grafoNote}
          </span>
        </nav>
      </div>
    </header>
  );
}
