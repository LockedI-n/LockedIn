// Course mastery bar, weighted by grading weight.
// Owner: Person 3 (Dashboard, Sidekick, Progress).
// TODO: compute weighted mastery from course.topics and course.weights.

export default function MasteryBar({ percent = 0 }) {
  return (
    <div className="h-3 w-full rounded-full bg-slate-800">
      <div className="h-3 rounded-full bg-emerald-500" style={{ width: `${percent}%` }} />
    </div>
  );
}
