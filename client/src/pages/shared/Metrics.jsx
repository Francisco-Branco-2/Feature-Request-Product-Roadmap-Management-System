import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useI18n } from '../../hooks/useI18n';

export default function Metrics() {
  const { t } = useI18n();
  const [m, setM] = useState(null);

  useEffect(() => {
    api('/metrics').then(setM);
  }, []);

  if (!m) return <p>{t('loading')}</p>;

  return (
    <>
      <h1 className="page-title">{t('metrics')}</h1>
      <p className="page-sub">Software engineering metrics for Nimbo Software</p>
      <div className="grid-4" style={{ marginBottom: 20 }}>
        <div className="card metric">
          <div className="value">{m.submitted}</div>
          <div className="label">{t('totalRequests')}</div>
        </div>
        <div className="card metric">
          <div className="value">{m.admitted}</div>
          <div className="label">{t('admitted')}</div>
        </div>
        <div className="card metric">
          <div className="value">{m.rejected}</div>
          <div className="label">{t('rejected')}</div>
        </div>
        <div className="card metric">
          <div className="value">{m.pending}</div>
          <div className="label">{t('pending')}</div>
        </div>
      </div>
      <div className="grid-3">
        <div className="card metric">
          <div className="value">{m.leadTimeDays}d</div>
          <div className="label">{t('leadTime')}</div>
        </div>
        <div className="card metric">
          <div className="value">{m.cycleTimeDays}d</div>
          <div className="label">{t('cycleTime')}</div>
        </div>
        <div className="card metric">
          <div className="value">{m.roadmapProgress}%</div>
          <div className="label">{t('roadmapProgress')}</div>
          <div className="bar" style={{ marginTop: 12 }}>
            <span style={{ width: `${m.roadmapProgress}%` }} />
          </div>
        </div>
      </div>
      <div className="grid-2" style={{ marginTop: 20 }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{t('perRelease')}</h3>
          {m.featuresPerRelease.map((r) => (
            <div key={r.name} className="row" style={{ justifyContent: 'space-between', padding: '8px 0' }}>
              <span>{r.name}</span>
              <strong>{r.c}</strong>
            </div>
          ))}
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{t('workload')}</h3>
          {m.workload.map((w) => (
            <div key={w.team} style={{ marginBottom: 12 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span>{w.team}</span>
                <span className="muted">
                  {w.c} · {w.points} pts
                </span>
              </div>
              <div className="bar" style={{ marginTop: 6 }}>
                <span style={{ width: `${Math.min(100, w.points * 6)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
