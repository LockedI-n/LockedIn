// Daily progress ring. 50 = studied, 100 = passed a test.
// Owner: Person 3 (Dashboard, Sidekick, Progress).
// TODO: real SVG ring with framer-motion animation.

export default function ProgressRing({ percent = 0 }) {
  return <div className="text-slate-400">Ring placeholder: {percent}%</div>;
}
