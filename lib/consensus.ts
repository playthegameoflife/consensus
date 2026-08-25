/**
 * Consensus Scoring
 * Computes agreement between claims from multiple papers
 */

interface ConsensusResult {
  perPaperScores: Map<string, number>;
  aggregateScore: number;
  agreements: Array<{
    paperA: string;
    paperB: string;
    similarity: number;
    verdict: "agree" | "disagree" | "mixed";
  }>;
}

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

/**
 * Compute consensus scores for claims across multiple papers
 * @param claims Map of paperId -> claims array
 * @returns Consensus scores per paper and aggregate
 */
export async function scoreConsensus(
  claims: Map<string, string[]>
): Promise<ConsensusResult> {
  const paperIds = Array.from(claims.keys());
  const perPaperScores = new Map<string, number>();
  const agreements: ConsensusResult["agreements"] = [];

  if (paperIds.length < 2) {
    // Single paper - no consensus to compute
    const score = claims.size > 0 ? 1 : 0;
    claims.forEach((_, paperId) => perPaperScores.set(paperId, score));
    return {
      perPaperScores,
      aggregateScore: score,
      agreements,
    };
  }

  // Compute pairwise similarities
  for (let i = 0; i < paperIds.length; i++) {
    for (let j = i + 1; j < paperIds.length; j++) {
      const paperA = paperIds[i];
      const paperB = paperIds[j];
      const claimsA = claims.get(paperA) || [];
      const claimsB = claims.get(paperB) || [];

      // Compute similarity between claim sets
      const similarity = computeJaccardSimilarity(claimsA, claimsB);

      // Use Groq to get a more nuanced verdict if we have an API key
      let verdict: "agree" | "disagree" | "mixed" = similarity > 0.3 ? "agree" : "mixed";

      if (GROQ_API_KEY && similarity > 0.1 && similarity < 0.9) {
        verdict = await getGroqVerdict(claimsA, claimsB);
      }

      agreements.push({ paperA, paperB, similarity, verdict });
    }
  }

  // Calculate per-paper consensus score
  // A paper's score = average similarity with all other papers
  for (const paperId of paperIds) {
    let totalSimilarity = 0;
    let count = 0;

    for (const agreement of agreements) {
      if (agreement.paperA === paperId || agreement.paperB === paperId) {
        // Weight by verdict
        let weight = agreement.similarity;
        if (agreement.verdict === "agree") weight *= 1;
        else if (agreement.verdict === "disagree") weight *= -1;
        else weight *= 0.3;

        totalSimilarity += weight;
        count++;
      }
    }

    const score = count > 0 ? totalSimilarity / count : 0;
    // Normalize to -1 to 1 range
    perPaperScores.set(paperId, Math.max(-1, Math.min(1, score)));
  }

  // Aggregate consensus
  const allScores = Array.from(perPaperScores.values());
  const aggregateScore =
    allScores.length > 0
      ? allScores.reduce((a, b) => a + b, 0) / allScores.length
      : 0;

  return {
    perPaperScores,
    aggregateScore: Math.max(-1, Math.min(1, aggregateScore)),
    agreements,
  };
}

/**
 * Simple Jaccard similarity between claim sets
 * Based on word overlap
 */
function computeJaccardSimilarity(claimsA: string[], claimsB: string[]): number {
  if (claimsA.length === 0 || claimsB.length === 0) return 0;

  const wordsA = new Set(normalizeWords(claimsA.join(" ")));
  const wordsB = new Set(normalizeWords(claimsB.join(" ")));

  const intersection = new Set([...wordsA].filter((x) => wordsB.has(x)));
  const union = new Set([...wordsA, ...wordsB]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Normalize words for comparison
 */
function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

/**
 * Use Groq to determine if two sets of claims agree or contradict
 */
async function getGroqVerdict(
  claimsA: string[],
  claimsB: string[]
): Promise<"agree" | "disagree" | "mixed"> {
  if (!GROQ_API_KEY) return "mixed";

  const prompt = `Compare these two sets of research findings and determine if they AGREE, DISAGREE, or are MIXED (partially agree, unrelated, or insufficient overlap).

Findings from Paper A:
${claimsA.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Findings from Paper B:
${claimsB.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Respond with ONLY one word: AGREE, DISAGREE, or MIXED`;

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 20,
        temperature: 0,
      }),
    });

    if (!res.ok) return "mixed";

    const data = await res.json();
    const verdict = data.choices?.[0]?.message?.content?.trim().toUpperCase() || "";

    if (verdict.includes("AGREE")) return "agree";
    if (verdict.includes("DISAGREE")) return "disagree";
    return "mixed";
  } catch {
    return "mixed";
  }
}

/**
 * Quick consensus check - returns a simple score without detailed analysis
 */
export function quickConsensusScore(claims: string[][]): number {
  if (claims.length < 2) return 1;
  if (claims.some((c) => c.length === 0)) return 0;

  // Compute average pairwise Jaccard
  let totalSimilarity = 0;
  let count = 0;

  for (let i = 0; i < claims.length; i++) {
    for (let j = i + 1; j < claims.length; j++) {
      totalSimilarity += computeJaccardSimilarity(claims[i], claims[j]);
      count++;
    }
  }

  return count > 0 ? totalSimilarity / count : 0;
}
