export function confirmDiscard(dirty: boolean, message = 'Discard unsaved changes?'): boolean {
  if (!dirty) return true;
  return window.confirm(message);
}
