import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { homeForRole, useAuth } from '../hooks/useAuth';
import { useI18n } from '../hooks/useI18n';
import { LangToggle } from '../components/StatusPill';
import { useToast } from '../hooks/useToast';

export default function Login() {
  const { t } = useI18n();
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate(homeForRole(user.role), { replace: true });
  }, [user, navigate]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await signIn(email, password);
      navigate(homeForRole(u.role));
    } catch {
      toast.show(t('error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <div style={{ position: 'absolute', top: 20, right: 20 }}>
        <LangToggle />
      </div>
      <div className="login-brand">
        <span className="brand-mark" />
        <h1>{t('appName')}</h1>
      </div>
      <p className="login-sub">{t('tagline')}</p>
      <form className="card login-card" onSubmit={onSubmit}>
        <h2>{t('login')}</h2>
        <div className="field">
          <label htmlFor="email">{t('email')}</label>
          <input
            id="email"
            type="email"
            placeholder="nome@empresa.pt"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">{t('password')}</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy} type="submit">
          {t('login')}
        </button>
        <p className="login-hint">{t('loginHint')}</p>
      </form>
    </div>
  );
}
