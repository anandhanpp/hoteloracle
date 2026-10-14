import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock, User, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [username, setUsername]     = useState('');
  const [password, setPassword]     = useState('');
  const [showPass,  setShowPass]    = useState(false);
  const [error,     setError]       = useState('');
  const [loading,   setLoading]     = useState(false);

  const { login, isAuthenticated } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const from      = (location.state as { from?: string })?.from ?? '/';

  // If already logged in, skip login page
  useEffect(() => {
    if (isAuthenticated) navigate(from, { replace: true });
  }, [isAuthenticated, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username.trim(), password);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel: branding ─────────────────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #0a1628 0%, #0d2347 40%, #0f3460 70%, #1a4a7a 100%)',
        }}
      >
        {/* Decorative blobs */}
        <div
          style={{
            position: 'absolute', top: '-80px', right: '-80px',
            width: '320px', height: '320px', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(59,130,246,0.25) 0%, transparent 70%)',
          }}
        />
        <div
          style={{
            position: 'absolute', bottom: '-60px', left: '-60px',
            width: '280px', height: '280px', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99,102,241,0.20) 0%, transparent 70%)',
          }}
        />

        {/* Logo */}
        <div className="relative z-10 flex items-center space-x-3">
          <div
            style={{
              width: '44px', height: '44px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 15px rgba(59,130,246,0.4)',
            }}
          >
            {/* Oracle-style diamond logo mark */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L22 12L12 22L2 12L12 2Z" fill="white" opacity="0.9"/>
              <path d="M12 6L18 12L12 18L6 12L12 6Z" fill="rgba(59,130,246,0.6)"/>
            </svg>
          </div>
          <div>
            <div style={{ color: 'white', fontWeight: 700, fontSize: '16px', letterSpacing: '0.01em' }}>
              Oracle Hospitality
            </div>
            <div style={{ color: 'rgba(148,163,184,1)', fontSize: '12px', letterSpacing: '0.05em' }}>
              OPERA Cloud PMS
            </div>
          </div>
        </div>

        {/* Center content */}
        <div className="relative z-10 space-y-6">
          <h1
            style={{
              color: 'white', fontSize: '42px', fontWeight: 800,
              lineHeight: 1.15, letterSpacing: '-0.02em',
            }}
          >
            Hospitality<br />
            <span style={{ color: '#60a5fa' }}>Management</span><br />
            Suite
          </h1>
          <p style={{ color: 'rgba(148,163,184,0.9)', fontSize: '16px', lineHeight: 1.7, maxWidth: '380px' }}>
            Complete front-desk and property management in one powerful, enterprise-grade platform.
          </p>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 pt-2">
            {['Front Desk', 'Housekeeping', 'Billing & Folio', 'Reservations', 'Reports'].map(f => (
              <span
                key={f}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 500,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'rgba(203,213,225,0.9)',
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#60a5fa', display: 'inline-block' }} />
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10">
          <p style={{ color: 'rgba(100,116,139,0.8)', fontSize: '12px' }}>
            © 2026 Oracle Corporation. All rights reserved.
          </p>
        </div>
      </div>

      {/* ── Right panel: login form ───────────────────────────────────────────── */}
      <div
        className="flex-1 flex items-center justify-center p-6"
        style={{ background: '#f8fafc' }}
      >
        <div style={{ width: '100%', maxWidth: '420px' }}>

          {/* Mobile logo (hidden on large screens) */}
          <div className="lg:hidden flex items-center space-x-3 mb-10">
            <div
              style={{
                width: '40px', height: '40px', borderRadius: '10px',
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L22 12L12 22L2 12L12 2Z" fill="white" opacity="0.9"/>
                <path d="M12 6L18 12L12 18L6 12L12 6Z" fill="rgba(59,130,246,0.6)"/>
              </svg>
            </div>
            <div>
              <div style={{ color: '#0f172a', fontWeight: 700, fontSize: '15px' }}>Oracle Hospitality</div>
              <div style={{ color: '#64748b', fontSize: '11px' }}>OPERA Cloud PMS</div>
            </div>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 style={{ color: '#0f172a', fontWeight: 800, fontSize: '28px', letterSpacing: '-0.02em', marginBottom: '6px' }}>
              Sign in
            </h2>
            <p style={{ color: '#64748b', fontSize: '14px' }}>
              Enter your credentials to access the property management system.
            </p>
          </div>

          {/* Error banner */}
          {error && (
            <div
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px',
                padding: '12px 16px', borderRadius: '10px', marginBottom: '20px',
                background: '#fff1f2', border: '1px solid #fecdd3',
              }}
            >
              <AlertCircle style={{ color: '#e11d48', width: '18px', height: '18px', flexShrink: 0, marginTop: '1px' }} />
              <p style={{ color: '#9f1239', fontSize: '14px', margin: 0 }}>{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Username */}
            <div>
              <label
                htmlFor="login-username"
                style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#374151' }}
              >
                Username
              </label>
              <div style={{ position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                    color: '#94a3b8', display: 'flex', alignItems: 'center', pointerEvents: 'none',
                  }}
                >
                  <User style={{ width: '16px', height: '16px' }} />
                </span>
                <input
                  id="login-username"
                  type="text"
                  required
                  autoComplete="username"
                  autoFocus
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="e.g. admin"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '11px 14px 11px 42px',
                    fontSize: '14px', borderRadius: '10px',
                    border: '1.5px solid #e2e8f0',
                    background: 'white', color: '#0f172a',
                    outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.12)';
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="login-password"
                style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: '#374151' }}
              >
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                    color: '#94a3b8', display: 'flex', alignItems: 'center', pointerEvents: 'none',
                  }}
                >
                  <Lock style={{ width: '16px', height: '16px' }} />
                </span>
                <input
                  id="login-password"
                  type={showPass ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '11px 44px 11px 42px',
                    fontSize: '14px', borderRadius: '10px',
                    border: '1.5px solid #e2e8f0',
                    background: 'white', color: '#0f172a',
                    outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.12)';
                  }}
                  onBlur={e => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
                <button
                  type="button"
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPass(v => !v)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#94a3b8', display: 'flex', alignItems: 'center', padding: '2px',
                  }}
                >
                  {showPass
                    ? <EyeOff style={{ width: '16px', height: '16px' }} />
                    : <Eye    style={{ width: '16px', height: '16px' }} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '12px 24px',
                borderRadius: '10px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px', fontWeight: 700, letterSpacing: '0.01em',
                background: loading
                  ? '#93c5fd'
                  : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: 'white', marginTop: '4px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                boxShadow: loading ? 'none' : '0 4px 14px rgba(37,99,235,0.35)',
                transition: 'opacity 0.15s, transform 0.1s, box-shadow 0.15s',
              }}
              onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.opacity = '0.92'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
            >
              {loading && <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />}
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          {/* Hint */}
          <div
            style={{
              marginTop: '28px', padding: '14px 16px', borderRadius: '10px',
              background: '#f0f9ff', border: '1px solid #bae6fd',
            }}
          >
            <p style={{ fontSize: '12px', color: '#0369a1', margin: 0, lineHeight: 1.6 }}>
              <strong>Demo credentials:</strong><br />
              Username: <code style={{ background: '#e0f2fe', padding: '1px 5px', borderRadius: '4px' }}>admin</code> &nbsp;|&nbsp;
              Password: <code style={{ background: '#e0f2fe', padding: '1px 5px', borderRadius: '4px' }}>password123</code>
            </p>
          </div>

          {/* Version tag */}
          <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '12px', color: '#94a3b8' }}>
            Oracle Hospitality OPERA PMS v22.4
          </p>
        </div>
      </div>

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
