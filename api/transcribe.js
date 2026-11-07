
// POST /api/transcribe
// Input: { audioBase64, mimeType }
// Output: { transcript }

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.ELEVENLABS_API_KEY) {
    return res.status(500).json({
      error: "ElevenLabs API key is not configured",
    });
  }

  try {
    const { audioBase64, mimeType } = req.body || {};

    if (!audioBase64 || !mimeType) {
      return res.status(400).json({
        error: "Missing audio recording",
      });
    }

    // Decode the audio sent by the browser.
    const audioBuffer = Buffer.from(audioBase64, "base64");

    // Keep recordings reasonably small for Vercel.
    if (audioBuffer.length > 3 * 1024 * 1024) {
      return res.status(413).json({
        error: "Recording is too large. Please record a shorter explanation.",
      });
    }

    const formData = new FormData();

    formData.append(
      "file",
      new Blob([audioBuffer], { type: mimeType }),
      "recording"
    );

    formData.append("model_id", "scribe_v2");

    const elevenLabsResponse = await fetch(
      "https://api.elevenlabs.io/v1/speech-to-text",
      {
        method: "POST",
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
        },
        body: formData,
      }
    );

    const data = await elevenLabsResponse.json();

    if (!elevenLabsResponse.ok) {
      console.error("ElevenLabs error:", data);
      return res.status(502).json({
        error: "Speech transcription failed",
      });
    }

    return res.status(200).json({
      transcript: data.text || "",
    });
  } catch (error) {
    console.error("Transcription error:", error);

    return res.status(500).json({
      error: "Unable to transcribe recording",
    });
  }
}
