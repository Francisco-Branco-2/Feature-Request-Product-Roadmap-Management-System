import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useI18n } from '../../hooks/useI18n';
import { StatusPill } from '../../components/StatusPill';

export default function PoRequests() {
  const { t, statusLabel, lang } = useI18n();
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const q = status ? `?status=${status}` : '';
    api(`/requests${q}`).then(setRows).catch(() => setRows([]));
  }, [status]);

  return (
    <>
      <h1 className="page-title">{lang === 'pt' ? 'Pedidos' : 'Requests'}</h1>
      <p className="page-sub">
        {lang === 'pt'
          ? 'Triagem, classificação e priorização pela Product Owner.'
          : 'Triage, classification and prioritization by the Product Owner.'}
      </p>
      <div className="row" style={{ marginBottom: 16 }}>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ height: 36, borderRadius: 8 }}>
          <option value="">{lang === 'pt' ? 'Todos os estados' : 'All statuses'}</option>
          <option value="pending_analysis">{lang === 'pt' ? 'Pendente de Análise' : 'Pending analysis'}</option>
          <option value="admitted">{lang === 'pt' ? 'Admitido' : 'Admitted'}</option>
          <option value="rejected">{lang === 'pt' ? 'Rejeitado' : 'Rejected'}</option>
        </select>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>#</th>
            <th>{t('request').toUpperCase()}</th>
            <th>{t('status').toUpperCase()}</th>
            <th>{t('votes').toUpperCase()}</th>
            <th>IA</th>
            <th>{t('updated').toUpperCase()}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="clickable" onClick={() => navigate(`/po/requests/${r.number}`)}>
              <td>{r.number}</td>
              <td>{r.title}</td>
              <td>
                <StatusPill status={r.status} label={statusLabel(r)} />
              </td>
              <td>{r.votes}</td>
              <td>{r.ai_score != null ? r.ai_score.toFixed?.(2) ?? r.ai_score : '—'}</td>
              <td className="muted">{r.updated_relative}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
