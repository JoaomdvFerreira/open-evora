import { ProgressMessage } from "../presentation/ProgressMessage";
import { Skeleton } from "../presentation/Skeleton";

function LoadingStatus({ message }: { message: string }) {
  return <div className="skeleton-status-only"><ProgressMessage message={message} /></div>;
}

function Lines({ count = 3 }: { count?: number }) {
  return <div className="skeleton-lines">{Array.from({ length: count }, (_, index) => <Skeleton key={index} width={index === count - 1 ? "68%" : undefined} />)}</div>;
}

function EditorialSection({ rows = 3 }: { rows?: number }) {
  return (
    <section className="skeleton-editorial-section">
      <div><Skeleton width="7rem" /><Skeleton width="10rem" /></div>
      <div><Skeleton className="skeleton-heading" width="72%" /><Lines count={rows} /></div>
    </section>
  );
}

function PageHeaderSkeleton({ kind }: { kind: "prb" | "evd" | "src" | "generic" }) {
  return (
    <>
      <div className={`${kind === "prb" ? "prb" : kind}-header-band skeleton-local-header`}>
        <div className="shell-frame shell-frame--wide skeleton-local-header-inner">
          <Skeleton width="10rem" /><Skeleton width="8rem" />
        </div>
      </div>
      <div className="shell-frame shell-frame--wide skeleton-identity-hero">
        <Skeleton width="12rem" />
        <Skeleton className="skeleton-display" width="78%" />
        <Skeleton className="skeleton-heading" width="58%" />
        <Skeleton width="15rem" />
      </div>
    </>
  );
}

function MetadataStrip({ kind }: { kind: "evd" | "src" | "prb" }) {
  return (
    <div className={`${kind === "prb" ? "prb-state-scope-band" : `${kind}-meta`} skeleton-meta-band`}>
      <div className="shell-frame shell-frame--wide skeleton-meta-grid">
        {Array.from({ length: 6 }, (_, index) => <div key={index}><Skeleton width="55%" /><Skeleton className="skeleton-heading" width="78%" /></div>)}
      </div>
    </div>
  );
}

function AuditSkeleton() {
  return <div className="skeleton-audit-band"><div className="shell-frame shell-frame--wide"><EditorialSection rows={4} /></div></div>;
}

function ProblemRowsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="overview-results skeleton-results" data-testid="overview-results-skeleton" aria-hidden="true">
      <ul className="overview-problem-list">
        {Array.from({ length: count }, (_, index) => (
          <li key={index} className="overview-problem-row skeleton-problem-row">
            <Skeleton width="11rem" /><Skeleton className="skeleton-heading" width={index % 2 ? "64%" : "76%"} /><Lines count={2} />
          </li>
        ))}
      </ul>
      <div className="overview-end-of-results"><div className="overview-end-of-results-inner shell-frame shell-frame--wide"><Skeleton width="11rem" /><Skeleton width="8rem" /></div></div>
    </div>
  );
}

export function AppSkeleton() {
  return (
    <div data-testid="app-skeleton" className="startup-skeleton">
      <LoadingStatus message="A carregar modelo de leitura gerado…" />
      <div className="explorer-chrome"><div className="explorer-chrome-inner shell-frame shell-frame--wide"><Skeleton className="skeleton-logo" width="12rem" /><Skeleton width="18rem" /></div></div>
      <div className="shell-frame shell-frame--wide skeleton-startup-body"><Skeleton className="skeleton-display" width="62%" /><Lines count={3} /><div className="skeleton-startup-grid"><Skeleton /><Skeleton /><Skeleton /></div></div>
    </div>
  );
}

export function OverviewResultsSkeleton() {
  return <div className="skeleton-boundary"><LoadingStatus message="A carregar problemas…" /><ProblemRowsSkeleton /></div>;
}

export function OverviewSkeleton() {
  return (
    <section data-testid="overview-skeleton" className="skeleton-boundary public-overview">
      <LoadingStatus message="A carregar visão geral…" />
      <div className="overview-hero"><div className="overview-hero-content shell-frame shell-frame--wide skeleton-overview-hero"><Skeleton width="12rem" /><Skeleton className="skeleton-display" width="72%" /><Lines count={2} /><div className="overview-metrics">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="skeleton-metric" />)}</div></div></div>
      <div className="overview-discovery"><div className="overview-toolbar shell-frame shell-frame--wide skeleton-discovery"><Skeleton width="8rem" /><Skeleton className="skeleton-control" /><Skeleton width="7rem" /></div></div>
      <ProblemRowsSkeleton />
    </section>
  );
}

