// App shell: header with the sidekick, tabs, and the current page.
// Owner: shared. Keep this small; real UI lives in pages/ and components/.

import { useState } from "react";
import mascot from "./assets/sidekick/mascot.svg";
import Dashboard from "./pages/Dashboard.jsx";
import Test from "./pages/Test.jsx";
import Upload from "./pages/Upload.jsx";
import { SIDEKICK_NAME } from "./lib/config.js";

// Tab label -> page. Each page shows its own sidekick.
const PAGES = { Dashboard, "Add course": Upload, Test };

export default function App() {
  const [page, setPage] = useState("Dashboard");
  const Page = PAGES[page];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <header className="flex items-center gap-3">
          <img src={mascot} alt={SIDEKICK_NAME} className="h-10 w-auto" />
          <h1 className="text-2xl font-bold tracking-tight">
            Locked<span className="text-amber-400">In</span>
          </h1>
        </header>

        <nav className="flex flex-wrap gap-2">
          {Object.keys(PAGES).map((name) => (
            <button
              key={name}
              onClick={() => setPage(name)}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                name === page ? "bg-amber-400 text-slate-950" : "bg-slate-800 text-slate-200 hover:bg-slate-700"
              }`}
            >
              {name}
            </button>
          ))}
        </nav>

        <main>
          <Page />
        </main>
      </div>
    </div>
  );
}
