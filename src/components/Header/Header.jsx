import { LogOut } from 'lucide-react';
import { appName, strings } from '../../strings';
import './Header.css';

export default function Header({ user, tab, onTab, showAdmin, onLogout }) {
  return (
    <header className="Header">
      <div className="Header-top">
        <strong>{appName}</strong>
        <span className="Header-user">{user.name}</span>
        <button className="Header-logout" onClick={onLogout} aria-label={strings.header.logout} title={strings.header.logout}>
          <LogOut size={20} />
        </button>
      </div>
      {showAdmin && (
        <nav className="Header-tabs">
          <button aria-pressed={tab === 'meal'} onClick={() => onTab('meal')}>
            {strings.header.meal}
          </button>
          <button aria-pressed={tab === 'admin'} onClick={() => onTab('admin')}>
            {strings.header.admin}
          </button>
        </nav>
      )}
    </header>
  );
}
