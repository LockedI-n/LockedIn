// Small, fictional student state used only when explicitly loaded with ?demo.
import { todayISO, addDays } from "./storage.js";

export function buildDemoState() {
  const today = todayISO();
  const day = (offset) => addDays(today, offset);

  const courses = [
    {
      id: "cmpt276",
      name: "CMPT 276",
      weights: [
        { item: "Requirements and design proposal", percent: 10, date: day(-14), group: "Team project", covers: null },
        { item: "Implementation milestone", percent: 10, date: day(9), group: "Team project", covers: null },
        { item: "Final project and presentation", percent: 20, date: day(30), group: "Team project", covers: null },
        { item: "Midterm", percent: 20, date: day(5), group: "Exams", covers: ["Requirements Engineering", "Agile Development", "Software Design"] },
        { item: "Final", percent: 40, date: day(35), group: "Exams", covers: null },
      ],
      topics: [
        { name: "Requirements Engineering", week: 1, score: 85, summary: "Requirements engineering identifies what users and other stakeholders need from a software system. Clear functional and quality requirements help a team agree on scope and guide design, implementation, and testing." },
        { name: "Agile Development", week: 2, score: 72, summary: "Agile development delivers software in short iterations and uses feedback to adjust the plan. Teams keep work visible, coordinate regularly, and refine requirements as they learn more about the problem." },
        { name: "Software Design", week: 3, score: 45, summary: "Software design turns requirements into components, interfaces, and responsibilities. A good design manages dependencies and makes the system easier to change, test, and understand." },
        { name: "Software Testing", week: 4, score: null, summary: "Software testing checks whether the implementation behaves as expected and exposes defects before release. Unit, integration, and system tests examine different levels, while automated tests make regressions easier to catch." },
      ],
    },
    {
      id: "cmpt225",
      name: "CMPT 225",
      weights: [
        { item: "Programming assignments", percent: 20, date: day(12), group: "Coursework", covers: null },
        { item: "Midterm", percent: 30, date: day(4), group: "Exams", covers: ["Algorithm analysis", "Linked lists", "Trees"] },
        { item: "Final", percent: 50, date: day(32), group: "Exams", covers: null },
      ],
      topics: [
        { name: "Algorithm analysis", week: 2, score: 88, summary: "Algorithm analysis estimates how resource use grows with input size. Asymptotic notation helps compare growth rates while ignoring machine-specific constants and small inputs." },
        { name: "Linked lists", week: 4, score: 60, summary: "Linked lists store values in nodes connected by references. Insertions and removals can be efficient when the target position is known, while indexed access requires traversal." },
        { name: "Trees", week: 7, score: null, summary: "Trees represent hierarchical relationships using parent and child nodes. Traversal orders provide different ways to visit nodes and support operations such as searching and expression evaluation." },
        { name: "Graphs", week: 10, score: null, summary: "Graphs model relationships with vertices and edges, which may be directed or weighted. Breadth-first and depth-first search explore reachable vertices and form the basis of many graph algorithms." },
      ],
    },
  ];

  const habits = [];
  for (const course of courses) {
    const topicNames = course.topics.map((topic) => topic.name);
    for (let offset = -5; offset <= -1; offset += 1) {
      const topic = topicNames[(Math.abs(offset) - 1) % topicNames.length];
      habits.push({
        id: `${course.id}-${day(offset)}`,
        courseId: course.id,
        topic,
        date: day(offset),
        studied: true,
        tested: offset % 2 === 0,
        score: offset % 2 === 0 ? course.topics.find((item) => item.name === topic).score ?? 78 : null,
      });
    }
  }

  // One in-progress item and one untouched item make the live demo clickable.
  habits.push(
    { id: `cmpt276-${today}`, courseId: "cmpt276", topic: "Software Design", date: today, studied: true, tested: false, score: null },
    { id: `cmpt225-${today}`, courseId: "cmpt225", topic: "Trees", date: today, studied: false, tested: false, score: null },
  );

  return { courses, habits, streaks: {} };
}
