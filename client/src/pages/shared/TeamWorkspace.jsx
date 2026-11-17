import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useI18n } from '../../hooks/useI18n';
import { StatusPill } from '../../components/StatusPill';

const COLS = [
  { key: 'backlog', label: 'Backlog' },
  { key: 'ready', label: 'Ready' },
  { key: 'in_development', labelPt: 'Em desenvolvimento', labelEn: 'In development' },
  { key: 'done', labelPt: 'Concluído', labelEn: 'Done' },
];

export default function TeamWorkspace() {
  const { t, lang } = useI18n();
  const [data, setData] = useState({ members: [], board: [] });
  const [tab, setTab] = useState('board');

  useEffect(() => {
    api('/team').then(setData);
  }, []);

  return (
    <>
      <h1 className="page-title">{t('teamSpace')}</h1>
      <p className="page-sub">
        {lang === 'pt'
          ? 'Quadro da equipa, funcionalidades e discussões.'
          : 'Team board, features and discussions.'}
      </p>
      <div className="tabs">
        <button type="button" className={tab === 'board' ? 'active' : ''} onClick={() => setTab('board')}>
          Board
        </button>
        <button type="button" className={tab === 'features' ? 'active' : ''} onClick={() => setTab('features')}>
          {t('features')}
        </button>
        <button type="button" className={tab === 'people' ? 'active' : ''} onClick={() => setTab('people')}>
          {lang === 'pt' ? 'Equipa' : 'Team'}
        </button>
      </div>

      {tab === 'board' && (
        <div className="kanban">
          {COLS.map((col) => (
            <div key={col.key} className="kanban-col">
              <h3>{col.label || (lang === 'pt' ? col.labelPt : col.labelEn)}</h3>
              {data.board
                .filter((f) => f.status === col.key)
                .map((f) => (
                  <Link key={f.id} to={`/dev/features/${f.code}`} className="kanban-card" style={{ display: 'block' }}>
                    <strong>{f.code}</strong>
                    <div style={{ fontSize: 13, marginTop: 4 }}>{f.title}</div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                      {f.team || '—'}
                    </div>
                  </Link>
                ))}
            </div>
          ))}
        </div>
      )}

      {tab === 'features' && (
        <table className="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>{t('title')}</th>
              <th>{t('status')}</th>
              <th>{t('sprint')}</th>
            </tr>
          </thead>
          <tbody>
            {data.board.map((f) => (
              <tr key={f.id}>
                <td>
                  <Link to={`/dev/features/${f.code}`}>{f.code}</Link>
                </td>
                <td>{f.title}</td>
                <td>
                  <StatusPill status={f.status} label={f.status} />
                </td>
                <td>{f.sprint || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === 'people' && (
        <div className="grid-3">
          {data.members.map((m) => (
            <div key={m.id} className="card">
              <strong>{m.name}</strong>
              <div className="muted" style={{ fontSize: 13 }}>
                {m.title}
              </div>
              <div style={{ marginTop: 8 }}>
                <span className="pill pill-blue">{t(`role_${m.role}`)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
