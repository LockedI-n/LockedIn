
import { useState } from "react";
import { getQuiz } from "../lib/api.js";
import { sampleCourse } from "../lib/sampleData.js";
import { QUIZ_COUNT } from "../lib/config.js";

const LETTERS = ["A", "B", "C", "D"];

export default function Test({ course = sampleCourse, onComplete }) {
  const [topicName, setTopicName] = useState("Decision Trees");
  const [quiz, setQuiz] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentQuestion, setCurrentQuestion] = useState(0);

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [fallback, setFallback] = useState(false);

  const topic = course.topics.find((t) => t.name === topicName);
  const question = quiz[currentQuestion];

  // Generate a quiz for the selected topic.
  async function startQuiz() {
    if (!topic) return;

    setLoading(true);
    setError("");
    setQuiz([]);
    setAnswers({});
    setSubmitted(false);
    setCurrentQuestion(0);
    setFallback(false);

    try {
      const result = await getQuiz({
        courseName: course.name,
        topic: topic.name,
        summary: topic.summary,
        count: QUIZ_COUNT,
      });

      if (!Array.isArray(result.quiz) || result.quiz.length === 0) {
        throw new Error("No questions were returned. Please try again.");
      }

      setQuiz(result.quiz);
      setFallback(Boolean(result.fallback));
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Record the selected answer for the current question.
  function selectAnswer(optionIndex) {
    if (submitted) return;

    setAnswers((previous) => ({
      ...previous,
      [currentQuestion]: optionIndex,
    }));
  }

  // Calculate the result and notify the parent component.
  function submitQuiz() {
    if (Object.keys(answers).length !== quiz.length) return;

    const correct = quiz.reduce(
      (total, q, index) =>
        total + (answers[index] === q.answer ? 1 : 0),
      0
    );

    const score = Math.round((correct / quiz.length) * 100);

    setSubmitted(true);

    onComplete?.({
      courseId: course.id,
      topic: topicName,
      score,
      total: quiz.length,
      correct,
      quiz,
    });
  }

  function resetQuiz() {
    setQuiz([]);
    setAnswers({});
    setCurrentQuestion(0);
    setSubmitted(false);
    setError("");
    setFallback(false);
  }

  const answeredCount = Object.keys(answers).length;
  const score = quiz.length
    ? quiz.reduce(
        (total, q, index) =>
          total + (answers[index] === q.answer ? 1 : 0),
        0
      )
    : 0;

  const percentage = quiz.length
    ? Math.round((score / quiz.length) * 100)
    : 0;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Knowledge Check</h2>
        <p className="mt-1 text-sm text-slate-400">
          Test what you've learned with Sparky.
        </p>
      </div>

      {/* TOPIC SELECTION */}
      {quiz.length === 0 && (
        <div className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div>
            <label className="mb-2 block text-sm font-medium">
              Course
            </label>
            <div className="rounded-lg bg-slate-800 px-4 py-3 text-slate-300">
              {course.name}
            </div>
          </div>

          <div>
            <label
              htmlFor="topic"
              className="mb-2 block text-sm font-medium"
            >
              Select a topic
            </label>

            <select
              id="topic"
              value={topicName}
              onChange={(e) => setTopicName(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 outline-none focus:border-amber-400"
            >
              {course.topics.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {topic?.summary ? (
            <div className="rounded-lg bg-slate-800/70 p-4">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-400">
                Topic summary
              </p>
              <p className="text-sm leading-relaxed text-slate-300">
                {topic.summary}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              No lecture summary is available for this topic yet.
            </p>
          )}

          {error && (
            <p className="rounded-lg bg-rose-500/10 p-3 text-sm text-rose-400">
              {error}
            </p>
          )}

          <button
            onClick={startQuiz}
            disabled={loading || !topic}
            className="w-full rounded-lg bg-amber-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Generating questions..." : "Generate Quiz"}
          </button>
        </div>
      )}

      {/* ACTIVE QUIZ */}
      {quiz.length > 0 && !submitted && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-amber-400">
                {course.name}
              </p>
              <p className="text-sm text-slate-400">{topicName}</p>
            </div>
            <span className="text-sm text-slate-400">
              {answeredCount}/{quiz.length} answered
            </span>
          </div>

          {fallback && (
            <p className="text-xs text-amber-400">
              Using sample questions because AI generation is unavailable.
            </p>
          )}

          {/* Progress bar */}
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-amber-400 transition-all"
              style={{
                width: `${((currentQuestion + 1) / quiz.length) * 100}%`,
              }}
            />
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="mb-3 text-sm font-medium text-slate-400">
              Question {currentQuestion + 1} of {quiz.length}
            </p>

            <h3 className="mb-6 text-lg font-semibold leading-relaxed">
              {question.question}
            </h3>

            <div className="space-y-3">
              {question.options.map((option, index) => {
                const selected = answers[currentQuestion] === index;

                return (
                  <button
                    key={index}
                    onClick={() => selectAnswer(index)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition ${
                      selected
                        ? "border-amber-400 bg-amber-400/10 text-amber-300"
                        : "border-slate-700 bg-slate-800 hover:border-slate-500"
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                        selected
                          ? "bg-amber-400 text-slate-950"
                          : "bg-slate-700 text-slate-300"
                      }`}
                    >
                      {LETTERS[index]}
                    </span>
                    <span className="text-sm">{option}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex gap-3">
            <button
              onClick={() =>
                setCurrentQuestion((previous) => previous - 1)
              }
              disabled={currentQuestion === 0}
              className="flex-1 rounded-lg bg-slate-800 px-4 py-3 text-sm font-medium hover:bg-slate-700 disabled:opacity-30"
            >
              Previous
            </button>

            {currentQuestion < quiz.length - 1 ? (
              <button
                onClick={() =>
                  setCurrentQuestion((previous) => previous + 1)
                }
                className="flex-1 rounded-lg bg-amber-400 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-amber-300"
              >
                Next
              </button>
            ) : (
              <button
                onClick={submitQuiz}
                disabled={answeredCount !== quiz.length}
                className="flex-1 rounded-lg bg-amber-400 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-amber-300 disabled:opacity-40"
              >
                Submit Quiz
              </button>
            )}
          </div>

          {answeredCount !== quiz.length && (
            <p className="text-center text-xs text-slate-500">
              Answer all questions before submitting.
            </p>
          )}
        </div>
      )}

      {/* RESULTS */}
      {quiz.length > 0 && submitted && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center">
            <p className="text-sm font-medium text-slate-400">
              Quiz completed!
            </p>

            <p
              className={`my-3 text-5xl font-bold ${
                percentage >= 70
                  ? "text-emerald-400"
                  : "text-amber-400"
              }`}
            >
              {percentage}%
            </p>

            <p className="text-sm text-slate-300">
              You got {score} out of {quiz.length} questions correct.
            </p>

            <p className="mt-2 text-sm text-slate-400">
              {percentage >= 70
                ? "Great work! You're making progress."
                : "Keep practicing! Review the explanations below."}
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Answer Review</h3>

            {quiz.map((q, index) => {
              const correct = answers[index] === q.answer;

              return (
                <div
                  key={index}
                  className="rounded-xl border border-slate-800 bg-slate-900 p-4"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <p className="font-medium">
                      {index + 1}. {q.question}
                    </p>
                    <span
                      className={`shrink-0 text-sm font-semibold ${
                        correct ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {correct ? "Correct" : "Incorrect"}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm">
                    {q.options.map((option, optionIndex) => {
                      const isCorrect = optionIndex === q.answer;
                      const isSelected = answers[index] === optionIndex;

                      return (
                        <div
                          key={optionIndex}
                          className={`rounded-lg p-3 ${
                            isCorrect
                              ? "bg-emerald-500/10 text-emerald-300"
                              : isSelected
                                ? "bg-rose-500/10 text-rose-300"
                                : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          <span className="mr-2 font-bold">
                            {LETTERS[optionIndex]}.
                          </span>
                          {option}
                          {isCorrect && " ✓"}
                          {isSelected && !isCorrect && " (Your answer)"}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-3 rounded-lg bg-slate-800/70 p-3">
                    <p className="mb-1 text-xs font-semibold uppercase text-amber-400">
                      Explanation
                    </p>
                    <p className="text-sm leading-relaxed text-slate-300">
                      {q.explanation}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={resetQuiz}
            className="w-full rounded-lg bg-amber-400 px-4 py-3 font-semibold text-slate-950 hover:bg-amber-300"
          >
            Try Another Topic
          </button>
        </div>
      )}
    </section>
  );
}
