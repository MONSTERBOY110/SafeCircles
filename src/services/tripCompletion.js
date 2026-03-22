import { httpsCallable } from 'firebase/functions';
import { getFunctions } from 'firebase/functions';
import app from './firebase';

const functions = getFunctions(app);

/**
 * Call the Cloud Function to mark a trip as complete.
 * Increments reputation for all circle members.
 */
export async function completeTripCall(tripId, circleId) {
  const completeTripFn = httpsCallable(functions, 'completeTrip');
  const result = await completeTripFn({ tripId, circleId });
  return result.data;
}
