import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useI18n } from '../../hooks/useI18n';
import { useToast } from '../../hooks/useToast';

const TITLE_MAX = 100;
const TEXT_MAX = 2000;

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
    const titleTrim = title.trim();
    const needTrim = need.trim();
    const benefitTrim = benefit.trim();

    if (!titleTrim) {
      toast.show(
        lang === 'pt'
          ? 'Indique o título para poder submeter o pedido.'
          : 'Enter a title to submit the request.',
      );
      return;
    }
    if (!needTrim) {
      toast.show(
        lang === 'pt'
          ? 'Descreva a necessidade para poder submeter o pedido.'
          : 'Describe the need to submit the request.',
      );
      return;
    }
    if (!benefitTrim) {
      toast.show(
        lang === 'pt'
          ? 'Indique o benefício esperado para poder submeter o pedido.'
          : 'Enter the expected benefit to submit the request.',
      );
      return;
    }
    if (titleTrim.length > TITLE_MAX || needTrim.length > TEXT_MAX || benefitTrim.length > TEXT_MAX) {
      toast.show(
        lang === 'pt'
          ? 'Um ou mais campos excedem o limite de caracteres.'
          : 'One or more fields exceed the character limit.',
      );
      return;
    }

    setBusy(true);
    try {
      await api('/requests', {
        method: 'POST',
        body: JSON.stringify({ title: titleTrim, need: needTrim, benefit: benefitTrim }),
      });
      toast.show(lang === 'pt' ? 'Pedido submetido' : 'Request submitted');
      navigate('/customer/requests');
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
        <form className="card" onSubmit={submit} noValidate>
          <div className="field">
            <label>{t('title')}</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={TITLE_MAX}
            />
          </div>
          <div className="field">
            <label>{t('need')}</label>
            <textarea
              value={need}
              onChange={(e) => setNeed(e.target.value)}
              placeholder={t('needPlaceholder')}
              maxLength={TEXT_MAX}
            />
          </div>
          <div className="field">
            <label>{t('benefit')}</label>
            <textarea
              value={benefit}
              onChange={(e) => setBenefit(e.target.value)}
              maxLength={TEXT_MAX}
            />
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
