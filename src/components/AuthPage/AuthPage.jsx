import { useEffect, useState } from 'react';
import { api, ApiError } from '../../api/client';
import { errorMessage, idLabel, strings } from '../../strings';
import './AuthPage.css';

const EMPTY = { identifier: '', password: '', name: '', email: '', inviteCode: '' };

export default function AuthPage({ onAuthenticated }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [fields, setFields] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [siteConfig, setSiteConfig] = useState({ registrationOpen: true, requiresInviteCode: false });

  useEffect(() => {
    api
      .config()
      .then(setSiteConfig)
      .catch(() => {});
  }, []);

  const set = (key) => (event) => setFields((prev) => ({ ...prev, [key]: event.target.value }));
  const isSignup = mode === 'signup';

  async function submit(event) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (isSignup) await api.register(fields);
      else await api.login(fields.identifier, fields.password);
      await onAuthenticated();
    } catch (err) {
      setError(errorMessage(err instanceof ApiError ? err.code : 'unknown'));
      setBusy(false);
    }
  }

  function switchMode() {
    setMode(isSignup ? 'login' : 'signup');
    setError(null);
  }

  return (
    <form className="LogInBox" onSubmit={submit}>
      <h1 className="AuthTitle">{isSignup ? strings.auth.signupTitle : strings.auth.loginTitle}</h1>

      <input
        className="AuthInput"
        type="text"
        autoComplete="username"
        placeholder={strings.auth.identifier}
        aria-label={idLabel}
        value={fields.identifier}
        onChange={set('identifier')}
        required
      />
      {isSignup && (
        <input
          className="AuthInput"
          type="text"
          autoComplete="name"
          placeholder={strings.auth.name}
          aria-label={strings.auth.name}
          value={fields.name}
          onChange={set('name')}
          required
        />
      )}
      <input
        className="AuthInput"
        type="password"
        autoComplete={isSignup ? 'new-password' : 'current-password'}
        placeholder={strings.auth.password}
        aria-label={strings.auth.password}
        value={fields.password}
        onChange={set('password')}
        minLength={isSignup ? 8 : undefined}
        required
      />
      {isSignup && (
        <>
          <input
            className="AuthInput"
            type="email"
            autoComplete="email"
            placeholder={strings.auth.email}
            aria-label={strings.auth.email}
            value={fields.email}
            onChange={set('email')}
          />
          {siteConfig.requiresInviteCode && (
            <input
              className="AuthInput"
              type="text"
              placeholder={strings.auth.inviteCode}
              aria-label={strings.auth.inviteCode}
              value={fields.inviteCode}
              onChange={set('inviteCode')}
              required
            />
          )}
          <small className="AuthHint">{strings.auth.passwordHint}</small>
        </>
      )}

      {error && (
        <p className="Feedback error" role="alert">
          {error}
        </p>
      )}
      {isSignup && !siteConfig.registrationOpen && <p className="Feedback error">{strings.auth.registrationClosed}</p>}

      <button className="PrimaryButton" type="submit" disabled={busy || (isSignup && !siteConfig.registrationOpen)}>
        {busy ? strings.auth.working : isSignup ? strings.auth.signup : strings.auth.login}
      </button>
      <button className="LinkButton" type="button" onClick={switchMode}>
        {isSignup ? strings.auth.toLogin : strings.auth.toSignup}
      </button>
    </form>
  );
}
