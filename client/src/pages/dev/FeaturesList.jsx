import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useI18n } from '../../hooks/useI18n';
import { StatusPill } from '../../components/StatusPill';

export default function FeaturesList() {
  const { t } = useI18n();
  const [rows, setRows] = useState([]);
  useEffect(() => {
    api('/backlog').then(setRows);
  }, []);
  return (
    <>
      <h1 className="page-title">{t('features')}</h1>
      <table className="table">
        <thead>
          <tr>
            <th>Code</th>
            <th>{t('title')}</th>
            <th>{t('status')}</th>
            <th>Team</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((f) => (
            <tr key={f.id}>
              <td>
                <Link to={`/dev/features/${f.code}`}>{f.code}</Link>
              </td>
              <td>{f.title}</td>
              <td>
                <StatusPill status={f.status} label={f.status} />
              </td>
              <td>{f.team || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
