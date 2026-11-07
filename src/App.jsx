// App shell: header with the sidekick, tabs, and the current page.
// Owner: shared. Keep this small; real UI lives in pages/ and components/.

import { useState } from "react";
import Sidekick from "./components/Sidekick.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Test from "./pages/Test.jsx";
import Upload from "./pages/Upload.jsx";
import { SIDEKICK_NAME } from "./lib/config.js";

const PAGES = { Dashboard, Upload, Test };

export default function App() {
  const [page, setPage] = useState("Dashboard");
  const Page = PAGES[page];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <header className="space-y-4">
          <h1 className="text-2xl font-bold">
            Study Sidekick <span className="text-amber-400">{SIDEKICK_NAME}</span>
          </h1>
          <Sidekick message={`Hey! I'm ${SIDEKICK_NAME}. What are we studying today?`} />
        </header>

        <nav className="flex gap-2">
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