export function RecordsSkeleton() {
  return (
    <section data-testid="records-skeleton" className="skeleton-boundary records-page">
      <LoadingStatus message="A carregar registos…" />
      <div className="records-page-frame shell-frame shell-frame--wide">
        <header className="records-intro skeleton-records-intro"><Skeleton width="11rem" /><Skeleton className="skeleton-display" width="18rem" /><Lines count={2} /></header>
        <div className="records-filter-bar skeleton-records-filters"><Skeleton width="22rem" /><Skeleton className="skeleton-control" /></div>
        <div className="records-list-head"><Skeleton width="8rem" /><Skeleton width="7rem" /></div>
        <ul className="records-list">{Array.from({ length: 7 }, (_, i) => <li key={i}><div className="records-row skeleton-record-row"><Skeleton width="7rem" /><Skeleton width={i % 2 ? "54%" : "68%"} /></div></li>)}</ul>
        <div className="records-pagination skeleton-pagination"><Skeleton width="10rem" /><Skeleton width="8rem" /><Skeleton width="7rem" /></div>
      </div>
    </section>
  );
}

function PrbSharedSkeleton({ history = false }: { history?: boolean }) {
  return (
    <article className={history ? "prb-history-view" : "prb-details-view"} aria-hidden="true">
      <PageHeaderSkeleton kind="prb" />
      {!history && <MetadataStrip kind="prb" />}
      {history ? <div className="shell-frame shell-frame--wide skeleton-history"><EditorialSection rows={2} />{Array.from({ length: 4 }, (_, i) => <div key={i} className="skeleton-history-row"><Skeleton width="7rem" /><div><Skeleton className="skeleton-heading" width="82%" /><Lines count={2} /></div></div>)}</div> : <><div className="shell-frame shell-frame--wide skeleton-editorial-flow"><EditorialSection /><EditorialSection rows={5} /><EditorialSection rows={4} /></div><AuditSkeleton /></>}
    </article>
  );
}

export function PrbDetailsSkeleton({ message = "A carregar Problema…" }: { message?: string }) {
  return <div data-testid="prb-details-skeleton" className="skeleton-boundary"><LoadingStatus message={message} /><PrbSharedSkeleton /></div>;
}

export function PrbHistorySkeleton({ message = "A carregar histórico…" }: { message?: string }) {
  return <div data-testid="prb-history-skeleton" className="skeleton-boundary"><LoadingStatus message={message} /><PrbSharedSkeleton history /></div>;
}

function SpecialRecordSkeleton({ kind, message }: { kind: "evd" | "src"; message: string }) {
  return (
    <article data-testid={`${kind}-detail-skeleton`} className={`skeleton-boundary ${kind}-detail-view`}>
      <LoadingStatus message={message} /><PageHeaderSkeleton kind={kind} /><MetadataStrip kind={kind} />
      <div className={`shell-frame shell-frame--wide ${kind}-body skeleton-editorial-flow`}><EditorialSection rows={kind === "src" ? 5 : 3} /><EditorialSection rows={4} /><EditorialSection rows={3} /></div><AuditSkeleton />
    </article>
  );
}

export function EvdDetailSkeleton({ message = "A carregar detalhes do registo…" }: { message?: string }) { return <SpecialRecordSkeleton kind="evd" message={message} />; }
export function SrcDetailSkeleton({ message = "A carregar detalhes do registo…" }: { message?: string }) { return <SpecialRecordSkeleton kind="src" message={message} />; }

export function GenericRecordDetailSkeleton({ message = "A carregar detalhes do registo…" }: { message?: string }) {
  return (
    <div data-testid="generic-detail-skeleton" className="skeleton-boundary record-detail-layout shell-frame">
      <LoadingStatus message={message} /><PageHeaderSkeleton kind="generic" /><div className="record-detail-columns skeleton-generic-detail"><div className="record-detail-main"><Skeleton className="skeleton-display" width="75%" /><Lines count={4} /><EditorialSection /><EditorialSection rows={4} /></div><aside className="record-detail-rail"><Lines count={5} /></aside></div>
    </div>
  );
}

export function RecordDetailSkeleton({ id }: { id: string }) {
  const message = `A carregar detalhes de ${id}…`;
  if (id.startsWith("EVD-")) return <EvdDetailSkeleton message={message} />;
  if (id.startsWith("SRC-")) return <SrcDetailSkeleton message={message} />;
  return <GenericRecordDetailSkeleton message={message} />;
}

export function GraphSkeleton({ message = "A carregar dados do grafo…" }: { message?: string }) {
  return (
    <section data-testid="graph-skeleton" className="skeleton-boundary graph-explorer shell-frame">
      <LoadingStatus message={message} /><Skeleton className="skeleton-display" width="14rem" /><Lines count={2} />
      <div className="graph-controls skeleton-graph-controls"><Skeleton className="skeleton-control" /><Skeleton width="20rem" /><Skeleton width="28rem" /></div>
      <Skeleton className="skeleton-graph-canvas" /><div className="skeleton-graph-support"><EditorialSection rows={2} /><EditorialSection rows={3} /></div>
    </section>
  );
}

export function RelationSkeleton({ message }: { message: string }) {
  return <div data-testid="relation-skeleton" className="skeleton-boundary skeleton-relation"><LoadingStatus message={message} /><Skeleton className="skeleton-heading" width="62%" /><Lines count={3} /></div>;
}
