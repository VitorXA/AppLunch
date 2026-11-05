import { useState } from 'react';
import { api, ApiError } from '../../api/client';
import { useCamera } from '../../hooks/useCamera';
import { errorMessage, strings } from '../../strings';
import ScanButton from '../ScanButton/ScanButton';
import './ScanScreen.css';

export default function ScanScreen({ me, onChange }) {
  const { videoRef, status, start, capture } = useCamera();
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'error' | 'success', text }
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState('');

  const enrolled = me.faceEnrolled;
  const current = me.meals.find((meal) => meal.id === me.currentMeal) ?? null;
  const cameraReady = status === 'ready';

  async function run(action, successText) {
    const image = capture();
    if (!image) return;
    setBusy(true);
    setFeedback({ type: 'success', text: strings.scan.verifying });
    try {
      await action(image);
      setFeedback({ type: 'success', text: successText });
      await onChange();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'unknown';
      setFeedback({ type: 'error', text: errorMessage(code) });
      if (code === 'unauthorized') await onChange();
    } finally {
      setBusy(false);
    }
  }

  async function removeFace(event) {
    event.preventDefault();
    try {
      await api.deleteFace(password);
      setDeleting(false);
      setPassword('');
      setConsent(false);
      setFeedback({ type: 'success', text: strings.scan.faceDeleted });
      await onChange();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'unknown';
      setFeedback({ type: 'error', text: code === 'invalid_credentials' ? strings.scan.wrongPassword : errorMessage(code) });
    }
  }

  return (
    <div id="backgroundScreen">
      <h1 id="headerApp">{strings.scan.title}</h1>

      <div className="Viewfinder" hidden={!cameraReady}>
        <video ref={videoRef} autoPlay playsInline muted />
      </div>

      {!cameraReady && (
        <button className="PrimaryButton" onClick={start} disabled={status === 'starting'}>
          {strings.scan.startCamera}
        </button>
      )}
      {status === 'error' && <p className="Feedback error">{strings.scan.cameraDenied}</p>}

      {!enrolled ? (
        <>
          <p>{strings.scan.enrollIntro}</p>
          <label className="Consent">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>{strings.scan.consent}</span>
          </label>
          <button
            className="PrimaryButton"
            disabled={!cameraReady || !consent || busy}
            onClick={() => run(api.enrollFace, strings.scan.enrolled)}
          >
            {strings.scan.enrollButton}
          </button>
        </>
      ) : (
        <div className="MealArea">
          {current ? (
            <p className="MealNow">{current.doneToday ? strings.scan.alreadyDone : strings.scan.mealNow(current.label)}</p>
          ) : (
            <>
              <p className="MealNow">{strings.scan.noMealNow}</p>
              <p className="Windows">
                {strings.scan.nextWindows} {me.meals.map((m) => `${m.label} ${m.start}–${m.end}`).join(' · ')}
              </p>
            </>
          )}
          <ScanButton
            label={strings.scan.scanAria}
            disabled={!cameraReady || !current || current.doneToday || busy}
            onClick={() => run(api.checkin, strings.scan.done(current.label))}
          />
        </div>
      )}

      {feedback && (
        <p className={`Feedback ${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>
          {feedback.text}
        </p>
      )}

      {enrolled &&
        (deleting ? (
          <form className="DeleteFace" onSubmit={removeFace}>
            <label>
              {strings.scan.deleteFacePrompt}
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <button className="PrimaryButton" type="submit">
              {strings.scan.deleteFace}
            </button>
          </form>
        ) : (
          <button className="LinkButton" onClick={() => setDeleting(true)}>
            {strings.scan.deleteFace}
          </button>
        ))}
    </div>
  );
}
