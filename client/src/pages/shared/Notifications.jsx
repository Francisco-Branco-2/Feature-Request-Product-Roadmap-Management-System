import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useI18n } from '../../hooks/useI18n';
import { useToast } from '../../hooks/useToast';

export default function Notifications() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [rows, setRows] = useState([]);

  const load = () => api('/notifications').then(setRows);
  useEffect(() => {
    load();
  }, []);

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 className="page-title" style={{ margin: 0 }}>
          {t('notifications')}
        </h1>
        <button
          className="btn"
          type="button"
          onClick={async () => {
            await api('/notifications/read-all', { method: 'POST' });
            toast.show(lang === 'pt' ? 'Notificações lidas' : 'Notifications marked read');
            load();
          }}
        >
          {t('markRead')}
        </button>
      </div>
      <p className="page-sub">{lang === 'pt' ? 'Menções, estados e alertas da equipa.' : 'Mentions, status updates and team alerts.'}</p>
      <div className="stack">
        {rows.map((n) => (
          <Link
            key={n.id}
            to={n.link || '#'}
            className="card"
            style={{ opacity: n.read ? 0.65 : 1, display: 'block' }}
          >
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong>{n.title}</strong>
              <span className="muted">{n.relative}</span>
            </div>
            <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
              {n.body}
            </div>
          </Link>
        ))}
        {!rows.length ? <p className="muted">{t('noResults')}</p> : null}
      </div>
    </>
  );
}
