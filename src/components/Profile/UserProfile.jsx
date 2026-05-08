import React, { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import VerificationBadge from './VerificationBadge';
import ReputationScore from './ReputationScore';
import { Calendar, Mail, UserRound } from 'lucide-react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';

function AnimatedStat({ value }) {
  const shouldReduceMotion = useReducedMotion();
  const count = useMotionValue(shouldReduceMotion ? value : 0);
  const rounded = useTransform(count, (latest) => Math.round(latest));

  useEffect(() => {
    if (shouldReduceMotion) {
      count.set(value);
      return undefined;
    }

    const controls = animate(count, value, { duration: 0.8, ease: 'easeOut' });
    return controls.stop;
  }, [count, shouldReduceMotion, value]);

  return <motion.span>{rounded}</motion.span>;
}

export default function UserProfile() {
  const { user, userData, isVerified } = useAuth();
  if (!user || !userData) return null;
  const verificationStatus = isVerified ? 'VERIFIED' : userData.verification_status;
  const joinedDate = userData.createdAt?.toDate
    ? userData.createdAt.toDate().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Recently';

  return (
    <>
      <div className="profile-header">
        <div className="profile-avatar-large">{userData.name?.[0]?.toUpperCase() || '?'}</div>
        <h1 className="profile-name">{userData.name}</h1>
        <p className="profile-email">{user.email}</p>
        <VerificationBadge status={verificationStatus} />
      </div>

      <div className="profile-stats">
        <div className="stat-card">
          <div className="stat-value"><AnimatedStat value={userData.successful_trips || 0} /></div>
          <div className="stat-label">Trips</div>
        </div>
        <div className="stat-card">
          <div className="stat-value"><AnimatedStat value={userData.reputation_score || 0} /></div>
          <div className="stat-label">Reputation</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{isVerified ? 'Yes' : 'No'}</div>
          <div className="stat-label">Verified</div>
        </div>
      </div>

      <div className="profile-details-card">
        <div className="profile-detail-row">
          <div className="detail-icon"><UserRound size={18} /></div>
          <div>
            <div className="detail-label">Name</div>
            <div className="detail-value">{userData.name}</div>
          </div>
        </div>
        <div className="profile-detail-row">
          <div className="detail-icon"><Mail size={18} /></div>
          <div>
            <div className="detail-label">Email</div>
            <div className="detail-value">{user.email}</div>
          </div>
        </div>
        <div className="profile-detail-row">
          <div className="detail-icon"><Calendar size={18} /></div>
          <div>
            <div className="detail-label">Joined</div>
            <div className="detail-value">{joinedDate}</div>
          </div>
        </div>
      </div>

      <ReputationScore score={userData.reputation_score || 0} trips={userData.successful_trips || 0} />
    </>
  );
}
