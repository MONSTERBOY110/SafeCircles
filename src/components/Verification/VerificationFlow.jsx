import React, { useState } from 'react';
import FaceDetection from './FaceDetection';
import HeadMovement from './HeadMovement';
import VoiceVerification from './VoiceVerification';
import { saveVerificationData } from '../../services/verification';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const STEPS = ['face', 'head', 'voice', 'complete'];

function StepProgress({ currentStep }) {
  const labels = ['Face', 'Head Movement', 'Voice', 'Complete'];
  const widths = ['25%', '50%', '75%', '100%'];
  const idx = STEPS.indexOf(currentStep);

  return (
    <div className="mb-8">
      <div className="flex justify-between mb-2">
        {labels.map((label, i) => (
          <span
            key={label}
            className={`text-sm font-semibold ${i <= idx ? 'text-blue-600' : 'text-gray-400'}`}
          >
            {label}
          </span>
        ))}
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-500"
          style={{ width: widths[idx] }}
        />
      </div>
    </div>
  );
}

export default function VerificationFlow() {
  const [step, setStep] = useState('face');
  const [verificationData, setVerificationData] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const { refreshUserData } = useAuth();
  const navigate = useNavigate();

  const handleFaceDetected = () => {
    setVerificationData(prev => ({ ...prev, faceDetected: true }));
    setStep('head');
  };

  const handleHeadMovementComplete = () => {
    setVerificationData(prev => ({ ...prev, headMovementComplete: true }));
    setStep('voice');
  };

  const handleVoiceVerificationComplete = async (passed, results) => {
    if (!passed) {
      toast.error('Voice verification failed. Please try again.');
      return;
    }
    const completeData = { ...verificationData, voiceVerified: true, voiceAnalysis: results };
    setVerificationData(completeData);
    setIsLoading(true);
    try {
      await saveVerificationData(completeData);
      await refreshUserData();
      setStep('complete');
      toast.success('Verification complete! You are now verified ✅');
    } catch (err) {
      console.error('Error saving verification:', err);
      toast.error('Error completing verification. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 py-12">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Identity Verification</h1>
          <p className="text-gray-500 mt-1">One-time verification to join SafeCircles</p>
        </div>

        <StepProgress currentStep={step} />

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {step === 'face' && <FaceDetection onFaceDetected={handleFaceDetected} />}
          {step === 'head' && <HeadMovement onHeadMovementComplete={handleHeadMovementComplete} />}
          {step === 'voice' && (
            <VoiceVerification
              onVoiceVerificationComplete={handleVoiceVerificationComplete}
              isLoading={isLoading}
            />
          )}
          {step === 'complete' && (
            <div className="text-center py-12">
              <div className="text-7xl mb-4 animate-bounce">✅</div>
              <h2 className="text-3xl font-bold text-green-600 mb-4">Verification Complete!</h2>
              <p className="text-gray-600 mb-2">You are now a verified SafeCircles user.</p>
              <p className="text-sm text-gray-400 mb-8">
                Your badge is permanent — no re-verification required.
              </p>
              <button
                onClick={() => navigate('/dashboard')}
                className="btn-primary text-lg px-8 py-4"
              >
                Go to Dashboard →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
