import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useI18n } from '../../hooks/useI18n';
import { StatusPill } from '../../components/StatusPill';
import { useToast } from '../../hooks/useToast';

export default function Roadmap() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [data, setData] = useState({ quarters: {}, items: [] });
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    api('/roadmap').then(setData);
  }, []);

  const quarters = Object.keys(data.quarters || {}).sort();

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 className="page-title" style={{ margin: 0 }}>
          {t('roadmap')}
        </h1>
        <button className="btn btn-primary" type="button" onClick={() => setExportOpen(true)}>
          {t('exportPdf')}
        </button>
      </div>
      <p className="page-sub">
        {lang === 'pt'
          ? 'Visão por trimestre com funcionalidades planeadas e progresso.'
          : 'Quarterly view with planned features and progress.'}
      </p>
      <div className="roadmap-board">
        {quarters.map((q) => (
          <div key={q} className="card roadmap-col">
            <h3>{q}</h3>
            {(data.quarters[q] || []).map((item) => (
              <div key={item.id} className="kanban-card">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong>{item.code}</strong>
                  <StatusPill status={item.status} label={item.status} />
                </div>
                <div style={{ fontSize: 13, margin: '6px 0' }}>{item.title}</div>
                <div className="bar">
                  <span style={{ width: `${item.progress || 0}%` }} />
                </div>
                <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                  {item.team || '—'} · {item.progress || 0}%
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {exportOpen ? (
        <div className="modal-backdrop" onClick={() => setExportOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{lang === 'pt' ? 'Exportar roadmap para PDF' : 'Export roadmap to PDF'}</h3>
            <p className="muted">
              {lang === 'pt'
                ? 'Gera um PDF do período selecionado (simulado no MVP).'
                : 'Generates a PDF for the selected period (simulated in the MVP).'}
            </p>
            <div className="field">
              <label>{lang === 'pt' ? 'Período' : 'Period'}</label>
              <select defaultValue="2027-Q1">
                {quarters.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            </div>
            <div className="row">
              <button className="btn" type="button" onClick={() => setExportOpen(false)}>
                {t('cancel')}
              </button>
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => {
                  setExportOpen(false);
                  toast.show(lang === 'pt' ? 'PDF exportado' : 'PDF exported');
                }}
              >
                {t('exportPdf')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
