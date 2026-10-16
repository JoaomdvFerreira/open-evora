import type { AnchorHTMLAttributes, MouseEvent } from "react";
import { parseUrlState, serializeUrlState, type ExplorerUrlState } from "./urlState";

type Destination = Partial<ExplorerUrlState>;

/** Keep link destinations and History API navigation on the same URL contract. */
export function explorerHref(destination: Destination, fragment?: string): string {
  const state = { ...parseUrlState(window.location.search), ...destination };
  const search = serializeUrlState(state);
  return `${window.location.pathname}${search}${fragment ? `#${encodeURIComponent(fragment)}` : ""}`;
}

type ExplorerLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "onClick"> & {
  to: Destination;
  fragment?: string;
  onNavigate: () => void;
};

export function ExplorerLink({ to, fragment, onNavigate, ...props }: ExplorerLinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
        (event.currentTarget.target && event.currentTarget.target !== "_self") || event.currentTarget.hasAttribute("download")) return;
    event.preventDefault();
    onNavigate();
  }

  return <a {...props} href={explorerHref(to, fragment)} onClick={handleClick} />;
}
