import { Paper } from "./types";

/**
 * Extract a one-line "KEY TAKEAWAY" from a paper's AI finding or abstract —
 * mirrors consensus.app's per-paper key takeaway line.
 */
export function extractKeyTakeaway(paper: Paper & { aiFinding?: string }): string {
  const source = paper.aiFinding || paper.abstract || "";
  if (!source) return "No abstract available.";

  // If aiFinding exists and isn't the fallback message, use its first sentence
  if (paper.aiFinding && !paper.aiFinding.startsWith("This paper may not")) {
    const first = paper.aiFinding.split(/(?<=[.!?])\s+/)[0];
    return first.length > 20 ? first : paper.aiFinding.slice(0, 180);
  }

  // From abstract: prefer the CONCLUSION/RESULTS section, else first sentence
  const abs = paper.abstract || "";
  if (!abs) return "No abstract available.";
  const conclusionMatch = abs.match(
    /(?:CONCLUSIONS?|RESULTS?|FINDINGS?):\s*([^.]{30,200}\.)/i
  );
  if (conclusionMatch) return conclusionMatch[1].trim();

  const first = abs.split(/(?<=[.!?])\s+/)[0] || abs.slice(0, 180);
  return first.length > 220 ? first.slice(0, 217) + "..." : first;
}

export interface PaperQualityBadge {
  label: string;
  icon: "eye" | "chat" | "journal" | "meta";
}

/**
 * Quality indicators matching consensus.app (OBSERVATIONAL STUDY,
 * HIGHLY CITED, TOP JOURNAL etc.)
 */
export function getQualityBadges(
  paper: Paper
): PaperQualityBadge[] {
  const badges: PaperQualityBadge[] = [];
  const types = (paper.publicationTypes || []).map((t) => t.toLowerCase());
  const titleLower = (paper.title || "").toLowerCase();
  const isMeta =
    titleLower.includes("meta-analysis") ||
    titleLower.includes("systematic review");
  const isTrial =
    types.includes("article") &&
    /\b(randomized|randomised|trial|cohort|cross-sectional|case-control|observational)\b/.test(titleLower + " " + (paper.fieldsOfStudy?.join(" ") || ""));

  if (/observational|cohort|cross-sectional|case-control/.test(titleLower)) {
    badges.push({ label: "OBSERVATIONAL STUDY", icon: "eye" });
  } else if (isTrial) {
    badges.push({ label: "CLINICAL STUDY", icon: "eye" });
  }
  if (paper.citationCount >= 200) {
    badges.push({
      label: paper.citationCount >= 1000 ? "HIGHLY CITED" : "WELL CITED",
      icon: "chat",
    });
  }
  if (isMeta) {
    badges.push({ label: "META-ANALYSIS", icon: "meta" });
  }
  return badges;
}
