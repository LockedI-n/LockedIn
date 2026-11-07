// Mastery weighted by grading weight.
// Owner: Person 3 (Dashboard, Sidekick, Progress).
//
// Each graded item (Midterm 20%, Final 40%, ...) shares its percent equally among
// the topics it covers. A topic's weight is the total it receives, so topics on
// heavier assessments count more toward mastery.
//   - item.covers = ["Clustering", ...]  -> only those topics (from the syllabus, or set by hand)
//   - item.covers missing / null         -> all topics (we don't know, so spread it evenly)
//   - item.covers = []                   -> no topics (e.g. participation)
// With no grading info at all, mastery is the plain average of topic scores.

import { MASTERY_THRESHOLD } from "./config.js";

const key = (s) => String(s ?? "").trim().toLowerCase();

// { topicName: weight in grade-percent points }
export function topicWeights(course) {
  const topics = course?.topics ?? [];
  const weights = Object.fromEntries(topics.map((t) => [t.name, 0]));
  if (!topics.length) return weights;

  for (const item of course.weights ?? []) {
    const percent = Number(item.percent) || 0;
    if (percent <= 0) continue;
    let covered = topics;
    if (Array.isArray(item.covers)) {
      const wanted = new Set(item.covers.map(key));
      covered = topics.filter((t) => wanted.has(key(t.name)));
      // Named topics we don't recognise: fall back to all topics instead of dropping the item.
      if (!covered.length && item.covers.length) covered = topics;
    }
    for (const t of covered) weights[t.name] += percent / covered.length;
  }
  return weights;
}

// 0-100. Unscored topics count as 0.
export function courseMastery(course) {
  const topics = course?.topics ?? [];
  if (!topics.length) return 0;
  const weights = topicWeights(course);
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  if (totalWeight <= 0) {
    return Math.round(topics.reduce((sum, t) => sum + (t.score ?? 0), 0) / topics.length);
  }
  const weighted = topics.reduce((sum, t) => sum + (t.score ?? 0) * weights[t.name], 0);
  return Math.round(weighted / totalWeight);
}

// Share of the course grade riding on a topic, e.g. 12.5 (percent).
export function topicShare(course, topicName) {
  const weights = topicWeights(course);
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  return total > 0 ? Math.round((weights[topicName] / total) * 1000) / 10 : null;
}

// Weak topics, most damaging first: how far below mastery x how much it's worth.
export function weakTopicsByImpact(course) {
  const weights = topicWeights(course);
  return (course?.topics ?? [])
    .filter((t) => t.score != null && t.score < MASTERY_THRESHOLD)
    .sort((a, b) => (MASTERY_THRESHOLD - b.score) * (weights[b.name] || 1) - (MASTERY_THRESHOLD - a.score) * (weights[a.name] || 1));
}
