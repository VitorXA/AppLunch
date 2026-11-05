import { Focus } from 'lucide-react';
import './ScanButton.css';

export default function ScanButton({ onClick, disabled, label }) {
  return (
    <button className="buttonScan" onClick={onClick} disabled={disabled} aria-label={label} title={label}>
      <Focus color="white" size={48} aria-hidden="true" />
    </button>
  );
}
