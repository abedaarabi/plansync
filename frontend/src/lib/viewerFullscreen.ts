/** Subscribe to browser fullscreen changes for PDF / BIM viewer chrome. */
export function subscribeFullscreenChange(onChange: (active: boolean) => void): () => void {
  const onFs = () => onChange(Boolean(document.fullscreenElement));
  document.addEventListener("fullscreenchange", onFs);
  return () => document.removeEventListener("fullscreenchange", onFs);
}

export async function toggleElementFullscreen(el: HTMLElement | null): Promise<void> {
  if (!el) return;
  if (document.fullscreenElement) {
    await document.exitFullscreen();
    return;
  }
  await el.requestFullscreen();
}
