// One habit for today (one per course per day).
// Owner: Person 3 (Dashboard, Sidekick, Progress).
// TODO: buttons for "I studied" and "Prove it" (go to Test page).

export default function HabitCard({ habit }) {
  if (!habit) return null;
  return (
    <div className="rounded-xl bg-slate-900 p-4 text-slate-100">
      <div className="font-medium">{habit.topic}</div>
      <div className="text-sm text-slate-400">
        {habit.date} | studied: {String(habit.studied)} | tested: {String(habit.tested)}
      </div>
    </div>
  );
}
