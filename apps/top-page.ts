import type { LocalizedText } from "../core/model/scenario-schema.ts";
import { renderSimplePage } from "../core/view/simple-page.ts";
import { title as ghostMansionTitle } from "./ghost-mansion/text.ts";
import { title as moodwalkTitle } from "./moodwalk/text.ts";

const productName: LocalizedText = { en: "Haunted Graph Kit", ja: "Haunted Graph Kit" };

const root = document.getElementById("app");
if (root !== null) {
  renderSimplePage(root, {
    title: productName,
    links: [
      { label: ghostMansionTitle, href: `${import.meta.env.BASE_URL}ghost-mansion/` },
      { label: moodwalkTitle, href: `${import.meta.env.BASE_URL}moodwalk/` },
      {
        label: { en: "Core demo", ja: "コアのデモ" },
        href: `${import.meta.env.BASE_URL}core-demo/`,
      },
    ],
  });
}
