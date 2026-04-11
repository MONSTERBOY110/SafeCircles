import React, { useState } from 'react';
import FaceDetection from './FaceDetection';
import HeadMovement from './HeadMovement';
import VoiceVerification from './VoiceVerification';
import { saveVerificationData } from '../../services/verification';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import { CheckCircle2, ArrowRight, ShieldCheck, ArrowLeft } from 'lucide-react';

const STEPS = ['face', 'head', 'voice', 'complete'];
const STEP_LABELS = ['Face Scan', 'Head Movement', 'Voice Check'];

function StepProgress({ currentStep }) {
  const idx = STEPS.indexOf(currentStep);
  const displayStep = Math.min(idx + 1, STEP_LABELS.length);
  const total = STEP_LABELS.length;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[#eae0c8]/40 text-xs font-bold uppercase tracking-widest">
          {currentStep === 'complete' ? 'Complete' : `Step ${displayStep} of ${total}`}
        </p>
        <p className="text-[#eae0c8]/60 text-xs font-semibold">
          {currentStep !== 'complete' ? STEP_LABELS[idx] : 'Identity Verified'}
        </p>
      </div>
      <div className="h-1 w-full rounded-full bg-[#111A3A]/70">
        <div
          className="bg-blue-500 h-1 rounded-full transition-all duration-500"
          style={{ width: currentStep === 'complete' ? '100%' : `${((idx + 1) / (STEP_LABELS.length + 1)) * 100}%` }}
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

    let savedToFirestore = false;
    try {
      await saveVerificationData(completeData);
      if (auth.currentUser) {
        await updateDoc(doc(db, 'users', auth.currentUser.uid), { isVerified: true });
      }
      savedToFirestore = true;
    } catch (err) {
      // Firestore write failed (common cause: ad blocker blocking firestore.googleapis.com)
      // Verification was locally validated — still proceed to dashboard
      console.warn('Firestore save failed (possible ad blocker):', err.message);
    }

    try {
      await refreshUserData();
    } catch (e) { /* ignore refresh failure */ }

    setIsLoading(false);

    if (savedToFirestore) {
      toast.success('Verification complete');
    } else {
      toast.success('Verification complete (sync pending — disable ad blocker for full save)');
    }
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#0B132B] flex flex-col items-center justify-center p-4 py-12 relative">
      {/* Ambient glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none z-0" />

      <div className="relative z-10 w-full max-w-2xl mx-auto">
        {/* Back button */}
        <button
          onClick={() => navigate('/dashboard')}
          className="absolute -top-2 left-0 flex items-center gap-1.5 rounded-xl border border-white/5 bg-[#0B132B]/60 px-3 py-2 text-sm font-semibold text-[#eae0c8]/50 transition-all hover:scale-105 hover:bg-[#0B132B]/80 hover:text-[#eae0c8] hover:shadow-[0_0_12px_rgba(59,130,246,0.12)]"
          aria-label="Back to dashboard"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-500/10 border border-blue-500/20 rounded-2xl mb-4">
            <ShieldCheck className="w-7 h-7 text-blue-400" />
          </div>
          <h1 className="text-3xl font-extrabold text-[#eae0c8] tracking-tight">Identity Verification</h1>
          <p className="text-[#eae0c8]/50 mt-2 text-sm font-medium">One-time verification to join SafeCircles</p>
        </div>

        {/* Step indicator */}
        <StepProgress currentStep={step} />

        {/* Glassmorphism Card */}
        <div className="rounded-2xl border border-white/5 bg-[#111A3A]/70 p-6 shadow-2xl backdrop-blur-md sm:p-8">
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
              <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500/10 border border-green-500/20 rounded-full mb-6 shadow-[0_0_30px_rgba(34,197,94,0.15)]">
                <CheckCircle2 className="w-10 h-10 text-green-400" />
              </div>
              <h2 className="text-2xl font-extrabold text-[#eae0c8] mb-3 tracking-wide">Verification Successful</h2>
              <p className="text-[#eae0c8]/60 text-sm mb-2 font-medium">You are now a verified SafeCircles user.</p>
              <p className="text-xs text-[#eae0c8]/30 mb-8 font-semibold uppercase tracking-wider">
                Your badge is permanent — no re-verification required.
              </p>
              <button
                onClick={() => navigate('/dashboard')}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-8 py-3.5 text-base font-extrabold text-[#EAE0C8] shadow-lg transition-all duration-200 hover:scale-[1.02] hover:bg-blue-500"
              >
                Go to Dashboard <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
