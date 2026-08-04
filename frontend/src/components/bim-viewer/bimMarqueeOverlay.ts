/** Screen-space rubber-band for Ctrl/Cmd-drag multi-select in the BIM viewer. */

type BimMarqueeMode = "window" | "crossing";

type BimMarqueeRect = {
  /** Client-space top-left (for Fragments rectangleRaycast). */
  topLeft: { x: number; y: number };
  /** Client-space bottom-right. */
  bottomRight: { x: number; y: number };
  /** Left→right = window (fully inside); right→left = crossing. */
  mode: BimMarqueeMode;
  width: number;
  height: number;
};

export class BimMarqueeOverlay {
  private el: HTMLDivElement | null = null;
  private container: HTMLElement | null = null;
  private start = { x: 0, y: 0 };
  private current = { x: 0, y: 0 };
  private visible = false;

  attach(container: HTMLElement): void {
    this.detach();
    this.container = container;
    const el = document.createElement("div");
    el.className = "bim-marquee";
    el.setAttribute("aria-hidden", "true");
    el.hidden = true;
    container.appendChild(el);
    this.el = el;
  }

  begin(clientX: number, clientY: number): void {
    this.start = { x: clientX, y: clientY };
    this.current = { x: clientX, y: clientY };
    this.visible = true;
    this.paint();
  }

  update(clientX: number, clientY: number): void {
    if (!this.visible) return;
    this.current = { x: clientX, y: clientY };
    this.paint();
  }

  /** Returns the normalized rect, or null if the overlay was never shown. */
  end(): BimMarqueeRect | null {
    if (!this.visible) return null;
    const rect = this.toRect();
    this.hide();
    return rect;
  }

  cancel(): void {
    this.hide();
  }

  dispose(): void {
    this.detach();
  }

  private hide(): void {
    this.visible = false;
    if (this.el) {
      this.el.hidden = true;
      this.el.removeAttribute("data-mode");
    }
  }

  private detach(): void {
    this.el?.remove();
    this.el = null;
    this.container = null;
    this.visible = false;
  }

  private toRect(): BimMarqueeRect {
    const minX = Math.min(this.start.x, this.current.x);
    const maxX = Math.max(this.start.x, this.current.x);
    const minY = Math.min(this.start.y, this.current.y);
    const maxY = Math.max(this.start.y, this.current.y);
    return {
      topLeft: { x: minX, y: minY },
      bottomRight: { x: maxX, y: maxY },
      mode: this.current.x >= this.start.x ? "window" : "crossing",
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  private paint(): void {
    const el = this.el;
    const container = this.container;
    if (!el || !container || !this.visible) return;

    const bounds = container.getBoundingClientRect();
    const rect = this.toRect();
    const left = rect.topLeft.x - bounds.left;
    const top = rect.topLeft.y - bounds.top;

    el.hidden = false;
    el.dataset.mode = rect.mode;
    el.style.transform = `translate(${left}px, ${top}px)`;
    el.style.width = `${rect.width}px`;
    el.style.height = `${rect.height}px`;
  }
}
