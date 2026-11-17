import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useI18n } from '../../hooks/useI18n';
import { useToast } from '../../hooks/useToast';

export default function MergeRequests() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [primary, setPrimary] = useState('');
  const [secondary, setSecondary] = useState('');

  useEffect(() => {
    api('/requests').then(setRows);
  }, []);

  return (
    <>
      <h1 className="page-title">{t('compareMerge')}</h1>
      <p className="page-sub">
        {lang === 'pt'
          ? 'Compare pedidos semelhantes e funda-os num pedido principal (ex.: #142 e #160).'
          : 'Compare similar requests and merge them into a primary request (e.g. #142 and #160).'}
      </p>
      <div className="grid-2">
        <div className="card">
          <div className="field">
            <label>{lang === 'pt' ? 'Pedido principal' : 'Primary request'}</label>
            <select value={primary} onChange={(e) => setPrimary(e.target.value)}>
              <option value="">—</option>
              {rows.map((r) => (
                <option key={r.id} value={r.number}>
                  #{r.number} · {r.title}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>{lang === 'pt' ? 'Pedido a fundir' : 'Request to merge'}</label>
            <select value={secondary} onChange={(e) => setSecondary(e.target.value)}>
              <option value="">—</option>
              {rows.map((r) => (
                <option key={r.id} value={r.number}>
                  #{r.number} · {r.title}
                </option>
              ))}
            </select>
          </div>
          <button
            className="btn btn-primary"
            type="button"
            disabled={!primary || !secondary || primary === secondary}
            onClick={async () => {
              await api('/requests/merge', {
                method: 'POST',
                body: JSON.stringify({
                  primary_number: Number(primary),
                  secondary_number: Number(secondary),
                }),
              });
              toast.show(lang === 'pt' ? 'Pedidos fundidos' : 'Requests merged');
              const fresh = await api('/requests');
              setRows(fresh);
            }}
          >
            {t('merge')}
          </button>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{lang === 'pt' ? 'Diferenças' : 'Differences'}</h3>
          {primary && secondary ? (
            (() => {
              const a = rows.find((r) => String(r.number) === String(primary));
              const b = rows.find((r) => String(r.number) === String(secondary));
              if (!a || !b) return null;
              return (
                <div className="stack">
                  <div>
                    <strong>#{a.number}</strong>
                    <p>{a.need}</p>
                  </div>
                  <div>
                    <strong>#{b.number}</strong>
                    <p>{b.need}</p>
                  </div>
                </div>
              );
            })()
          ) : (
            <p className="muted">{lang === 'pt' ? 'Selecione dois pedidos.' : 'Select two requests.'}</p>
          )}
        </div>
      </div>
    </>
  );
}
