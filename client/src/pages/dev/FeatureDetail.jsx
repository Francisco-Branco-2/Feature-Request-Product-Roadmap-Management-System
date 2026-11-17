import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { useI18n } from '../../hooks/useI18n';
import { StatusPill } from '../../components/StatusPill';
import { useToast } from '../../hooks/useToast';

export default function FeatureDetail() {
  const { code } = useParams();
  const { t, lang } = useI18n();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [msg, setMsg] = useState('');
  const [estimate, setEstimate] = useState(5);

  const load = () => api(`/features/${code}`).then((d) => {
    setData(d);
    setEstimate(d.estimate_points || 5);
  });

  useEffect(() => {
    load().catch(() => setData(null));
  }, [code]);

  if (!data) return <p>{t('loading')}</p>;

  return (
    <>
      <div className="row" style={{ marginBottom: 8 }}>
        <StatusPill status={data.status} label={data.status} />
        <span className="pill">{data.team || '—'}</span>
      </div>
      <h1 className="page-title">
        {data.code} · {data.title}
      </h1>
      <p className="page-sub">
        {data.request ? (
          <>
            Traceability: #{data.request.number} · {data.request.title}
          </>
        ) : (
          '—'
        )}
      </p>

      <div className="grid-2">
        <div className="stack">
          <div className="card">
            <h3 style={{ marginTop: 0 }}>{lang === 'pt' ? 'Estado e estimativa' : 'Status & estimate'}</h3>
            <div className="field">
              <label>{t('status')}</label>
              <select
                value={data.status}
                onChange={async (e) => {
                  await api(`/features/${code}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ status: e.target.value }),
                  });
                  toast.show(lang === 'pt' ? 'Estado atualizado' : 'Status updated');
                  load();
                }}
              >
                <option value="backlog">backlog</option>
                <option value="ready">ready</option>
                <option value="in_development">in_development</option>
                <option value="done">done</option>
              </select>
            </div>
            <div className="field">
              <label>{lang === 'pt' ? 'Pontos' : 'Points'}</label>
              <input type="number" value={estimate} onChange={(e) => setEstimate(Number(e.target.value))} />
            </div>
            <button
              className="btn"
              type="button"
              onClick={async () => {
                await api(`/features/${code}`, {
                  method: 'PATCH',
                  body: JSON.stringify({ estimate_points: estimate }),
                });
                toast.show(lang === 'pt' ? 'Estimativa guardada' : 'Estimate saved');
                load();
              }}
            >
              {t('save')}
            </button>
            <div style={{ marginTop: 16 }}>
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
                Progress {data.progress || 0}%
              </div>
              <div className="bar">
                <span style={{ width: `${data.progress || 0}%` }} />
              </div>
            </div>
          </div>
          {data.request ? (
            <div className="card">
              <h3 style={{ marginTop: 0 }}>{lang === 'pt' ? 'Pedido de origem' : 'Source request'}</h3>
              <p>{data.request.need}</p>
            </div>
          ) : null}
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{t('discussions')}</h3>
          <div className="stack">
            {data.discussions?.map((d) => (
              <div key={d.id}>
                <strong style={{ fontSize: 13 }}>{d.author_name}</strong>
                <div style={{ fontSize: 14 }}>{d.body}</div>
              </div>
            ))}
          </div>
          <textarea
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder={lang === 'pt' ? 'Escreva a mensagem (@ para mencionar)…' : 'Write a message (@ to mention)…'}
            style={{ width: '100%', minHeight: 80, marginTop: 12, borderRadius: 8, border: '1px solid var(--borda-forte)', padding: 10 }}
          />
          <button
            className="btn btn-primary"
            type="button"
            style={{ marginTop: 8 }}
            onClick={async () => {
              await api(`/features/${code}/discussions`, {
                method: 'POST',
                body: JSON.stringify({ body: msg }),
              });
              setMsg('');
              toast.show(lang === 'pt' ? 'Mensagem publicada' : 'Message posted');
              load();
            }}
          >
            {t('send')}
          </button>
        </div>
      </div>
    </>
  );
}
