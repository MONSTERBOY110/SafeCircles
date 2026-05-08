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
import Header from '../Layout/Header';
import PageTransition from '../PageTransition';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

const STEPS = ['face', 'head', 'voice', 'complete'];
const STEP_LABELS = ['Face Scan', 'Head Movement', 'Voice Check'];

function StepProgress({ currentStep }) {
  const idx = STEPS.indexOf(currentStep);
  const displayStep = Math.min(idx + 1, STEP_LABELS.length);
  const total = STEP_LABELS.length;
  const activeIndex = currentStep === 'complete' ? total : idx;

  return (
    <div className="mb-6">
      <div className="verification-steps">
        {STEP_LABELS.map((label, stepIndex) => (
          <React.Fragment key={label}>
            <div className="step-item">
              <div
                className={`step-circle ${
                  stepIndex < activeIndex ? 'completed' : stepIndex === activeIndex ? 'active' : 'inactive'
                }`}
              >
                {stepIndex + 1}
              </div>
              {stepIndex < STEP_LABELS.length - 1 && (
                <div className={`step-line ${stepIndex < activeIndex ? 'completed' : ''}`} />
              )}
            </div>
          </React.Fragment>
        ))}
      </div>
      <p className="section-title text-center">
        {currentStep === 'complete' ? 'Complete' : `Step ${displayStep} of ${total} · ${STEP_LABELS[idx]}`}
      </p>
    </div>
  );
}

export default function VerificationFlow() {
  const shouldReduceMotion = useReducedMotion();
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
        await updateDoc(doc(db, 'users', auth.currentUser.uid), {
          isVerified: true,
          verification_status: 'VERIFIED',
        });
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
    <div className="app-shell">
      <Header title="Verify Identity" />
      <PageTransition>
        {/* Back button */}
        <button
          onClick={() => navigate('/dashboard')}
          className="btn-ghost mb-5"
          aria-label="Back to dashboard"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--border-medium)] bg-[var(--color-100)] text-[var(--color-700)]">
            <ShieldCheck size={28} />
          </div>
          <h1 className="auth-title">Identity Verification</h1>
          <p className="auth-subtitle">One-time verification to join SafeCircles</p>
        </div>

        {/* Step indicator */}
        <StepProgress currentStep={step} />

        {/* Glassmorphism Card */}
        <div className="card !rounded-[var(--radius-xl)] !p-5 sm:!p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={shouldReduceMotion ? false : { opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={shouldReduceMotion ? undefined : { opacity: 0, x: -40 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.25, ease: 'easeOut' }}
            >
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
                className="btn-primary"
              >
                Go to Dashboard <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
            </motion.div>
          </AnimatePresence>
        </div>
      </PageTransition>
    </div>
  );
}
