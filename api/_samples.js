// Fallback responses. Returned when there is no API key or Gemini fails,
// so the frontend can always be built and demoed.
// Shapes must match the contracts in README.md.
// Owner: Person 2 (AI and Backend).

export const sampleSyllabus = {
  weights: [
    { item: "Assignments", percent: 30, date: null },
    { item: "Midterm", percent: 30, date: "2026-10-22" },
    { item: "Final", percent: 40, date: "2026-12-10" },
  ],
  topics: [
    { name: "Data Preprocessing", week: 2, summary: "", score: null },
    { name: "Frequent Pattern Mining", week: 4, summary: "", score: null },
    { name: "Decision Trees", week: 5, summary: "", score: null },
    { name: "Clustering", week: 8, summary: "", score: null },
  ],
};

export const sampleSlides = {
  topics: [
    {
      name: "Decision Trees",
      summary:
        "A decision tree splits data on the feature with the best information gain or Gini index. Leaves hold class labels. Pruning removes branches to prevent overfitting.",
    },
  ],
};

export const sampleQuiz = {
  quiz: [
    {
      question: "What does a decision tree use to choose the best split?",
      options: ["Random choice", "Information gain or Gini index", "Alphabetical order of features", "The number of rows"],
      answer: 1,
      explanation: "Splits are chosen to make child nodes as pure as possible.",
    },
    {
      question: "Why do we prune a decision tree?",
      options: ["To make it deeper", "To reduce overfitting", "To add more features", "To speed up data loading"],
      answer: 1,
      explanation: "Pruning removes branches that do not help on new data.",
    },
    {
      question: "Which of these is a leaf node?",
      options: ["A node that splits on a feature", "The root", "A node that gives a final class label", "Any node with two children"],
      answer: 2,
      explanation: "Leaves are the end of a path and hold the predicted class.",
    },
    {
      question: "Entropy of a node is highest when:",
      options: ["All rows are one class", "Classes are evenly mixed", "The node has no rows", "The tree is pruned"],
      answer: 1,
      explanation: "An even mix of classes is the most uncertain.",
    },
  ],
};

export const sampleGrade = {
  score: 72,
  gotRight: ["Explained that splits aim to make groups purer", "Mentioned overfitting"],
  missed: ["Did not explain how information gain is calculated", "Did not mention pruning"],
  sidekickMessage:
    "Ooh, I think I get why trees split now! But how do you decide which split is best? Teach me that part tomorrow?",
};
