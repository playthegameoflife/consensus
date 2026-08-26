import { Paper } from "./types";

export interface StudySnapshotData {
  population?: string;
  sampleSize?: string;
  duration?: string;
  location?: string;
  methods?: string;
  outcomes?: string;
  results?: string;
}

/**
 * Extract consensus.app's 7-field Study Snapshot from an abstract using
 * labeled-section parsing first (structured abstracts), then regex fallbacks.
 */
export function extractStudySnapshot(
  paper: Paper & { aiFinding?: string }
): StudySnapshotData {
  const abs = paper.abstract || "";
  if (!abs) return {};

  const snap: StudySnapshotData = {};
  const label = (name: string): string | null => {
    // Match "LABEL: value up to next ALL-CAPS LABEL or end"
    const re = new RegExp(`${name}:\\s*(.+?)(?=(?:[A-Z][A-Z\\s]{3,}:)|$)`, "s");
    const m = abs.match(re);
    return m ? m[1].trim().slice(0, 220) : null;
  };

  // --- Direct labeled sections (structured abstracts) ---
  const participants = label("PARTICIPANTS") || label("SUBJECTS") || label("PATIENTS");
  const methodsLabeled = label("METHODS") || label("DESIGN") || label("STUDY DESIGN");
  const setting = label("SETTING");
  const outcomesLabeled =
    label("OUTCOME MEASURES") || label("MEASURES") || label("INTERVENTIONS");
  const resultsLabeled = label("RESULTS");

  // --- Regex fallbacks ---
  const sampleMatch = abs.match(/(?:n\s*=\s*|N\s*=\s*)(\d[\d,]*)/) ||
    abs.match(/\b(\d[\d,]{1,6})\s+(?:participants|subjects|patients|adults|children|individuals)\b/i);
  const durationMatch = abs.match(
    /\b(\d+\s*(?:to\s*\d+\s*)?(?:weeks?|months?|years?)\b(?:\s+of\s+(?:follow-?up|treatment|intervention))?)/i
  );
  const locMatch = abs.match(
    /\b(?:in|from|across)\s+([A-Z][A-Za-z]+(?:[,\s]+[A-Z][A-Za-z]+){0,3}(?:hospital|university|clinic|center[sr]?|schools?))\b/
  );

  const methodPatterns: [RegExp, string][] = [
    [/\bdouble-blind\b/i, "Double-blind"],
    [/\brandomi[sz]ed\s+controlled\s+trial\b|\bRCT\b/i, "Randomized controlled trial"],
    [/\brandomi[sz]ed\b/i, "Randomized"],
    [/\bmeta-analysis\b/i, "Meta-analysis"],
    [/\bsystematic review\b/i, "Systematic review"],
    [/\bcross-?over\b/i, "Crossover trial"],
    [/\bcohort study\b|\bprospective cohort\b/i, "Cohort study"],
    [/\bcase-control\b/i, "Case-control"],
    [/\bcross-sectional\b/i, "Cross-sectional"],
    [/\bsurvey\b/i, "Survey"],
    [/\bin vitro\b/i, "In vitro"],
    [/\banimal stud|\bmice\b|\brats?\b/i, "Animal study"],
  ];
  const methodsFound = methodPatterns
    .filter(([re]) => re.test(abs))
    .map(([, label]) => label)
    .slice(0, 3);

  // Assemble
  if (participants || /participants|patients|subjects/i.test(abs.slice(0, 400)))
    snap.population = participants ||
      abs.match(/\b((?:healthy\s+)?[\w-]+\s+(?:adults|adolescents|children|students|men|women|mice|rats|patients))\b/i)?.[1];
  if (sampleMatch) snap.sampleSize = sampleMatch[0].replace(/^N\s*=\s*/i, "N = ").replace(/^n\s*=\s*/i, "n = ");
  if (durationMatch) snap.duration = durationMatch[1].trim();
  snap.location = setting || (locMatch ? locMatch[1] : undefined);
  snap.methods =
    methodsLabeled ||
    (methodsFound.length ? methodsFound.join(", ") : undefined);
  snap.outcomes = outcomesLabeled || undefined;
  snap.results = resultsLabeled
    ? resultsLabeled.slice(0, 260)
    : undefined;

  return snap;
}
