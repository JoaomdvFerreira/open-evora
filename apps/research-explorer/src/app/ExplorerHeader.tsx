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
        <h1 className="explorer-identity">
          <Logo form="full" className="explorer-logo explorer-logo--full" />
          <Logo form="compact" className="explorer-logo explorer-logo--compact" />
        </h1>
        <nav aria-label="Vistas do Explorador de Investigação" className="explorer-navigation">
          <button type="button" className="explorer-navigation-action" aria-current={activeView === "overview" ? "page" : undefined} onClick={onOverview}>Visão geral</button>
          <button type="button" className="explorer-navigation-action" aria-current={activeView === "records" ? "page" : undefined} onClick={onRecords}>Registos</button>
          <span className="unavailable-control">
            <button type="button" className="explorer-navigation-action" aria-disabled="true" title="Em desenvolvimento" aria-describedby={grafoNoteId}>Grafo</button>
            {grafoNote}
          </span>
        </nav>
      </div>
    </header>
  );
}
