import { useState, useRef, useCallback } from 'react';

/**
 * Hook to access the user's microphone and record audio.
 */
export function useMicrophone() {
  const [stream, setStream] = useState(null);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(false);
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const startMicrophone = useCallback(async () => {
    setError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(mediaStream);
      setActive(true);
      return mediaStream;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const stopMicrophone = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setActive(false);
    }
  }, [stream]);

  const startRecording = useCallback(() => {
    if (!stream) return;
    chunksRef.current = [];
    mediaRecorderRef.current = new MediaRecorder(stream);
    mediaRecorderRef.current.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    mediaRecorderRef.current.start();
    setRecording(true);
  }, [stream]);

  const stopRecording = useCallback(() => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current) {
        resolve(null);
        return;
      }
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/wav' });
        resolve(blob);
        setRecording(false);
      };
      mediaRecorderRef.current.stop();
    });
  }, []);

  return { stream, active, recording, error, startMicrophone, stopMicrophone, startRecording, stopRecording };
}
