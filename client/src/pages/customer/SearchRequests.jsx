import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useI18n } from '../../hooks/useI18n';
import { StatusPill } from '../../components/StatusPill';
import { useAuth } from '../../hooks/useAuth';

export default function SearchRequests() {
  const { t, statusLabel, lang } = useI18n();
  const { user } = useAuth();
  const [q, setQ] = useState('centro de cust');
  const [rows, setRows] = useState([]);

  const search = async (query = q) => {
    const data = await api(`/requests/search?q=${encodeURIComponent(query)}`);
    setRows(data);
  };

  useEffect(() => {
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <h1 className="page-title">{t('searchRequests')}</h1>
      <p className="page-sub">{t('searchHint')}</p>
      <form
        className="row"
        style={{ marginBottom: 20 }}
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
      >
        <input
          style={{
            flex: 1,
            height: 40,
            borderRadius: 8,
            border: '1px solid var(--borda-forte)',
            padding: '0 12px',
            maxWidth: 480,
          }}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="btn btn-primary" type="submit">
          {lang === 'pt' ? 'Pesquisar' : 'Search'}
        </button>
      </form>
      <p className="muted" style={{ marginBottom: 12 }}>
        {rows.length} {lang === 'pt' ? 'resultados para' : 'results for'} “{q}”
      </p>
      {rows.map((r) => (
        <Link key={r.id} className="search-result" to={`/customer/requests/${r.number}`}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            #{r.number} · {r.title}
          </div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
            {r.need}
          </div>
          <div className="row">
            {r.category ? <span className="pill">{lang === 'pt' ? r.category.name_pt : r.category.name_en}</span> : null}
            <StatusPill status={r.status} label={statusLabel(r)} />
            <span className="pill">
              {r.votes} {t('votes').toLowerCase()}
            </span>
            {r.submitter_id === user.id ? (
              <span className="pill pill-purple">{lang === 'pt' ? 'O seu pedido' : 'Your request'}</span>
            ) : null}
          </div>
        </Link>
      ))}
    </>
  );
}
