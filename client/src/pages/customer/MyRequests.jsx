import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useI18n } from '../../hooks/useI18n';
import { StatusPill } from '../../components/StatusPill';

export default function MyRequests() {
  const { t, statusLabel, lang } = useI18n();
  const [rows, setRows] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    api('/requests?mine=1').then(setRows).catch(() => setRows([]));
  }, []);

  return (
    <>
      <h1 className="page-title">{t('myRequests')}</h1>
      <p className="page-sub">
        {lang === 'pt'
          ? `${rows.length} pedidos submetidos pela Beira Distribuição`
          : `${rows.length} requests submitted by Beira Distribuição`}
      </p>
      <table className="table">
        <thead>
          <tr>
            <th>{t('request').toUpperCase()}</th>
            <th>{t('status').toUpperCase()}</th>
            <th>{t('visibility').toUpperCase()}</th>
            <th>{t('votes').toUpperCase()}</th>
            <th>{t('followUp').toUpperCase()}</th>
            <th>{t('updated').toUpperCase()}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className="clickable"
              onClick={() => navigate(`/customer/requests/${r.number}`)}
            >
              <td>
                #{r.number} · {r.title}
              </td>
              <td>
                <StatusPill status={r.status} label={statusLabel(r)} />
              </td>
              <td>{r.visibility === 'public' ? t('public') : t('private')}</td>
              <td>{r.votes || '—'}</td>
              <td>
                {r.follow_up ? (
                  <span className="pill pill-amber">{r.follow_up}</span>
                ) : (
                  '—'
                )}
              </td>
              <td className="muted">{r.updated_relative}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
