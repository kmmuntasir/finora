/**
 * Copies text to the clipboard. `navigator.clipboard` exists only in secure
 * contexts, so over plain HTTP this falls back to a hidden text area and
 * `execCommand("copy")`, which browsers still allow inside a click.
 */
export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard) return navigator.clipboard.writeText(text);
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.append(area);
  area.select();
  const copied = document.execCommand("copy");
  area.remove();
  if (!copied) throw new Error("Copy was refused");
}
