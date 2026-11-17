import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { useI18n } from '../../hooks/useI18n';
import { StatusPill } from '../../components/StatusPill';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../hooks/useAuth';

export default function RequestDetail() {
  const { number } = useParams();
  const { t, statusLabel, lang } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [reply, setReply] = useState('');

  const load = () => api(`/requests/${number}`).then(setData);
  useEffect(() => {
    load().catch(() => setData(null));
  }, [number]);

  if (!data) return <p>{t('loading')}</p>;

  const isOwner = data.submitter_id === user.id;
  const canVote = user.role === 'customer' && data.visibility === 'public' && !data.voted;

  const vote = async () => {
    try {
      await api(`/requests/${number}/vote`, { method: 'POST' });
      toast.show(lang === 'pt' ? 'Voto registado' : 'Vote recorded');
      load();
    } catch (e) {
      toast.show(e.message || t('error'));
    }
  };

  const sendReply = async () => {
    if (!reply.trim()) return;
    await api(`/requests/${number}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body: reply, kind: 'reply' }),
    });
    setReply('');
    toast.show(lang === 'pt' ? 'Resposta enviada' : 'Reply sent');
    load();
  };

  return (
    <>
      <div className="row" style={{ marginBottom: 8 }}>
        <StatusPill status={data.status} label={statusLabel(data)} />
        <span className="pill">{data.visibility === 'public' ? t('public') : t('private')}</span>
        <span className="pill">
          {data.votes} {t('votes').toLowerCase()}
        </span>
      </div>
      <h1 className="page-title">
        #{data.number} · {data.title}
      </h1>
      <p className="page-sub">
        {t('submittedBy')} {data.submitter?.name}
        {data.submitter?.organization ? ` · ${data.submitter.organization}` : ''}
      </p>

      <div className="grid-2">
        <div className="stack">
          <div className="card">
            <h3 style={{ marginTop: 0 }}>{lang === 'pt' ? 'Necessidade' : 'Need'}</h3>
            <p>{data.need}</p>
            <h3>{lang === 'pt' ? 'Benefício' : 'Benefit'}</h3>
            <p>{data.benefit}</p>
            {data.rejection_reason ? (
              <p className="pill pill-red" style={{ height: 'auto', padding: '8px 12px' }}>
                {data.rejection_reason}
              </p>
            ) : null}
            {!isOwner ? (
              <p className="muted" style={{ fontSize: 13 }}>
                {lang === 'pt'
                  ? 'Pedido de outro cliente. A identidade do autor permanece privada para quem vota.'
                  : 'Another customer’s request. The author’s identity stays private to voters.'}
              </p>
            ) : null}
            {canVote ? (
              <button className="btn btn-primary" type="button" onClick={vote}>
                {t('vote')}
              </button>
            ) : data.voted ? (
              <span className="pill pill-green">{t('voted')}</span>
            ) : null}
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>
              {lang === 'pt' ? 'Esclarecimentos e comentários' : 'Clarifications & comments'}
            </h3>
            <div className="stack">
              {data.comments?.map((c) => (
                <div key={c.id} style={{ borderBottom: '1px solid var(--borda-padrao)', paddingBottom: 10 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {c.author_name} · {c.kind}
                  </div>
                  <div style={{ fontSize: 14 }}>{c.body}</div>
                </div>
              ))}
            </div>
            {isOwner ? (
              <div style={{ marginTop: 14 }}>
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder={lang === 'pt' ? 'Escrever resposta…' : 'Write a reply…'}
                  style={{
                    width: '100%',
                    minHeight: 70,
                    borderRadius: 8,
                    border: '1px solid var(--borda-forte)',
                    padding: 10,
                  }}
                />
                <button className="btn btn-primary" type="button" onClick={sendReply} style={{ marginTop: 8 }}>
                  {t('reply')}
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <h3 style={{ marginTop: 0 }}>{t('followUp')}</h3>
            <p>{data.follow_up || '—'}</p>
            <p className="muted" style={{ fontSize: 13 }}>
              {data.updated_relative}
            </p>
          </div>
          {data.user_story ? (
            <div className="card">
              <h3 style={{ marginTop: 0 }}>{t('userStory')}</h3>
              <p style={{ fontSize: 14 }}>
                {lang === 'pt' ? 'Como' : 'As a'} {data.user_story.as_a},{' '}
                {lang === 'pt' ? 'quero' : 'I want'} {data.user_story.i_want},{' '}
                {lang === 'pt' ? 'para' : 'so that'} {data.user_story.so_that}.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
