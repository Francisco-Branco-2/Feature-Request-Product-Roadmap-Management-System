import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useI18n } from '../../hooks/useI18n';
import { StatusPill } from '../../components/StatusPill';
import { useToast } from '../../hooks/useToast';

export default function Releases() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [releases, setReleases] = useState([]);
  const [open, setOpen] = useState(false);
  const [milestone, setMilestone] = useState({ name: '', target_date: '' });

  const load = () => api('/releases').then(setReleases);
  useEffect(() => {
    load();
  }, []);

  const release = releases[0];

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1 className="page-title" style={{ margin: 0 }}>
          {t('releases')}
        </h1>
        <button className="btn btn-primary" type="button" onClick={() => setOpen(true)}>
          {lang === 'pt' ? 'Novo marco' : 'New milestone'}
        </button>
      </div>
      <p className="page-sub">
        {lang === 'pt'
          ? 'Conteúdo da release, equipas e marcos de entrega.'
          : 'Release content, teams and delivery milestones.'}
      </p>

      {release ? (
        <div className="grid-2">
          <div className="card">
            <h3 style={{ marginTop: 0 }}>
              {release.name} · {release.version}
            </h3>
            <p className="muted">{release.description}</p>
            <p>
              <StatusPill status={release.status} label={release.status} /> · {release.target_date}
            </p>
            <h4>{t('features')}</h4>
            {release.features.map((f) => (
              <div key={f.id} className="kanban-card">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong>{f.code}</strong>
                  <StatusPill status={f.status} label={f.status} />
                </div>
                <div style={{ fontSize: 13 }}>{f.title}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {f.team || '—'} · {f.estimate_points || 0} pts
                </div>
              </div>
            ))}
          </div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>{t('milestones')}</h3>
            {release.milestones.map((m) => (
              <div
                key={m.id}
                style={{ padding: '12px 0', borderBottom: '1px solid var(--borda-padrao)' }}
              >
                <strong>{m.name}</strong>
                <div className="muted">{m.target_date}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p>{t('loading')}</p>
      )}

      {open && release ? (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{lang === 'pt' ? 'Novo marco' : 'New milestone'}</h3>
            <div className="field">
              <label>{lang === 'pt' ? 'Nome' : 'Name'}</label>
              <input
                value={milestone.name}
                onChange={(e) => setMilestone({ ...milestone, name: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Date</label>
              <input
                type="date"
                value={milestone.target_date}
                onChange={(e) => setMilestone({ ...milestone, target_date: e.target.value })}
              />
            </div>
            <div className="row">
              <button className="btn" type="button" onClick={() => setOpen(false)}>
                {t('cancel')}
              </button>
              <button
                className="btn btn-primary"
                type="button"
                onClick={async () => {
                  await api(`/releases/${release.id}/milestones`, {
                    method: 'POST',
                    body: JSON.stringify(milestone),
                  });
                  setOpen(false);
                  toast.show(lang === 'pt' ? 'Marco registado' : 'Milestone saved');
                  load();
                }}
              >
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
