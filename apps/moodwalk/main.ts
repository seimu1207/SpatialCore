import { renderSimplePage } from "../../core/view/simple-page.ts";
import { backLink, body, title } from "./text.ts";

const root = document.getElementById("app");
if (root !== null) {
  renderSimplePage(root, {
    title,
    body,
    links: [{ label: backLink, href: import.meta.env.BASE_URL }],
  });
}
