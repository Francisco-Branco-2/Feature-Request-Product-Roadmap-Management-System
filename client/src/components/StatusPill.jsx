import { useI18n } from '../hooks/useI18n';

const MAP = {
  pending_analysis: 'pill-amber',
  admitted: 'pill-blue',
  rejected: 'pill-red',
  in_backlog: 'pill-purple',
  in_development: 'pill-blue',
  done: 'pill-green',
  merged: 'pill-purple',
  ready: 'pill-purple',
  backlog: 'pill-amber',
};

export function StatusPill({ status, label }) {
  const { statusLabel, lang } = useI18n();
  const text =
    label ||
    (typeof status === 'object'
      ? statusLabel({ status_label: status, status: '' })
      : status);
  const key = typeof status === 'string' ? status : '';
  return <span className={`pill ${MAP[key] || ''}`}>{text || key}</span>;
}

export function LangToggle() {
  const { lang, set } = useI18n();
  return (
    <div className="lang-toggle" aria-label="Language">
      <button type="button" className={lang === 'pt' ? 'active' : ''} onClick={() => set('pt')}>
        PT
      </button>
      <button type="button" className={lang === 'en' ? 'active' : ''} onClick={() => set('en')}>
        EN
      </button>
    </div>
  );
}
