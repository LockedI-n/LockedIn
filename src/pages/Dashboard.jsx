// Dashboard: today's habits, daily ring, mastery bars, streaks.
// Owner: Person 3 (Dashboard, Sidekick, Progress).

import HabitCard from "../components/HabitCard.jsx";
import MasteryBar from "../components/MasteryBar.jsx";
import ProgressRing from "../components/ProgressRing.jsx";
import { sampleCourse, sampleHabits } from "../lib/sampleData.js";

export default function Dashboard() {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Dashboard</h2>
      <ProgressRing percent={50} />
      <div>
        <div className="mb-1 text-sm text-slate-400">{sampleCourse.name} mastery</div>
        <MasteryBar percent={60} />
      </div>
      {sampleHabits.map((h) => (
        <HabitCard key={h.id} habit={h} />
      ))}
    </section>
  );
}
