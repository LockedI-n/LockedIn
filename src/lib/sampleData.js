// Fake data so everyone can build UI before the AI is wired up.
// These shapes are the shared contracts. Do not change them without telling the team.
// Owner: Person 2 (contracts), used by everyone.

/**
 * @typedef {Object} WeightItem
 * @property {string} item       e.g. "Final"
 * @property {number} percent    e.g. 40
 * @property {string|null} date  "YYYY-MM-DD" or null if unknown
 */

/**
 * @typedef {Object} Topic
 * @property {string} name
 * @property {number|null} week
 * @property {string} summary    filled in after slides are uploaded
 * @property {number|null} score latest test score 0 to 100, null if never tested
 */

/**
 * @typedef {Object} Course
 * @property {string} id         e.g. "cmpt459"
 * @property {string} name       e.g. "CMPT 459"
 * @property {WeightItem[]} weights
 * @property {Topic[]} topics
 */

/**
 * One habit per course per day.
 * @typedef {Object} Habit
 * @property {string} id
 * @property {string} courseId
 * @property {string} topic
 * @property {string} date        "YYYY-MM-DD"
 * @property {boolean} studied
 * @property {boolean} tested
 * @property {number|null} score
 */

/**
 * @typedef {Object} QuizQuestion
 * @property {string} question
 * @property {string[]} options  always 4 options
 * @property {number} answer     index of the correct option (0 to 3)
 * @property {string} explanation
 */

/**
 * Result of grading a Feynman or written answer.
 * @typedef {Object} Grade
 * @property {number} score       0 to 100
 * @property {string[]} gotRight
 * @property {string[]} missed
 * @property {string} sidekickMessage
 */

/**
 * Everything saved in localStorage under the key "study-sidekick".
 * @typedef {Object} AppState
 * @property {Course[]} courses
 * @property {Habit[]} habits
 * @property {Object<string, number>} streaks  courseId -> streak in days
 */

/** @type {Course} */
export const sampleCourse = {
  id: "cmpt459",
  name: "CMPT 459",
  weights: [
    { item: "Assignments", percent: 30, date: null },
    { item: "Midterm", percent: 30, date: "2026-10-22" },
    { item: "Final", percent: 40, date: "2026-12-10" },
  ],
  topics: [
    {
      name: "Data Preprocessing",
      week: 2,
      summary:
        "Cleaning data, handling missing values, normalization (min-max, z-score), and discretization.",
      score: 85,
    },
    {
      name: "Frequent Pattern Mining",
      week: 4,
      summary:
        "Finding itemsets that appear often. Apriori uses the rule that subsets of frequent itemsets are frequent. Support and confidence measure rules.",
      score: 55,
    },
    {
      name: "Decision Trees",
      week: 5,
      summary:
        "Split data on the feature with the best information gain or Gini index. Pruning prevents overfitting.",
      score: null,
    },
    {
      name: "Clustering",
      week: 8,
      summary: "",
      score: null,
    },
  ],
};

/** @type {Habit[]} */
export const sampleHabits = [
  { id: "h1", courseId: "cmpt459", topic: "Frequent Pattern Mining", date: "2026-11-07", studied: true, tested: true, score: 55 },
  { id: "h2", courseId: "cmpt459", topic: "Decision Trees", date: "2026-11-08", studied: true, tested: false, score: null },
  { id: "h3", courseId: "cmpt459", topic: "Frequent Pattern Mining", date: "2026-11-09", studied: false, tested: false, score: null },
];

/** @type {QuizQuestion[]} */
export const sampleQuiz = [
  {
    question: "What does a decision tree use to choose the best split?",
    options: ["Random choice", "Information gain or Gini index", "Alphabetical order of features", "The number of rows"],
    answer: 1,
    explanation: "Splits are chosen to make child nodes as pure as possible, measured by information gain or Gini.",
  },
  {
    question: "Why do we prune a decision tree?",
    options: ["To make it deeper", "To reduce overfitting", "To add more features", "To speed up data loading"],
    answer: 1,
    explanation: "A very deep tree memorizes the training data. Pruning removes branches that do not help on new data.",
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
    explanation: "Entropy measures disorder. An even mix of classes is the most uncertain.",
  },
];

/** @type {Grade} */
export const sampleGrade = {
  score: 72,
  gotRight: ["Explained that splits aim to make groups purer", "Mentioned overfitting"],
  missed: ["Did not explain how information gain is calculated", "Did not mention pruning"],
  sidekickMessage:
    "Ooh, I think I get why trees split now! But how do you decide which split is best? Teach me that part tomorrow?",
};

/** @type {AppState} */
export const sampleState = {
  courses: [sampleCourse],
  habits: sampleHabits,
  streaks: { cmpt459: 3 },
};
