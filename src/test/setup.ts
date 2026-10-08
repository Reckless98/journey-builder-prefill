import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(cleanup);

/**
 * jsdom has the `<dialog>` element but not its modal methods. These stand-ins reproduce the
 * parts of the native behaviour the app relies on: the `open` state, the `close` event, and
 * returning focus to the element that was focused when the dialog opened.
 *
 * What they cannot reproduce, and what is therefore checked in a real browser instead, is
 * closing with Escape, the focus trap and the inert background.
 */
const openers = new WeakMap<HTMLDialogElement, Element | null>();

/** Records the opener and exposes open state; it does not emulate a browser's modal top layer. */
HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
  openers.set(this, document.activeElement);
  this.open = true;
};

/** Restores a connected opener and dispatches close so the component's normal cleanup runs. */
HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
  if (!this.open) return;
  this.open = false;
  const opener = openers.get(this);
  if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
  this.dispatchEvent(new Event('close'));
};
