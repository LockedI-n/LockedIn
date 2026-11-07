jsx
import { useEffect, useRef, useState } from "react";
import { getQuiz, gradeAnswer } from "../lib/api.js";
import { sampleCourse } from "../lib/sampleData.js";
import { QUIZ_COUNT } from "../lib/config.js";

const LETTERS = ["A", "B", "C", "D"];

export default function Test({ course = sampleCourse, onComplete }) {
  const [topicName, setTopicName] = useState("Decision Trees");
  const [mode, setMode] = useState("mcq");

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

  const topic = course.topics.find((t) => t.name === topicName);
  const question = quiz[currentQuestion];

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
        mode: "written",
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

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">TEST PAGE UPDATED</h2>
        <p className="mt-1 text-sm text-slate-400">
          Test what you've learned with Sparky.
        </p>
      </div>

      {/* MODE AND TOPIC SELECTION */}
      {quiz.length === 0 && !gradeResult && (
        <div className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-5">
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
                    ? "border-amber-400 bg-amber-400/10 text-amber-300"
                    : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500"
                }`}
              >
                Multiple Choice
              </button>

              <button
                type="button"
                onClick={() => setMode("written")}
                className={`rounded-lg border px-3 py-3 text-sm font-semibold transition ${
                  mode === "written"
                    ? "border-amber-400 bg-amber-400/10 text-amber-300"
                    : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500"
                }`}
              >
                Written
              </button>

              <button
                type="button"
                onClick={() => setMode("feynman")}
                className={`rounded-lg border px-3 py-3 text-sm font-semibold transition ${
                  mode === "feynman"
                    ? "border-amber-400 bg-amber-400/10 text-amber-300"
                    : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500"
                }`}
              >
                Feynman
              </button>
            </div>
          </div>

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

          {mode === "mcq" && (
            <button
              onClick={startQuiz}
              disabled={loading || !topic}
              className="w-full rounded-lg bg-amber-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Generating questions..." : "Generate Quiz"}
            </button>
          )}
        </div>
      )}

      {/* WRITTEN RESPONSE */}
      {mode === "written" && quiz.length === 0 && !gradeResult && (
        <div className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div>
            <p className="text-sm font-medium text-amber-400">
              {course.name}
            </p>
            <h3 className="mt-1 text-lg font-semibold">
              {topicName}
            </h3>
            <p className="mt-2 text-sm text-slate-400">
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
            className="w-full resize-y rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm leading-relaxed text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-400"
          />

          <div className="flex justify-between text-xs text-slate-500">
            <span>
              Try to explain it without copying the topic summary.
            </span>
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
            {grading
              ? "Evaluating your explanation..."
              : "Submit for Evaluation"}
          </button>
        </div>
      )}

      {/* FEYNMAN VOICE MODE */}
      {mode === "feynman" && quiz.length === 0 && !gradeResult && (
        <div className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div>
            <p className="text-sm font-medium text-amber-400">
              {course.name}
            </p>
            <h3 className="mt-1 text-lg font-semibold">
              {topicName}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Imagine you're teaching Sparky this topic for the first time.
              Explain it in your own words, as clearly as possible. Try to
              include the key ideas, how they work, and why they matter.
            </p>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-4">
            <p className="mb-3 text-sm font-medium">
              Record your explanation
            </p>

            <div className="flex flex-wrap gap-3">
              {!isRecording ? (
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={isTranscribing || grading}
                  className="rounded-lg bg-amber-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Start Recording
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="rounded-lg bg-rose-500 px-5 py-3 font-semibold text-white transition hover:bg-rose-400"
                >
                  Stop Recording
                </button>
              )}
            </div>

            {isRecording && (
              <p className="mt-3 flex items-center gap-2 text-sm text-rose-400">
                <span className="h-2 w-2 animate-pulse rounded-full bg-rose-400" />
                Recording your explanation...
              </p>
            )}

            {isTranscribing && (
              <p className="mt-3 text-sm text-amber-300">
                Transcribing your recording with ElevenLabs...
              </p>
            )}

            {recordingError && (
              <p className="mt-3 rounded-lg bg-rose-500/10 p-3 text-sm text-rose-400">
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
              className="w-full resize-y rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm leading-relaxed text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-400 disabled:opacity-60"
            />

            <div className="flex justify-between text-xs text-slate-500">
              <span>
                You can edit the transcript before submitting it.
              </span>
              <span>{feynmanTranscript.length}/10,000</span>
            </div>
          </div>

          {gradeError && (
            <p className="rounded-lg bg-rose-500/10 p-3 text-sm text-rose-400">
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
            className="w-full rounded-lg bg-amber-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {grading
              ? "Sparky is evaluating your explanation..."
              : "Submit Explanation for Evaluation"}
          </button>
        </div>
      )}

      {/* WRITTEN AND FEYNMAN RESULTS */}
      {(mode === "written" || mode === "feynman") && gradeResult && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center">
            <p className="text-sm font-medium text-slate-400">
              {mode === "feynman"
                ? "Feynman explanation evaluated"
                : "Written response evaluated"}
            </p>

            <p
              className={`my-3 text-5xl font-bold ${
                gradeResult.score >= 70
                  ? "text-emerald-400"
                  : "text-amber-400"
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
            <h3 className="mb-2 font-semibold text-emerald-400">
              What you got right
            </h3>

            {gradeResult.gotRight?.length ? (
              <ul className="list-disc space-y-2 pl-5 text-sm text-slate-300">
                {gradeResult.gotRight.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">
                No specific strengths were identified.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <h3 className="mb-2 font-semibold text-amber-400">
              What to improve
            </h3>

            {gradeResult.missed?.length ? (
              <ul className="list-disc space-y-2 pl-5 text-sm text-slate-300">
                {gradeResult.missed.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">
                Nothing major was missing. Nice work!
              </p>
            )}
          </div>

          {gradeResult.sidekickMessage && (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-400">
                Sparky's feedback
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
              {mode === "feynman"
                ? feynmanTranscript
                : writtenAnswer}
            </p>
          </div>

          <button
            onClick={resetQuiz}
            className="w-full rounded-lg bg-amber-400 px-4 py-3 font-semibold text-slate-950 hover:bg-amber-300"
          >
            Try Another Topic
          </button>
        </div>
      )}

      {/* ACTIVE MCQ QUIZ */}
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

      {/* MCQ RESULTS */}
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
                        correct
                          ? "text-emerald-400"
                          : "text-rose-400"
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
