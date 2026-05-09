import React, { createContext, useContext, useState } from 'react';

const VerificationContext = createContext();

export function VerificationProvider({ children }) {
  const [step, setStep] = useState('face'); // face | head | voice | complete
  const [faceData, setFaceData] = useState(null);
  const [headData, setHeadData] = useState(null);
  const [voiceData, setVoiceData] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState(null);

  const nextStep = (currentStep, data) => {
    if (currentStep === 'face') {
      setFaceData(data);
      setStep('head');
    } else if (currentStep === 'head') {
      setHeadData(data);
      setStep('voice');
    } else if (currentStep === 'voice') {
      setVoiceData(data);
      setStep('complete');
    }
  };

  const resetVerification = () => {
    setStep('face');
    setFaceData(null);
    setHeadData(null);
    setVoiceData(null);
    setIsVerifying(false);
    setError(null);
  };

  return (
    <VerificationContext.Provider value={{
      step,
      faceData,
      headData,
      voiceData,
      isVerifying,
      error,
      setError,
      setIsVerifying,
      nextStep,
      resetVerification,
    }}>
      {children}
    </VerificationContext.Provider>
  );
}

export function useVerification() {
  const context = useContext(VerificationContext);
  if (!context) {
    throw new Error('useVerification must be used within VerificationProvider');
  }
  return context;
}
