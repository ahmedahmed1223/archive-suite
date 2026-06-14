/**
 * DragPreview helpers — custom drag ghost images (§1892).
 *
 * HTML5 only allows setDragImage() during a dragstart handler, synchronously.
 * We build a small canvas badge showing the dragged item count and attach it
 * as the ghost image. The canvas is never inserted into the DOM.
 */

/**
 * Build and set a count-badge ghost image on a drag event.
 *
 * @param {DragEvent} event
 * @param {number} count   — number of items being dragged
 */
export function setDragCountBadge(event, count) {
  if (count <= 1 || !event.dataTransfer?.setDragImage) return;
  try {
    const canvas = document.createElement("canvas");
    const size = 36;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(124, 58, 237, 0.95)";
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${count > 9 ? 12 : 14}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(count), size / 2, size / 2);

    event.dataTransfer.setDragImage(canvas, size / 2, size / 2);
  } catch {
    /* setDragImage is unavailable in some environments (jsdom, Firefox quirks) */
  }
}
