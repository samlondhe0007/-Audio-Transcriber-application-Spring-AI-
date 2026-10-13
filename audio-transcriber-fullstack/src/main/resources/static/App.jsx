// No imports needed: React is loaded from the CDN in index.html
const { useEffect, useRef, useState } = React;


const API_URL = "/api/transcribe";
const MAX_MB = 25;
const ALLOWED = ["mp3", "mp4", "mpeg", "mpga", "m4a", "wav", "webm", "ogg", "flac"];

const LANGUAGES = [
  { code: "", label: "Detect automatically" },
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "mr", label: "Marathi" },
  { code: "gu", label: "Gujarati" },
  { code: "ta", label: "Tamil" },
  { code: "te", label: "Telugu" },
  { code: "bn", label: "Bengali" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
];

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(total) {
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function App() {
  const [mode, setMode] = useState("upload");
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [language, setLanguage] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const inputRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);

  // Keep a playable preview URL for the selected file
  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Stop the microphone and timer if the page is closed mid-recording
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  function resetResult() {
    setStatus("idle");
    setTranscript("");
    setError("");
  }

  function selectFile(f) {
    if (!f) return;
    const ext = f.name.includes(".") ? f.name.split(".").pop().toLowerCase() : "";
    if (!ALLOWED.includes(ext)) {
      setStatus("error");
      setError(`.${ext || "?"} files aren't supported. Use ${ALLOWED.join(", ")}.`);
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setStatus("error");
      setError(`This file is ${formatSize(f.size)}. The limit is ${MAX_MB} MB.`);
      return;
    }
    resetResult();
    setFile(f);
  }

  function clearFile() {
    setFile(null);
    resetResult();
    if (inputRef.current) inputRef.current.value = "";
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    selectFile(e.dataTransfer.files[0]);
  }

  async function startRecording() {
    resetResult();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      let mimeType = "";
      let ext = "webm";
      if (window.MediaRecorder && MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus";
      } else if (window.MediaRecorder && MediaRecorder.isTypeSupported("audio/mp4")) {
        mimeType = "audio/mp4";
        ext = "mp4";
      }

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const recorded = new File([blob], `recording-${Date.now()}.${ext}`, { type: blob.type });
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        selectFile(recorded);
      };

      recorder.start();
      recorderRef.current = recorder;
      setSeconds(0);
      setRecording(true);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (err) {
      setStatus("error");
      setError(
        "Microphone access was blocked. Allow the microphone for this site in your browser, then try again."
      );
    }
  }

  function stopRecording() {
    clearInterval(timerRef.current);
    setRecording(false);
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  }

  async function transcribe() {
    if (!file) return;
    setStatus("loading");
    setError("");
    setTranscript("");
    setCopied(false);

    const form = new FormData();
    form.append("file", file);
    if (language) form.append("language", language);

    try {
      const res = await fetch(API_URL, { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `The server returned an error (${res.status}).`);
      }
      setTranscript(data.transcript || "");
      setStatus("done");
    } catch (err) {
      setStatus("error");
      if (err instanceof TypeError) {
        setError("Can't reach the backend on localhost:8080. Start the Spring Boot app, then try again.");
      } else {
        setError(err.message);
      }
    }
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(transcript);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Couldn't copy automatically. Select the text and copy it manually.");
    }
  }

  function downloadText() {
    const blob = new Blob([transcript], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(file?.name || "transcript").replace(/\.[^.]+$/, "")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const words = transcript.trim() ? transcript.trim().split(/\s+/).length : 0;
  const busy = status === "loading";

  return (
    <div className="page">
      <header className="masthead">
        <h1>Audio Transcriber</h1>
        <p>Turn a recording or an audio file into text.</p>
      </header>

      <main className="layout">
        <section className="panel input-panel" aria-labelledby="input-title">
          <h2 id="input-title">Your audio</h2>

          <div className="segmented" role="tablist" aria-label="Audio source">
            <button
              role="tab"
              aria-selected={mode === "upload"}
              className={mode === "upload" ? "seg active" : "seg"}
              onClick={() => setMode("upload")}
              disabled={recording || busy}
            >
              Upload a file
            </button>
            <button
              role="tab"
              aria-selected={mode === "record"}
              className={mode === "record" ? "seg active" : "seg"}
              onClick={() => setMode("record")}
              disabled={recording || busy}
            >
              Record
            </button>
          </div>

          {mode === "upload" && (
            <div
              className={dragging ? "dropzone dragging" : "dropzone"}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <input
                ref={inputRef}
                id="file-input"
                type="file"
                accept="audio/*,video/mp4,video/webm"
                onChange={(e) => selectFile(e.target.files[0])}
                disabled={busy}
              />
              <label htmlFor="file-input">
                <strong>Choose a file</strong> or drop it here
                <span>mp3, wav, m4a, ogg, webm, flac or mp4, up to {MAX_MB} MB</span>
              </label>
            </div>
          )}

          {mode === "record" && (
            <div className="recorder">
              <div className={recording ? "meter live" : "meter"} aria-hidden="true">
                {Array.from({ length: 24 }).map((_, i) => (
                  <i key={i} style={{ animationDelay: `${(i % 8) * 0.09}s` }} />
                ))}
              </div>
              <div className="timer" aria-live="off">
                {formatTime(seconds)}
              </div>
              {!recording ? (
                <button className="btn secondary" onClick={startRecording} disabled={busy}>
                  Start recording
                </button>
              ) : (
                <button className="btn danger" onClick={stopRecording}>
                  Stop recording
                </button>
              )}
            </div>
          )}

          {file && (
            <div className="file-card">
              <div className="file-meta">
                <span className="file-name">{file.name}</span>
                <span className="file-size">{formatSize(file.size)}</span>
              </div>
              {previewUrl && <audio controls src={previewUrl} />}
              <button className="link-btn" onClick={clearFile} disabled={busy || recording}>
                Remove file
              </button>
            </div>
          )}

          <div className="field">
            <label htmlFor="language">Spoken language</label>
            <select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={busy}
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          <button className="btn primary" onClick={transcribe} disabled={!file || busy || recording}>
            {busy ? "Transcribing…" : "Transcribe audio"}
          </button>
        </section>

        <section className="panel sheet" aria-labelledby="output-title" aria-live="polite">
          <div className="sheet-head">
            <h2 id="output-title">Transcript</h2>
            {status === "done" && transcript && (
              <div className="sheet-actions">
                <span className="count">{words} words</span>
                <button className="link-btn" onClick={copyText}>
                  {copied ? "Copied" : "Copy text"}
                </button>
                <button className="link-btn" onClick={downloadText}>
                  Download .txt
                </button>
              </div>
            )}
          </div>

          {status === "idle" && (
            <p className="placeholder">
              Add an audio file or record your voice, then choose Transcribe audio. The text will
              appear here.
            </p>
          )}

          {busy && (
            <div className="loading">
              <span className="spinner" />
              <p>Listening to your audio. Short clips finish in a few seconds.</p>
            </div>
          )}

          {status === "error" && (
            <div className="error" role="alert">
              <strong>That didn't work.</strong>
              <p>{error}</p>
            </div>
          )}

          {status === "done" && (
            <article className="transcript">
              {transcript ? transcript : "No speech was detected in this audio."}
            </article>
          )}
        </section>
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
