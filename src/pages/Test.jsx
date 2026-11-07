
import { useState } from "react";
import { getQuiz, gradeAnswer } from "../lib/api.js";
import { QUIZ_COUNT, MASTERY_THRESHOLD, SIDEKICK_NAME } from "../lib/config.js";
import Sidekick from "../components/Sidekick.jsx";

const LETTERS = ["A", "B", "C", "D"];

// The first topic worth testing: the one asked for, else one with a summary, else the first.
const defaultTopic = (course, wanted) =>
  course?.topics.find((t) => t.name === wanted)?.name ??
  course?.topics.find((t) => t.summary)?.name ??
  course?.topics[0]?.name ??
  "";

const MODE_LABELS = { mcq: "Multiple choice", written: "Written answer", feynman: "Teach Sparky" };

// Props (App.jsx passes these):
//   courses          saved courses (from storage)
//   initialCourseId  course to open (e.g. from a habit's "Prove it")
//   initialTopic     topic to open
//   onComplete(result)  called with { courseId, topic, mode, score, ... } when a test finishes
//   onNavigate(page)    go to another page, e.g. "Dashboard"
export default function Test({ courses = [], initialCourseId, initialTopic, onComplete, onNavigate = () => {} }) {
  const [courseId, setCourseId] = useState(initialCourseId ?? courses[0]?.id);
  const course = courses.find((c) => c.id === courseId) ?? courses[0];
  const [topicName, setTopicName] = useState(() => defaultTopic(course, initialTopic));
  const [mode, setMode] = useState("mcq");
  const [writtenAnswer, setWrittenAnswer] = useState("");
  const [gradeResult, setGradeResult] = useState(null);
  const [grading, setGrading] = useState(false);
  const [gradeError, setGradeError] = useState("");
  const [gradeFallback, setGradeFallback] = useState(false);
  const [quiz, setQuiz] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentQuestion, setCurrentQuestion] = useState(0);

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [fallback, setFallback] = useState(false);

  const topic = course?.topics.find((t) => t.name === topicName);
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
      mode: "mcq",
      score,
      total: quiz.length,
      correct,
      quiz,
    });
  }

  // Ask Gemini to evaluate the student's written explanation.
  async function submitWrittenAnswer() {
    if (!topic || !writtenAnswer.trim()) {
      setGradeError("Write an explanation before submitting.");
      return;
    }

    setGrading(true);
    setGradeError("");
    setGradeResult(null);
    setGradeFallback(false);

    try {
      const result = await gradeAnswer({
        courseName: course.name,
        topic: topic.name,
        summary: topic.summary,
        mode,
        answer: writtenAnswer.trim(),
      });

      if (typeof result.score !== "number") {
        throw new Error("The grader returned an invalid result. Please try again.");
      }

      setGradeResult(result);
      setGradeFallback(Boolean(result.fallback));

      onComplete?.({
        courseId: course.id,
        topic: topicName,
        mode,
        score: result.score,
        total: 100,
        answer: writtenAnswer.trim(),
        feedback: result,
      });
    } catch (err) {
      setGradeError(err.message || "Something went wrong while grading. Please try again.");
    } finally {
      setGrading(false);
    }
  }

  function resetQuiz() {
    setQuiz([]);
    setAnswers({});
    setCurrentQuestion(0);
    setSubmitted(false);
    setError("");
    setFallback(false);
    setWrittenAnswer("");
    setGradeResult(null);
    setGradeError("");
    setGradeFallback(false);
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

  if (!course) {
    return (
      <section className="space-y-6">
        <Sidekick mood="nudge" message="Add a course first, then come back and prove what you know!" />
        <button
          onClick={() => onNavigate("Add course")}
          className="rounded-lg bg-amber-400 px-4 py-3 font-semibold text-slate-950 hover:bg-amber-300"
        >
          Add a course
        </button>
      </section>
    );
  }

  const finalScore = gradeResult ? gradeResult.score : submitted ? percentage : null;
  const sparky =
    finalScore != null
      ? finalScore >= MASTERY_THRESHOLD
        ? { mood: "proud", message: `${finalScore}% on ${topicName}! That counts as passed. Your ring is full for this course.` }
        : { mood: "nudge", message: `${finalScore}% on ${topicName}. Not there yet, so it'll come back as a habit. Review what you missed!` }
      : loading || grading
        ? { mood: "thinking", message: loading ? "Writing your questions..." : "Reading your answer carefully..." }
        : mode === "feynman"
          ? { mood: "happy", message: `Teach me ${topicName || "this topic"} like I've never heard of it. I'll ask about anything confusing!` }
          : { mood: "happy", message: "Prove what you know! Pick a topic and a way to be tested." };

  return (
    <section className="space-y-6">
      <Sidekick mood={sparky.mood} message={sparky.message} />

      {/* MODE AND TOPIC SELECTION */}
      {quiz.length === 0 && !gradeResult && (
        <div className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div>
            <p className="mb-2 text-sm font-medium">Choose a test mode</p>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(MODE_LABELS).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMode(id)}
                  className={`rounded-lg border px-3 py-3 text-sm font-semibold transition ${
                    mode === id
                      ? "border-amber-400 bg-amber-400/10 text-amber-300"
                      : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">
              Course
            </label>
            {courses.length > 1 ? (
              <select
                value={course.id}
                onChange={(e) => {
                  const next = courses.find((c) => c.id === e.target.value);
                  setCourseId(e.target.value);
                  setTopicName(defaultTopic(next));
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-slate-100 outline-none focus:border-amber-400"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="rounded-lg bg-slate-800 px-4 py-3 text-slate-300">{course.name}</div>
            )}
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
                  {t.score != null ? ` (last score ${t.score}%)` : ""}
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
              No lecture summary for this topic yet, so questions will use general course knowledge.
              Upload slides on the Add course page for better questions.
            </p>
          )}

          {error && (
            <p className="rounded-lg bg-rose-500/10 p-3 text-sm text-rose-400">
              {error}
            </p>
          )}

          {mode === "mcq" ? (
            <button
              onClick={startQuiz}
              disabled={loading || !topic}
              className="w-full rounded-lg bg-amber-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Generating questions..." : "Generate Quiz"}
            </button>
          ) : null}
        </div>
      )}

      {/* WRITTEN RESPONSE */}
      {mode !== "mcq" && quiz.length === 0 && !gradeResult && (
        <div className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div>
            <p className="text-sm font-medium text-amber-400">{course.name}</p>
            <h3 className="mt-1 text-lg font-semibold">{topicName}</h3>
            <p className="mt-2 text-sm text-slate-400">
              {mode === "feynman"
                ? `Teach ${SIDEKICK_NAME} this topic in simple words, as if they've never heard of it. Use an example. If you can explain it simply, you understand it.`
                : "Explain this topic in your own words. Include the key ideas, how they work, and why they matter."}
            </p>
          </div>

          <label htmlFor="written-answer" className="block text-sm font-medium">
            {mode === "feynman" ? `Your lesson for ${SIDEKICK_NAME}` : "Your explanation"}
          </label>
          <textarea
            id="written-answer"
            value={writtenAnswer}
            onChange={(event) => setWrittenAnswer(event.target.value)}
            placeholder="Start explaining what you know about this topic..."
            rows={9}
            maxLength={10000}
            className="w-full resize-y rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm leading-relaxed text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-400"
          />
          <div className="flex justify-between text-xs text-slate-500">
            <span>Try to explain it without copying the topic summary.</span>
            <span>{writtenAnswer.length}/10,000</span>
          </div>

          {gradeError && (
            <p className="rounded-lg bg-rose-500/10 p-3 text-sm text-rose-400">
              {gradeError}
            </p>
          )}

          <button
            onClick={submitWrittenAnswer}
            disabled={grading || !writtenAnswer.trim()}
            className="w-full rounded-lg bg-amber-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {grading ? "Evaluating your explanation..." : mode === "feynman" ? `Teach ${SIDEKICK_NAME}` : "Submit for Evaluation"}
          </button>
        </div>
      )}

      {/* WRITTEN RESULTS */}
      {mode !== "mcq" && gradeResult && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center">
            <p className="text-sm font-medium text-slate-400">
              {mode === "feynman" ? `${SIDEKICK_NAME} learned from you` : "Written response evaluated"}
            </p>
            <p
              className={`my-3 text-5xl font-bold ${
                gradeResult.score >= 70 ? "text-emerald-400" : "text-amber-400"
              }`}
            >
              {gradeResult.score}%
            </p>
            <p className="text-sm text-slate-300">
              Your explanation of {topicName}
            </p>
          </div>

          {gradeFallback && (
            <p className="rounded-lg bg-amber-400/10 p-3 text-sm text-amber-300">
              Sample feedback is being displayed because AI grading is unavailable.
            </p>
          )}

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h3 className="mb-2 font-semibold text-emerald-400">What you got right</h3>
            {gradeResult.gotRight?.length ? (
              <ul className="list-disc space-y-2 pl-5 text-sm text-slate-300">
                {gradeResult.gotRight.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">No specific strengths were identified.</p>
            )}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h3 className="mb-2 font-semibold text-amber-400">What to improve</h3>
            {gradeResult.missed?.length ? (
              <ul className="list-disc space-y-2 pl-5 text-sm text-slate-300">
                {gradeResult.missed.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">Nothing major was missing. Nice work!</p>
            )}
          </div>

          {gradeResult.sidekickMessage && (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-400">
                {SIDEKICK_NAME}'s feedback
              </p>
              <p className="text-sm leading-relaxed text-slate-300">
                {gradeResult.sidekickMessage}
              </p>
            </div>
          )}

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Your submitted answer
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
              {writtenAnswer}
            </p>
          </div>

          <button
            onClick={resetQuiz}
            className="w-full rounded-lg bg-amber-400 px-4 py-3 font-semibold text-slate-950 hover:bg-amber-300"
          >
            Try Another Topic
          </button>
          <button
            onClick={() => onNavigate("Dashboard")}
            className="w-full rounded-lg bg-slate-800 px-4 py-3 font-semibold text-slate-200 hover:bg-slate-700"
          >
            Back to Dashboard
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
          <button
            onClick={() => onNavigate("Dashboard")}
            className="w-full rounded-lg bg-slate-800 px-4 py-3 font-semibold text-slate-200 hover:bg-slate-700"
          >
            Back to Dashboard
          </button>
        </div>
      )}
    </section>
  );
}
