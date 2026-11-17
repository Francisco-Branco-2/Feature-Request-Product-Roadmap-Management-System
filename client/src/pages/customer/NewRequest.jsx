import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useI18n } from '../../hooks/useI18n';
import { useToast } from '../../hooks/useToast';

export default function NewRequest() {
  const { t, lang } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [need, setNeed] = useState('');
  const [benefit, setBenefit] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!need.trim() || !benefit.trim()) {
      toast.show(lang === 'pt' ? 'Necessidade em falta' : 'Need is required');
      return;
    }
    setBusy(true);
    try {
      const row = await api('/requests', {
        method: 'POST',
        body: JSON.stringify({ title, need, benefit }),
      });
      toast.show(lang === 'pt' ? 'Pedido submetido' : 'Request submitted');
      navigate(`/customer/requests/${row.number}`);
    } catch {
      toast.show(t('error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1 className="page-title">{t('newRequest')}</h1>
      <p className="page-sub">
        {lang === 'pt'
          ? 'Descreva o problema e o benefício que espera obter.'
          : 'Describe the problem and the benefit you expect.'}
      </p>
      <div className="grid-2">
        <form className="card" onSubmit={submit}>
          <div className="field">
            <label>{t('title')}</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="field">
            <label>{t('need')}</label>
            <textarea
              value={need}
              onChange={(e) => setNeed(e.target.value)}
              placeholder={t('needPlaceholder')}
              required
            />
          </div>
          <div className="field">
            <label>{t('benefit')}</label>
            <textarea value={benefit} onChange={(e) => setBenefit(e.target.value)} required />
          </div>
          <div className="row">
            <button className="btn" type="button" onClick={() => navigate(-1)}>
              {t('cancel')}
            </button>
            <button className="btn btn-primary" disabled={busy} type="submit">
              {t('submit')}
            </button>
          </div>
        </form>
        <div className="stack">
          <div className="card">
            <h3 style={{ marginTop: 0 }}>{t('beforeSubmit')}</h3>
            <p className="muted" style={{ fontSize: 13 }}>
              {t('beforeSubmitHint')}
            </p>
            <Link className="btn btn-sm" to="/customer/search">
              {t('searchRequests')}
            </Link>
          </div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>{t('afterSubmit')}</h3>
            <p className="muted" style={{ fontSize: 13 }}>
              {t('afterSubmitHint')}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
