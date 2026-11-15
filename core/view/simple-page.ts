import type { LocalizedText } from "../model/scenario-schema.ts";

export type SimplePage = {
  title: LocalizedText;
  body?: LocalizedText;
  links: { label: LocalizedText; href: string }[];
};

/** Renders a simple page into `root`. Always shows the `en` text. */
export function renderSimplePage(root: HTMLElement, page: SimplePage): void {
  document.title = page.title.en;
  root.replaceChildren();

  const h1 = document.createElement("h1");
  h1.textContent = page.title.en;
  root.appendChild(h1);

  if (page.body !== undefined) {
    const p = document.createElement("p");
    p.textContent = page.body.en;
    root.appendChild(p);
  }

  for (const link of page.links) {
    const a = document.createElement("a");
    a.href = link.href;
    a.textContent = link.label.en;
    const wrapper = document.createElement("p");
    wrapper.appendChild(a);
    root.appendChild(wrapper);
  }
}
