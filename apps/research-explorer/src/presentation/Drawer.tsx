import { useEffect, useId, useRef, type KeyboardEvent, type MouseEvent, type ReactNode, type RefObject, type SyntheticEvent } from "react";
import { IconStateClosed } from "./icons";

/**
 * Modal side drawer built on the native `<dialog>` element. The caller
 * mounts it to open it and unmounts it to close it — there is no global
 * provider/store and no `open` prop.
 *
 * `showModal()` supplies the modal semantics: the dialog sits in the top
 * layer, the rest of the document is inert (not focusable or clickable), and
 * focus moves inside. Environments without `showModal()` (jsdom) fall back
 * to the plain `open` attribute.
 *
 * Dismissal (close button, `Esc`, backdrop click) calls `onDismiss`; once the
 * caller unmounts the drawer after such a dismissal, focus returns to
 * `returnFocusRef` (or, without it, the element that was focused when the
 * drawer opened — not reliable where clicking a button does not focus it).
 * Unmounting for any other reason (e.g. the caller navigating away)
 * restores nothing, so the next view's own focus behaviour takes over.
 */
export interface DrawerProps {
  /** Visible title; also the dialog's accessible name. */
  title: string;
  /** Optional supporting line under the title (e.g. a truthful item count). */
  description?: ReactNode;
  onDismiss: () => void;
  /** The control that opened the drawer; receives focus again after a dismissal. */
  returnFocusRef?: RefObject<HTMLElement>;
  children: ReactNode;
}

export function Drawer({ title, description, onDismiss, returnFocusRef, children }: DrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<Element | null>(null);
  const dismissedRef = useRef(false);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    openerRef.current ??= returnFocusRef?.current ?? document.activeElement;
    if (!dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }
    return () => {
      if (!dismissedRef.current) return;
      const opener = openerRef.current;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [returnFocusRef]);

  const dismiss = () => {
    dismissedRef.current = true;
    onDismiss();
  };

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    dismiss();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    dismiss();
  };

  // The panel fills the dialog box, so a click whose target is the dialog
  // itself landed on its ::backdrop.
  const handleClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) dismiss();
  };

  return (
    <dialog ref={dialogRef} className="ui-drawer" aria-labelledby={titleId} aria-modal="true" onCancel={handleCancel} onKeyDown={handleKeyDown} onClick={handleClick}>
      <div className="ui-drawer-panel">
        <header className="ui-drawer-header">
          <div className="ui-drawer-heading">
            <h2 id={titleId} className="ui-drawer-title">
              {title}
            </h2>
            {description && <p className="ui-drawer-description">{description}</p>}
          </div>
          <button type="button" className="ui-drawer-close" aria-label="Fechar" onClick={dismiss}>
            <IconStateClosed />
          </button>
        </header>
        <div className="ui-drawer-body">{children}</div>
      </div>
    </dialog>
  );
}
