import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useI18n } from '../../hooks/useI18n';
import { StatusPill } from '../../components/StatusPill';

export default function Backlog() {
  const { t, lang } = useI18n();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    api('/backlog').then(setRows);
  }, []);

  const sprint = rows.filter((r) => r.sprint);
  const backlog = rows.filter((r) => !r.sprint || r.status === 'backlog');

  return (
    <>
      <h1 className="page-title">{t('backlog')}</h1>
      <p className="page-sub">
        {lang === 'pt'
          ? 'Product backlog e definição de sprint — rastreio a pedidos e prioridades.'
          : 'Product backlog and sprint definition — traced to requests and priorities.'}
      </p>
      <div className="grid-2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{t('backlog')}</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>{t('title')}</th>
                <th>Prio</th>
                <th>{t('status')}</th>
              </tr>
            </thead>
            <tbody>
              {backlog.map((f) => (
                <tr key={f.id}>
                  <td>
                    <Link to={`/dev/features/${f.code}`}>{f.code}</Link>
                  </td>
                  <td>{f.title}</td>
                  <td>{f.final_priority ?? '—'}</td>
                  <td>
                    <StatusPill status={f.status} label={f.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{t('sprint')}</h3>
          {sprint.map((f) => (
            <div key={f.id} className="kanban-card">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong>{f.code}</strong>
                <StatusPill status={f.status} label={f.status} />
              </div>
              <div style={{ fontSize: 13, marginTop: 6 }}>{f.title}</div>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                {f.sprint} · {f.estimate_points || 0} pts · {f.assignee_name || '—'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
