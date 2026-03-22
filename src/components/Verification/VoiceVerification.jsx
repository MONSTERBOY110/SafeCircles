import React, { useState, useRef, useEffect } from 'react';
import { detectPitch, detectVoiceActivity } from '../../utils/pitchDetection';
import { VOICE_PROMPTS, VERIFICATION } from '../../utils/constants';

function getRandomPrompt() {
  return VOICE_PROMPTS[Math.floor(Math.random() * VOICE_PROMPTS.length)];
}

export default function VoiceVerification({ onVoiceVerificationComplete, isLoading }) {
  const [prompt] = useState(getRandomPrompt);
  const [status, setStatus] = useState('idle'); // idle | recording | analyzing | done
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const startRecording = async () => {
    setError('');
    setStatus('recording');
    setTimeLeft(VERIFICATION.MAX_RECORDING_SECONDS);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => analyzeAudio();
      recorder.start();

      // Auto-stop countdown
      let secondsLeft = VERIFICATION.MAX_RECORDING_SECONDS;
      timerRef.current = setInterval(() => {
        secondsLeft--;
        setTimeLeft(secondsLeft);
        if (secondsLeft <= 0) stopRecording();
      }, 1000);

    } catch {
      setError('Microphone access denied. Please allow access and try again.');
      setStatus('idle');
    }
  };

  const stopRecording = () => {
    clearInterval(timerRef.current);
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    setStatus('analyzing');
  };

  const analyzeAudio = async () => {
    const blob = new Blob(chunksRef.current, { type: 'audio/wav' });

    // Check duration
    const durationSeconds = chunksRef.current.reduce((sum, c) => sum + (c.size / 32000), 0);
    if (durationSeconds < VERIFICATION.MIN_RECORDING_SECONDS) {
      setError(`Recording too short. Please speak for at least ${VERIFICATION.MIN_RECORDING_SECONDS} seconds.`);
      setStatus('idle');
      return;
    }

    try {
      const arrayBuffer = await blob.arrayBuffer();
      const audioCtx = new AudioContext();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      const { hasVoice, rms } = detectVoiceActivity(audioBuffer);
      const { frequency, isFemalePitch } = detectPitch(audioBuffer);

      const results = {
        durationSeconds,
        rms,
        frequency,
        isFemalePitch,
        hasVoice,
        passed: hasVoice && rms > VERIFICATION.MIN_VOICE_RMS,
      };

      setStatus('done');
      onVoiceVerificationComplete(results.passed, results);

    } catch (err) {
      setError('Audio analysis failed. Please try again.');
      setStatus('idle');
    }
  };

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  return (
    <div className="text-center">
      <h3 className="text-2xl font-bold mb-2 text-gray-800">Step 3: Voice Verification</h3>
      <p className="text-gray-500 mb-6">Confirm you're a real person with your voice</p>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
        <p className="text-xs text-blue-500 font-semibold uppercase tracking-wide mb-2">Your Prompt</p>
        <p className="text-blue-900 font-semibold text-lg">{prompt}</p>
      </div>

      {status === 'idle' && (
        <button onClick={startRecording} className="btn-primary text-lg px-8 py-4">
          🎤 Start Recording
        </button>
      )}

      {status === 'recording' && (
        <div>
          <div className="text-red-500 font-bold text-lg mb-3 animate-pulse">
            🔴 Recording... {timeLeft}s remaining
          </div>
          <button onClick={stopRecording} className="btn-danger px-8 py-3">
            ⏹ Stop Recording
          </button>
        </div>
      )}

      {status === 'analyzing' && (
        <div className="text-blue-600 font-semibold animate-pulse text-lg">
          🔍 Analyzing your voice...
        </div>
      )}

      {status === 'done' && (
        <div className="text-green-600 font-bold text-xl">✅ Voice analyzed!</div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 font-medium">
          ⚠️ {error}
          <button
            onClick={() => { setStatus('idle'); setError(''); }}
            className="block mx-auto mt-2 text-blue-600 underline text-sm"
          >
            Try again
          </button>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-6">
        Speak clearly for {VERIFICATION.MIN_RECORDING_SECONDS}–{VERIFICATION.MAX_RECORDING_SECONDS} seconds. Your voice is analyzed locally and never stored.
      </p>
    </div>
  );
}
