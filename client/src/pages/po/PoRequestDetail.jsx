import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { useI18n } from '../../hooks/useI18n';
import { StatusPill } from '../../components/StatusPill';
import { useToast } from '../../hooks/useToast';

export default function PoRequestDetail() {
  const { number } = useParams();
  const { t, statusLabel, lang } = useI18n();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [tab, setTab] = useState('triage');
  const [question, setQuestion] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [form, setForm] = useState({
    category_id: '',
    business_value: 'high',
    effort: 5,
    final_priority: 1,
    visibility: 'public',
  });
  const [story, setStory] = useState({ as_a: '', i_want: '', so_that: '', criteria: [] });

  const load = async () => {
    const [req, cats] = await Promise.all([api(`/requests/${number}`), api('/categories')]);
    setData(req);
    setCategories(cats);
    setForm({
      category_id: req.category_id || '',
      business_value: req.business_value || 'medium',
      effort: req.effort || 3,
      final_priority: req.final_priority || 1,
      visibility: req.visibility,
    });
    if (req.user_story) {
      setStory({
        as_a: req.user_story.as_a,
        i_want: req.user_story.i_want,
        so_that: req.user_story.so_that,
        criteria: req.user_story.criteria || [],
      });
    } else {
      setStory({
        as_a: lang === 'pt' ? 'diretor financeiro de uma empresa cliente' : 'finance director of a customer company',
        i_want: req.title,
        so_that: req.benefit,
        criteria: [],
      });
    }
  };

  useEffect(() => {
    load().catch(() => {});
  }, [number]);

  if (!data) return <p>{t('loading')}</p>;

  const patch = async (body, msg) => {
    await api(`/requests/${number}`, { method: 'PATCH', body: JSON.stringify(body) });
    toast.show(msg);
    load();
  };

  return (
    <>
      <div className="row" style={{ marginBottom: 8 }}>
        <StatusPill status={data.status} label={statusLabel(data)} />
        <span className="pill">
          {data.votes} {t('votes').toLowerCase()}
        </span>
        <Link className="btn btn-sm" to="/po/merge">
          {t('compareMerge')}
        </Link>
      </div>
      <h1 className="page-title">
        #{data.number} · {data.title}
      </h1>
      <p className="page-sub">
        {t('submittedBy')} {data.submitter?.name} · {data.submitter?.organization}
      </p>

      <div className="tabs">
        {[
          ['triage', t('triage')],
          ['priority', t('priority')],
          ['story', t('userStory')],
          ['history', t('history')],
        ].map(([k, label]) => (
          <button key={k} type="button" className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'triage' && (
        <div className="grid-2">
          <div className="card stack">
            <div>
              <strong>{lang === 'pt' ? 'Necessidade' : 'Need'}</strong>
              <p>{data.need}</p>
            </div>
            <div>
              <strong>{lang === 'pt' ? 'Benefício' : 'Benefit'}</strong>
              <p>{data.benefit}</p>
            </div>
            <div className="field">
              <label>{lang === 'pt' ? 'Categoria' : 'Category'}</label>
              <select
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: Number(e.target.value) })}
              >
                <option value="">—</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {lang === 'pt' ? c.name_pt : c.name_en}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{t('visibility')}</label>
              <select
                value={form.visibility}
                onChange={(e) => setForm({ ...form, visibility: e.target.value })}
              >
                <option value="public">{t('public')}</option>
                <option value="private">{t('private')}</option>
              </select>
            </div>
            <div className="row">
              <button
                className="btn btn-primary"
                type="button"
                onClick={() =>
                  patch(
                    { ...form, status: 'admitted' },
                    lang === 'pt' ? 'Pedido admitido' : 'Request admitted',
                  )
                }
              >
                {t('admit')}
              </button>
              <button className="btn btn-danger" type="button" onClick={() => setRejectOpen(true)}>
                {t('reject')}
              </button>
              <button
                className="btn"
                type="button"
                onClick={() => patch(form, lang === 'pt' ? 'Descrição guardada' : 'Saved')}
              >
                {t('save')}
              </button>
            </div>
          </div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>{t('askClarification')}</h3>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={lang === 'pt' ? 'Escrever pergunta ao cliente…' : 'Write a question…'}
              style={{ width: '100%', minHeight: 90, borderRadius: 8, border: '1px solid var(--borda-forte)', padding: 10 }}
            />
            <button
              className="btn btn-primary"
              type="button"
              style={{ marginTop: 8 }}
              onClick={async () => {
                await api(`/requests/${number}/comments`, {
                  method: 'POST',
                  body: JSON.stringify({ body: question, kind: 'clarification' }),
                });
                setQuestion('');
                toast.show(lang === 'pt' ? 'Pergunta enviada' : 'Question sent');
                load();
              }}
            >
              {t('send')}
            </button>
            <div className="stack" style={{ marginTop: 16 }}>
              {data.comments?.map((c) => (
                <div key={c.id}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{c.author_name}</div>
                  <div style={{ fontSize: 14 }}>{c.body}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'priority' && (
        <div className="grid-2">
          <div className="card">
            <div className="field">
              <label>{t('businessValue')}</label>
              <select
                value={form.business_value}
                onChange={(e) => setForm({ ...form, business_value: e.target.value })}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="field">
              <label>{t('effort')}</label>
              <input
                type="number"
                min="1"
                max="21"
                value={form.effort}
                onChange={(e) => setForm({ ...form, effort: Number(e.target.value) })}
              />
            </div>
            <div className="field">
              <label>{t('finalPriority')}</label>
              <input
                type="number"
                min="1"
                max="99"
                value={form.final_priority}
                onChange={(e) => setForm({ ...form, final_priority: Number(e.target.value) })}
              />
            </div>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => patch(form, lang === 'pt' ? 'Prioridade guardada' : 'Priority saved')}
            >
              {t('save')}
            </button>
          </div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>{t('aiSuggestion')}</h3>
            <p style={{ fontSize: 32, fontWeight: 700, margin: '8px 0' }}>{data.ai_score ?? '—'}</p>
            <p className="muted">{data.ai_rationale}</p>
            <button
              className="btn"
              type="button"
              onClick={async () => {
                await api(`/requests/${number}/ai-priority`, { method: 'POST' });
                toast.show(lang === 'pt' ? 'Sugestão atualizada' : 'Suggestion updated');
                load();
              }}
            >
              {t('refreshAi')}
            </button>
          </div>
        </div>
      )}

      {tab === 'story' && (
        <div className="card">
          <div className="field">
            <label>As a / Como</label>
            <input value={story.as_a} onChange={(e) => setStory({ ...story, as_a: e.target.value })} />
          </div>
          <div className="field">
            <label>I want / quero</label>
            <input value={story.i_want} onChange={(e) => setStory({ ...story, i_want: e.target.value })} />
          </div>
          <div className="field">
            <label>So that / para</label>
            <input value={story.so_that} onChange={(e) => setStory({ ...story, so_that: e.target.value })} />
          </div>
          <h3>{t('acceptance')}</h3>
          {(story.criteria || []).map((c, i) => (
            <div key={i} className="field">
              <label>{c.code || `CA${i + 1}`}</label>
              <input
                value={c.text}
                onChange={(e) => {
                  const criteria = [...story.criteria];
                  criteria[i] = { ...criteria[i], text: e.target.value };
                  setStory({ ...story, criteria });
                }}
              />
            </div>
          ))}
          <div className="row">
            <button
              className="btn"
              type="button"
              onClick={() =>
                setStory({
                  ...story,
                  criteria: [
                    ...story.criteria,
                    { code: `CA${story.criteria.length + 1}`, text: '' },
                  ],
                })
              }
            >
              + CA
            </button>
            <button
              className="btn"
              type="button"
              onClick={async () => {
                await api(`/requests/${number}/user-story`, {
                  method: 'POST',
                  body: JSON.stringify({ ...story, status: 'draft' }),
                });
                toast.show(lang === 'pt' ? 'Rascunho gerado' : 'Draft generated');
                load();
              }}
            >
              {t('generateStory')}
            </button>
            <button
              className="btn btn-primary"
              type="button"
              onClick={async () => {
                await api(`/requests/${number}/user-story`, {
                  method: 'POST',
                  body: JSON.stringify({ ...story, status: 'approved' }),
                });
                toast.show(lang === 'pt' ? 'User story aprovada' : 'User story approved');
                load();
              }}
            >
              {t('approveStory')}
            </button>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="card">
          {data.history?.map((h) => (
            <div key={h.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--borda-padrao)' }}>
              <strong>{h.actor_name || '—'}</strong> · {h.action}
              <div className="muted">{h.detail}</div>
            </div>
          ))}
        </div>
      )}

      {rejectOpen ? (
        <div className="modal-backdrop" onClick={() => setRejectOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{lang === 'pt' ? 'Rejeitar pedido' : 'Reject request'}</h3>
            <div className="field">
              <label>{lang === 'pt' ? 'Motivo' : 'Reason'}</label>
              <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            </div>
            <div className="row">
              <button className="btn" type="button" onClick={() => setRejectOpen(false)}>
                {t('cancel')}
              </button>
              <button
                className="btn btn-danger"
                type="button"
                onClick={() => {
                  setRejectOpen(false);
                  patch(
                    { status: 'rejected', rejection_reason: rejectReason },
                    lang === 'pt' ? 'Pedido rejeitado' : 'Request rejected',
                  );
                }}
              >
                {t('reject')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
