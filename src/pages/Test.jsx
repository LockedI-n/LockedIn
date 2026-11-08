import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { getQuiz, gradeAnswer } from "../lib/api.js";
import { QUIZ_COUNT, MASTERY_THRESHOLD, SIDEKICK_NAME } from "../lib/config.js";
import Sidekick from "../components/Sidekick.jsx";
import { topicShare } from "../lib/mastery.js";

const LETTERS = ["A", "B", "C", "D"];

// The first topic worth testing: the one asked for, else one with a summary, else the first.
const defaultTopic = (course, wanted) =>
  course?.topics.find((t) => t.name === wanted)?.name ??
  course?.topics.find((t) => t.summary)?.name ??
  course?.topics[0]?.name ??
  "";

// Three ways to prove it: multiple choice, write what you understood, or explain it
// out loud (Feynman: recorded, transcribed by /api/transcribe, Jepi reacts like a friend you're teaching).

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
  const [questionCount, setQuestionCount] = useState(QUIZ_COUNT);
  const [difficulty, setDifficulty] = useState("medium");

  // Written mode
  const [writtenAnswer, setWrittenAnswer] = useState("");

  // Feynman voice mode
  const [feynmanTranscript, setFeynmanTranscript] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingError, setRecordingError] = useState("");

  // Recording references
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const mediaStreamRef = useRef(null);

  // Grading
  const [gradeResult, setGradeResult] = useState(null);
  const [grading, setGrading] = useState(false);
  const [gradeError, setGradeError] = useState("");
  const [gradeFallback, setGradeFallback] = useState(false);

  // MCQ
  const [quiz, setQuiz] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentQuestion, setCurrentQuestion] = useState(0);

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [fallback, setFallback] = useState(false);

  const topic = course?.topics.find((t) => t.name === topicName);
  const question = quiz[currentQuestion];

  // Confetti in Jepi's colours when a test is passed.
  const passedScore = gradeResult ? gradeResult.score : submitted && quiz.length ? Math.round((Object.entries(answers).filter(([i, a]) => quiz[i]?.answer === a).length / quiz.length) * 100) : null;
  useEffect(() => {
    if (passedScore == null || passedScore < MASTERY_THRESHOLD) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    confetti({ particleCount: 120, spread: 75, origin: { y: 0.3 }, colors: ["#2FAD8F", "#8AD1D6", "#00FFCF", "#FE7E84", "#000090"] });
  }, [passedScore]);

  // Stop microphone tracks when the component is unmounted.
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }

      mediaStreamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });
    };
  }, []);

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
        count: questionCount,
        difficulty,
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

  // Record the selected answer for the current MCQ question.
  function selectAnswer(optionIndex) {
    if (submitted) return;

    setAnswers((previous) => ({
      ...previous,
      [currentQuestion]: optionIndex,
    }));
  }

  // Calculate the MCQ result and notify the parent component.
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

  // Ask Gemini to evaluate a written explanation.
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
      const answer = writtenAnswer.trim();

      const result = await gradeAnswer({
        courseName: course.name,
        topic: topic.name,
        summary: topic.summary,
        mode: "written",
        answer,
      });

      if (typeof result.score !== "number") {
        throw new Error(
          "The grader returned an invalid result. Please try again."
        );
      }

      setGradeResult(result);
      setGradeFallback(Boolean(result.fallback));

      onComplete?.({
        courseId: course.id,
        topic: topicName,
        mode,
        score: result.score,
        total: 100,
        answer,
        feedback: result,
      });
    } catch (err) {
      setGradeError(
        err.message ||
          "Something went wrong while grading. Please try again."
      );
    } finally {
      setGrading(false);
    }
  }

  // Start recording the student's Feynman explanation.
  async function startRecording() {
    setRecordingError("");
    setFeynmanTranscript("");

    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        !window.MediaRecorder
      ) {
        throw new Error(
          "Audio recording is not supported in this browser."
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      mediaStreamRef.current = stream;

      // Use a recording format supported by the current browser.
      const supportedTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ];

      const mimeType = supportedTypes.find((type) =>
        MediaRecorder.isTypeSupported(type)
      );

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      audioChunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setRecordingError(
          "Something went wrong while recording. Please try again."
        );
        setIsRecording(false);

        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "application/octet-stream",
        });

        // Release the microphone after recording.
        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;

        // Ignore an empty recording.
        if (!audioBlob.size) {
          setRecordingError(
            "No audio was recorded. Please try again."
          );
          return;
        }

        await transcribeRecording(audioBlob);
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Recording error:", err);

      mediaStreamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });

      mediaStreamRef.current = null;

      setIsRecording(false);
      setRecordingError(
        err.message || "Could not access your microphone."
      );
    }
  }

  // Stop recording. The recorder's onstop handler starts transcription.
  function stopRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }

  // Send the recorded audio to the ElevenLabs transcription endpoint.
  async function transcribeRecording(audioBlob) {
    setIsTranscribing(true);
    setRecordingError("");
    setFeynmanTranscript("");

    try {
      // Convert the audio Blob into Base64.
      const reader = new FileReader();

      const audioBase64 = await new Promise((resolve, reject) => {
        reader.onloadend = () => {
          if (typeof reader.result !== "string") {
            reject(new Error("Could not read the audio recording."));
            return;
          }

          resolve(reader.result.split(",")[1]);
        };

        reader.onerror = () => {
          reject(new Error("Could not process the audio recording."));
        };

        reader.readAsDataURL(audioBlob);
      });

      const response = await fetch("/api/transcribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          audioBase64,
          mimeType: audioBlob.type,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Speech transcription failed."
        );
      }

      if (!data.transcript?.trim()) {
        throw new Error(
          "No speech was detected. Please record your explanation again."
        );
      }

      setFeynmanTranscript(data.transcript);
    } catch (err) {
      console.error("Transcription error:", err);

      setRecordingError(
        err.message || "Unable to transcribe your recording."
      );
    } finally {
      setIsTranscribing(false);
    }
  }

  // Submit the Feynman transcript to the existing Gemini grading endpoint.
  async function submitFeynmanAnswer() {
    if (!topic || !feynmanTranscript.trim()) {
      setGradeError("Record or enter an explanation before submitting.");
      return;
    }

    setGrading(true);
    setGradeError("");
    setGradeResult(null);
    setGradeFallback(false);

    try {
      const answer = feynmanTranscript.trim();

      const result = await gradeAnswer({
        courseName: course.name,
        topic: topic.name,
        summary: topic.summary,
        mode: "feynman",
        answer,
      });

      if (typeof result.score !== "number") {
        throw new Error(
          "The grader returned an invalid result. Please try again."
        );
      }

      setGradeResult(result);
      setGradeFallback(Boolean(result.fallback));

      onComplete?.({
        courseId: course.id,
        topic: topicName,
        mode: "feynman",
        score: result.score,
        total: 100,
        answer,
        feedback: result,
      });
    } catch (err) {
      setGradeError(
        err.message ||
          "Something went wrong while grading. Please try again."
      );
    } finally {
      setGrading(false);
    }
  }

  // Reset the test and release any active microphone resources.
  function resetQuiz() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }

    mediaStreamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });

    mediaStreamRef.current = null;
    audioChunksRef.current = [];

    setQuiz([]);
    setAnswers({});
    setCurrentQuestion(0);
    setSubmitted(false);
    setError("");
    setFallback(false);

    setWrittenAnswer("");
    setFeynmanTranscript("");
    setIsRecording(false);
    setIsTranscribing(false);
    setRecordingError("");

    setGradeResult(null);
    setGradeError("");
    setGradeFallback(false);
    setGrading(false);
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
          className="rounded-lg bg-brand px-4 py-3 font-semibold text-white hover:bg-brand-dark"
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
          ? { mood: "happy", message: `Tell me what you understood about ${topicName || "this topic"}, in your own words. I'll ask about anything confusing!` }
          : { mood: "happy", message: "Prove what you know! Pick a topic and a way to be tested." };

  return (
    <section className="space-y-6">
      <Sidekick mood={sparky.mood} message={sparky.message} size={finalScore != null ? 104 : undefined} />

      {/* MODE AND TOPIC SELECTION */}
      {quiz.length === 0 && !gradeResult && (
        <div className="space-y-5 rounded-2xl border border-line bg-white p-5">
          <div>
            <p className="mb-2 text-sm font-medium">
              Choose a test mode
            </p>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setMode("mcq")}
                className={`rounded-lg border px-3 py-3 text-sm font-semibold transition ${
                  mode === "mcq"
                    ? "border-brand bg-brand/10 text-brand-dark"
                    : "border-line bg-mist text-ink/80 hover:border-teal"
                }`}
              >
                Multiple choice
              </button>

              <button
                type="button"
                onClick={() => setMode("written")}
                className={`rounded-lg border px-3 py-3 text-sm font-semibold transition ${
                  mode === "written"
                    ? "border-brand bg-brand/10 text-brand-dark"
                    : "border-line bg-mist text-ink/80 hover:border-teal"
                }`}
              >
                Write it
              </button>

              <button
                type="button"
                onClick={() => setMode("feynman")}
                className={`rounded-lg border px-3 py-3 text-sm font-semibold transition ${
                  mode === "feynman"
                    ? "border-brand bg-brand/10 text-brand-dark"
                    : "border-line bg-mist text-ink/80 hover:border-teal"
                }`}
              >
                Say it out loud
              </button>
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
                className="w-full rounded-lg border border-line bg-mist px-4 py-3 text-ink outline-none focus:border-brand"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="rounded-lg bg-mist px-4 py-3 text-ink/80">{course.name}</div>
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
              className="w-full rounded-lg border border-line bg-mist px-4 py-3 text-ink outline-none focus:border-brand"
            >
              {course.topics.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}
                  {t.score != null ? ` (last score ${t.score}%)` : ""}
                </option>
              ))}
            </select>
          </div>

          {course.topics.length === 0 && (
            <div className="space-y-3 rounded-lg bg-cream p-4 ring-1 ring-line">
              <p className="text-sm text-ink/80">
                {course.name} has no topics yet, so there's nothing to test. Upload the syllabus or slides first.
              </p>
              <button
                onClick={() => onNavigate("Add course", { courseId: course.id })}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
              >
                Add topics
              </button>
            </div>
          )}

          {course.topics.length === 0 ? null : topic?.summary ? (
            <div className="rounded-lg bg-mist p-4">
              <p className="mb-1 text-sm font-semibold text-brand-dark">
                Topic summary
                {topicShare(course, topicName) > 0 && (
                  <span className="ml-1 font-normal text-ink/60">(about {topicShare(course, topicName)}% of your grade)</span>
                )}
              </p>
              <p className="text-sm leading-relaxed text-ink/80">
                {topic.summary}
              </p>
            </div>
          ) : (
            <p className="text-sm text-ink/60">
              No lecture summary for this topic yet, so questions will use general course knowledge.
              Upload slides on the Add course page for better questions.
            </p>
          )}

          {error && (
            <p className="rounded-lg bg-danger/10 p-3 text-sm text-danger-dark">
              {error}
            </p>
          )}

          {mode === "mcq" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-medium">Questions</p>
                <div className="flex gap-1.5" role="radiogroup" aria-label="Number of questions">
                  {[3, 5, 10, 15].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={questionCount === n}
                      onClick={() => setQuestionCount(n)}
                      className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold tabular transition ${
                        questionCount === n ? "bg-ink text-white" : "bg-mist text-ink/80 hover:bg-line"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">Difficulty</p>
                <div className="flex gap-1.5" role="radiogroup" aria-label="Difficulty">
                  {[
                    ["easy", "Easy"],
                    ["medium", "Medium"],
                    ["hard", "Exam-level"],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={difficulty === id}
                      onClick={() => setDifficulty(id)}
                      className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                        difficulty === id ? "bg-ink text-white" : "bg-mist text-ink/80 hover:bg-line"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {mode === "mcq" && (
            <button
              onClick={startQuiz}
              disabled={loading || !topic}
              className="w-full rounded-lg bg-brand px-4 py-3 font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? `${SIDEKICK_NAME} is writing ${questionCount} questions...` : `Start ${questionCount}-question quiz`}
            </button>
          )}
        </div>
      )}

      {/* WRITTEN RESPONSE */}
      {mode !== "mcq" && quiz.length === 0 && !gradeResult && (
        <div className="space-y-5 rounded-2xl border border-line bg-white p-5">
          <div>
            <p className="text-sm font-medium text-brand-dark">
              {course.name}
            </p>
            <h3 className="mt-1 text-lg font-semibold">
              {topicName}
            </h3>
            <p className="mt-2 text-sm text-ink/60">
              Explain this topic in your own words. Include the key ideas,
              how they work, and why they matter.
            </p>
          </div>

          <label
            htmlFor="written-answer"
            className="block text-sm font-medium"
          >
            Your explanation
          </label>

          <textarea
            id="written-answer"
            value={writtenAnswer}
            onChange={(event) => setWrittenAnswer(event.target.value)}
            placeholder="Start explaining what you know about this topic..."
            rows={9}
            maxLength={10000}
            className="w-full resize-y rounded-xl border border-line bg-mist px-4 py-3 text-sm leading-relaxed text-ink outline-none placeholder:text-ink/50 focus:border-brand"
          />

          <div className="flex justify-between text-xs text-ink/50">
            <span>
              Try to explain it without copying the topic summary.
            </span>
            <span>{writtenAnswer.length}/10,000</span>
          </div>

          {gradeError && (
            <p className="rounded-lg bg-danger/10 p-3 text-sm text-danger-dark">
              {gradeError}
            </p>
          )}

          <button
            onClick={submitWrittenAnswer}
            disabled={grading || !writtenAnswer.trim()}
            className="w-full rounded-lg bg-brand px-4 py-3 font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {grading
              ? "Evaluating your explanation..."
              : "Submit for Evaluation"}
          </button>
        </div>
      )}

      {/* FEYNMAN VOICE MODE */}
      {mode === "feynman" && quiz.length === 0 && !gradeResult && (
        <div className="space-y-5 rounded-2xl border border-line bg-white p-5">
          <div>
            <p className="text-sm font-medium text-brand-dark">
              {course.name}
            </p>
            <h3 className="mt-1 text-lg font-semibold">
              {topicName}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-ink/60">
              Imagine you're teaching Jepi this topic for the first time.
              Explain it in your own words, as clearly as possible. Try to
              include the key ideas, how they work, and why they matter.
            </p>
          </div>

          <div className="rounded-xl border border-line bg-mist p-4">
            <p className="mb-3 text-sm font-medium">
              Record your explanation
            </p>

            <div className="flex flex-wrap gap-3">
              {!isRecording ? (
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={isTranscribing || grading}
                  className="rounded-lg bg-brand px-5 py-3 font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Start Recording
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="rounded-lg bg-danger px-5 py-3 font-semibold text-white transition hover:bg-danger-dark"
                >
                  Stop Recording
                </button>
              )}
            </div>

            {isRecording && (
              <p className="mt-3 flex items-center gap-2 text-sm text-danger-dark">
                <span className="h-2 w-2 animate-pulse rounded-full bg-danger" />
                Recording your explanation...
              </p>
            )}

            {isTranscribing && (
              <p className="mt-3 text-sm text-brand-dark">
                Transcribing your recording with ElevenLabs...
              </p>
            )}

            {recordingError && (
              <p className="mt-3 rounded-lg bg-danger/10 p-3 text-sm text-danger-dark">
                {recordingError}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label
              htmlFor="feynman-transcript"
              className="block text-sm font-medium"
            >
              Your explanation (transcript)
            </label>

            <textarea
              id="feynman-transcript"
              value={feynmanTranscript}
              onChange={(event) =>
                setFeynmanTranscript(event.target.value)
              }
              placeholder={
                isTranscribing
                  ? "Your transcript will appear here..."
                  : "Record your explanation to generate a transcript, or type your explanation here."
              }
              rows={8}
              maxLength={10000}
              disabled={isRecording || isTranscribing}
              className="w-full resize-y rounded-xl border border-line bg-mist px-4 py-3 text-sm leading-relaxed text-ink outline-none placeholder:text-ink/50 focus:border-brand disabled:opacity-60"
            />

            <div className="flex justify-between text-xs text-ink/50">
              <span>
                You can edit the transcript before submitting it.
              </span>
              <span>{feynmanTranscript.length}/10,000</span>
            </div>
          </div>

          {gradeError && (
            <p className="rounded-lg bg-danger/10 p-3 text-sm text-danger-dark">
              {gradeError}
            </p>
          )}

          <button
            onClick={submitFeynmanAnswer}
            disabled={
              grading ||
              isRecording ||
              isTranscribing ||
              !feynmanTranscript.trim()
            }
            className="w-full rounded-lg bg-brand px-4 py-3 font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {grading
              ? "Jepi is evaluating your explanation..."
              : "Submit Explanation for Evaluation"}
          </button>
        </div>
      )}

      {/* WRITTEN AND FEYNMAN RESULTS */}
      {(mode === "written" || mode === "feynman") && gradeResult && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-line bg-white p-6 text-center">
            <p className="text-sm font-medium text-ink/60">
              {mode === "feynman"
                ? "Feynman explanation evaluated"
                : "Written response evaluated"}
            </p>

            <p
              className={`my-3 text-5xl font-bold ${
                gradeResult.score >= MASTERY_THRESHOLD
                  ? "text-brand-dark"
                  : "text-coral"
              }`}
            >
              {gradeResult.score}%
            </p>

            <p className="text-sm text-ink/80">
              Your explanation of {topicName}
            </p>
          </div>

          {gradeFallback && (
            <p className="rounded-lg bg-coral/20 p-3 text-sm text-danger-dark">
              Sample feedback is being displayed because AI grading is unavailable.
            </p>
          )}

          <div className="rounded-xl border border-line bg-white p-4">
            <h3 className="mb-2 font-semibold text-brand-dark">
              What you nailed
            </h3>

            {gradeResult.gotRight?.length ? (
              <ul className="list-disc space-y-2 pl-5 text-sm text-ink/80">
                {gradeResult.gotRight.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink/60">
                No specific strengths were identified.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-line bg-white p-4">
            <h3 className="mb-2 font-semibold text-danger-dark">
              What to add next time
            </h3>

            {gradeResult.missed?.length ? (
              <ul className="list-disc space-y-2 pl-5 text-sm text-ink/80">
                {gradeResult.missed.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink/60">
                Nothing major was missing. Nice work!
              </p>
            )}
          </div>

          {gradeResult.sidekickMessage && (
            <div className="rounded-xl border border-line bg-white p-4">
              <p className="mb-2 text-sm font-semibold text-brand-dark">
                {SIDEKICK_NAME}'s feedback
              </p>
              <p className="text-sm leading-relaxed text-ink/80">
                {gradeResult.sidekickMessage}
              </p>
            </div>
          )}

          <div className="rounded-xl border border-line bg-white p-4">
            <p className="mb-2 text-sm font-semibold text-ink/70">
              Your submitted answer
            </p>

            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/80">
              {mode === "feynman"
                ? feynmanTranscript
                : writtenAnswer}
            </p>
          </div>

          <button
            onClick={resetQuiz}
            className="w-full rounded-lg bg-brand px-4 py-3 font-semibold text-white hover:bg-brand-dark"
          >
            Try Another Topic
          </button>
          <button
            onClick={() => onNavigate("Dashboard")}
            className="w-full rounded-lg bg-mist px-4 py-3 font-semibold text-ink hover:bg-line"
          >
            Back to Dashboard
          </button>
        </div>
      )}

      {/* ACTIVE MCQ QUIZ */}
      {quiz.length > 0 && !submitted && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-brand-dark">
                {course.name}
              </p>
              <p className="text-sm text-ink/60">{topicName}</p>
            </div>

            <span className="text-sm text-ink/60">
              {answeredCount}/{quiz.length} answered
            </span>
          </div>

          {fallback && (
            <p className="text-xs text-danger-dark">
              Using sample questions because AI generation is unavailable.
            </p>
          )}

          {/* Progress bar */}
          <div className="h-2 overflow-hidden rounded-full bg-mist">
            <div
              className="h-full rounded-full bg-brand transition-all"
              style={{
                width: `${((currentQuestion + 1) / quiz.length) * 100}%`,
              }}
            />
          </div>

          <div className="rounded-2xl border border-line bg-white p-5">
            <p className="mb-3 text-sm font-medium text-ink/60">
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
                        ? "border-brand bg-brand/10 text-brand-dark"
                        : "border-line bg-mist hover:border-teal"
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                        selected
                          ? "bg-brand text-white"
                          : "bg-line text-ink/80"
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
              className="flex-1 rounded-lg bg-mist px-4 py-3 text-sm font-medium hover:bg-line disabled:opacity-30"
            >
              Previous
            </button>

            {currentQuestion < quiz.length - 1 ? (
              <button
                onClick={() =>
                  setCurrentQuestion((previous) => previous + 1)
                }
                className="flex-1 rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-white hover:bg-brand-dark"
              >
                Next
              </button>
            ) : (
              <button
                onClick={submitQuiz}
                disabled={answeredCount !== quiz.length}
                className="flex-1 rounded-lg bg-brand px-4 py-3 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-40"
              >
                Submit Quiz
              </button>
            )}
          </div>

          {answeredCount !== quiz.length && (
            <p className="text-center text-xs text-ink/50">
              Answer all questions before submitting.
            </p>
          )}
        </div>
      )}

      {/* MCQ RESULTS */}
      {quiz.length > 0 && submitted && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-line bg-white p-6 text-center">
            <p className="text-sm font-medium text-ink/60">
              Quiz completed!
            </p>

            <p
              className={`my-3 text-5xl font-bold ${
                percentage >= MASTERY_THRESHOLD
                  ? "text-brand-dark"
                  : "text-coral"
              }`}
            >
              {percentage}%
            </p>

            <p className="text-sm text-ink/80">
              You got {score} out of {quiz.length} questions correct.
            </p>

            <p className="mt-2 text-sm text-ink/60">
              {percentage >= MASTERY_THRESHOLD
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
                  className="rounded-xl border border-line bg-white p-4"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <p className="font-medium">
                      {index + 1}. {q.question}
                    </p>

                    <span
                      className={`shrink-0 text-sm font-semibold ${
                        correct
                          ? "text-brand-dark"
                          : "text-danger-dark"
                      }`}
                    >
                      {correct ? "Correct" : "Incorrect"}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm">
                    {q.options.map((option, optionIndex) => {
                      const isCorrect = optionIndex === q.answer;
                      const isSelected =
                        answers[index] === optionIndex;

                      return (
                        <div
                          key={optionIndex}
                          className={`rounded-lg p-3 ${
                            isCorrect
                              ? "bg-brand/15 text-brand-dark"
                              : isSelected
                                ? "bg-danger/10 text-danger-dark"
                                : "bg-mist text-ink/60"
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

                  <div className="mt-3 rounded-lg bg-mist p-3">
                    <p className="mb-1 text-sm font-semibold text-brand-dark">
                      Explanation
                    </p>

                    <p className="text-sm leading-relaxed text-ink/80">
                      {q.explanation}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={resetQuiz}
            className="w-full rounded-lg bg-brand px-4 py-3 font-semibold text-white hover:bg-brand-dark"
          >
            Try Another Topic
          </button>
          <button
            onClick={() => onNavigate("Dashboard")}
            className="w-full rounded-lg bg-mist px-4 py-3 font-semibold text-ink hover:bg-line"
          >
            Back to Dashboard
          </button>
        </div>
      )}
    </section>
  );
}
