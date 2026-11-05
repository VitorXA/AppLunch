import './App.css';
import { useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import AdminPanel from '../components/AdminPanel/AdminPanel';
import AuthPage from '../components/AuthPage/AuthPage';
import Header from '../components/Header/Header';
import ScanScreen from '../components/ScanScreen/ScanScreen';
import { strings } from '../strings';

// Carrega a sessão atual: { status: 'guest' | 'ready' | 'error', me }
async function loadSession() {
  try {
    return { status: 'ready', me: await api.me() };
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return { status: 'guest', me: null };
    return { status: 'error', me: null };
  }
}

export default function App() {
  const [session, setSession] = useState({ status: 'loading', me: null });
  const [tab, setTab] = useState('meal');

  useEffect(() => {
    let cancelled = false;
    loadSession().then((next) => {
      if (!cancelled) setSession(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = () => loadSession().then(setSession);

  const logout = async () => {
    await api.logout().catch(() => {});
    setTab('meal');
    setSession({ status: 'guest', me: null });
  };

  if (session.status === 'loading') return <p className="Status">{strings.loading}</p>;

  if (session.status === 'error') {
    return (
      <div className="Status">
        <p>{strings.loadError}</p>
        <button className="PrimaryButton" onClick={refresh}>
          {strings.retry}
        </button>
      </div>
    );
  }

  if (session.status === 'guest') return <AuthPage onAuthenticated={refresh} />;

  const { me } = session;
  const isAdmin = me.user.role === 'admin';
  return (
    <div className="Shell">
      <Header user={me.user} tab={tab} onTab={setTab} showAdmin={isAdmin} onLogout={logout} />
      {tab === 'admin' && isAdmin ? <AdminPanel /> : <ScanScreen me={me} onChange={refresh} />}
    </div>
  );
}
