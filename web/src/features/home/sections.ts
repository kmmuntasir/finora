import { msg } from "@/i18n";

/** Rows on the home page that the user can reorder or hide. */
export const HOME_SECTIONS = [
  { id: "resume", label: msg("Continue watching") },
  { id: "nextup", label: msg("Next up") },
  { id: "listening", label: msg("Continue listening") },
  { id: "latest", label: msg("Recently added") },
] as const;

export type HomeSectionId = (typeof HOME_SECTIONS)[number]["id"];

export interface HomeSection {
  id: HomeSectionId;
  visible: boolean;
}

const IDS = new Set<string>(HOME_SECTIONS.map((section) => section.id));

/** "nextup,-resume" → ordered sections; unknown ids are dropped, missing ones appended. */
export function parseHomeSections(value: string): HomeSection[] {
  const seen = new Set<string>();
  const sections: HomeSection[] = [];
  for (const raw of value.split(",")) {
    const hidden = raw.startsWith("-");
    const id = raw.replace(/^-/, "").trim();
    if (!IDS.has(id) || seen.has(id)) continue;
    seen.add(id);
    sections.push({ id: id as HomeSectionId, visible: !hidden });
  }
  for (const section of HOME_SECTIONS) {
    if (!seen.has(section.id)) sections.push({ id: section.id, visible: true });
  }
  return sections;
}

export function serializeHomeSections(sections: HomeSection[]): string {
  return sections.map((section) => (section.visible ? section.id : `-${section.id}`)).join(",");
}
