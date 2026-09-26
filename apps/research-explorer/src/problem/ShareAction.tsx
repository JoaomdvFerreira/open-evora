import { useState } from "react";

function copyCurrentLink(url: string): Promise<void> {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(url);
  const control = document.createElement("textarea");
  control.value = url;
  control.setAttribute("readonly", "");
  control.style.position = "fixed";
  control.style.opacity = "0";
  document.body.append(control);
  control.select();
  const copied = document.execCommand("copy");
  control.remove();
  return copied ? Promise.resolve() : Promise.reject(new Error("copy unavailable"));
}

/**
 * Shares the current canonical Problem URL, falling back to an accessible copy-link action.
 * `icon` is an optional decorative glyph rendered before the label and hidden from the
 * accessibility tree; the visible "Partilhar" label always remains the accessible name,
 * even where a caller's CSS visually reduces the control to its icon.
 */
export function ShareAction({ title, icon }: { title: string; icon?: string }) {
  const [message, setMessage] = useState("");
  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        setMessage("Ligação partilhada.");
      } catch (error) {
        if ((error as DOMException).name !== "AbortError") setMessage("Não foi possível partilhar a ligação.");
      }
      return;
    }
    try {
      await copyCurrentLink(url);
      setMessage("Ligação copiada.");
    } catch {
      setMessage("Não foi possível copiar a ligação.");
    }
  }
  return <div className="problem-share-action"><button type="button" onClick={share} aria-describedby="problem-share-status">{icon ? <><span aria-hidden="true" className="problem-share-action-icon">{icon}</span><span className="problem-share-action-label">Partilhar</span></> : "Partilhar"}</button><span id="problem-share-status" className="visually-hidden" aria-live="polite">{message}</span></div>;
}
