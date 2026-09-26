import React, { useState } from 'react';
import { Boxes, ArrowRight, Sun, Moon, ShieldCheck, Warehouse } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { DEMO_USERS } from '../data/users';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useInventory } from '../context/InventoryContext';
export const Login: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const { login, signup, requestReset, completeReset, authError, resetSavedAccount } = useAuth();
  const { locations } = useInventory();
  const { showToast } = useToast();
  const { theme, toggleTheme, themeError } = useTheme();
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [error, setError] = useState('');
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [name, setName] = useState(''),
    [role, setRole] = useState('Warehouse Staff');
  const [warehouseId, setWarehouseId] = useState('loc-prod');
  const [code, setCode] = useState(''),
    [demoCode, setDemoCode] = useState('');
  const [expiresAt, setExpiresAt] = useState(0),
    [resetEmail, setResetEmail] = useState('');
  const [busy, setBusy] = useState(false),
    [resetOpen, setResetOpen] = useState(false);
  function switchMode(next: typeof mode) {
    setMode(next);
    setError('');
    setPassword('');
    setDemoCode('');
    setCode('');
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (mode === 'reset') {
        if (!demoCode) {
          const result = await requestReset(email);
          if (!result.success) {
            setError(result.error);
            return;
          }
          setDemoCode(result.data.code);
          setExpiresAt(result.data.expiresAt);
          setResetEmail(email);
        } else {
          const result = await completeReset(resetEmail, code, password);
          if (!result.success) {
            setError(result.error);
            return;
          }
          showToast('Demo password changed. Sign in with the new password.', 'success');
          switchMode('login');
        }
        return;
      }
      const result =
        mode === 'signup'
          ? await signup({ name, email, password, role, warehouseId })
          : await login(email, password);
      if (!result.success) {
        setError(result.error);
        return;
      }
      showToast(
        mode === 'signup'
          ? 'Demo account created. Workspace ready.'
          : 'Signed in. Your operations workspace is ready.',
        'success',
      );
      onSuccess();
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-shell">
      <section className="login-story">
        <div className="brand">
          <span className="brand-mark">
            <Boxes size={22} />
          </span>
          <span>
            StockSense<small>INVENTORY OPERATIONS</small>
          </span>
        </div>
        <div className="login-story-main">
          <div className="eyebrow">
            <span className="status-dot" /> THE OPERATIONS WORKSPACE
          </div>
          <h1>
            Every location.
            <br />
            Every movement.
            <br />
            <span>Accounted for.</span>
          </h1>
          <p>A clear view of what you hold, where it lives, and where it needs to go.</p>
          <div className="warehouse-illustration" aria-hidden="true">
            <div className="rack-label">
              FACILITY / 01 <span>STOCK IN CONTROL</span>
            </div>
            <div className="warehouse-racks">
              {[0, 1, 2].map((rack) => (
                <div className="rack" key={rack}>
                  {[0, 1, 2].map((shelf) => (
                    <div className="shelf" key={shelf}>
                      {[0, 1, 2].map((box) => (
                        <div className={'crate crate-' + ((rack + shelf + box) % 3)} key={box}>
                          <span />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="rack-floor">
              <span>RECEIVE</span>
              <span>STORE</span>
              <span>DISPATCH →</span>
            </div>
          </div>
        </div>
        <div className="login-story-footer">
          <Warehouse size={14} />
          <span>Built for the people who keep things moving.</span>
          <span className="font-mono ml-auto">SS / 01</span>
        </div>
      </section>
      <section className="login-form-side">
        <div className="login-topline">
          <span className="eyebrow">WORKSPACE ACCESS</span>
          <button
            className="icon-button"
            onClick={toggleTheme}
            aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
        <div className="login-form-content">
          <span className="section-index">
            01 /{' '}
            {mode === 'login' ? 'SIGN IN' : mode === 'signup' ? 'CREATE DEMO ACCOUNT' : 'ACCOUNT RECOVERY'}
          </span>
          <h2>
            {mode === 'login'
              ? 'Welcome to operations.'
              : mode === 'signup'
                ? 'Join the workspace.'
                : 'Reset demo password.'}
          </h2>
          <p className="text-[var(--text-secondary)] mb-7">
            {mode === 'login'
              ? 'Sign in to your inventory workspace.'
              : 'Local demonstration only. Do not reuse a real password.'}
          </p>
          {(error || authError || themeError) && (
            <div className="notice error mb-4" role="alert">
              {error || authError || themeError}
              {authError && (
                <button className="mt-2 underline block" onClick={() => setResetOpen(true)}>
                  Reset saved sign-in and profile data
                </button>
              )}
            </div>
          )}
          <form onSubmit={submit} className="space-y-5">
            {mode === 'signup' && (
              <>
                <label className="field-label">
                  Full name
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                  />
                </label>
                <label className="field-label">
                  Demo role
                  <select value={role} onChange={(e) => setRole(e.target.value)}>
                    <option>Warehouse Staff</option>
                    <option>Inventory Manager</option>
                  </select>
                </label>
                {role === 'Warehouse Staff' && (
                  <label className="field-label">
                    Assigned warehouse
                    <select required value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                      <option value="">Select a warehouse</option>
                      {locations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <p className="notice">
                  Role selection grants access only in this browser demo. It is not a verified company
                  account.
                </p>
              </>
            )}
            <label className="field-label">
              Email address
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                readOnly={mode === 'reset' && !!demoCode}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                placeholder="name@company.com"
              />
            </label>
            {mode === 'reset' && demoCode && (
              <>
                <div className="notice" role="status">
                  Demo inbox:{' '}
                  <strong data-testid="demo-otp" className="font-mono">
                    {demoCode}
                  </strong>
                  <br />
                  Expires at {new Date(expiresAt).toLocaleTimeString()}. No email or SMS was sent. The code is
                  single-use with five attempts.
                </div>
                <label className="field-label">
                  One-time code
                  <input
                    required
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                </label>
              </>
            )}
            {(mode !== 'reset' || demoCode) && (
              <label className="field-label">
                {mode === 'reset' ? 'New demo password' : 'Password'}
                <input
                  type="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                  minLength={mode === 'login' ? undefined : 8}
                  maxLength={128}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="Enter your password"
                />
              </label>
            )}
            <button className="primary-button w-full justify-between" type="submit" disabled={busy}>
              {busy
                ? 'Processing...'
                : mode === 'signup'
                  ? 'Create demo account'
                  : mode === 'reset'
                    ? demoCode
                      ? 'Change demo password'
                      : 'Generate demo OTP'
                    : 'Open workspace'}{' '}
              <ArrowRight size={16} />
            </button>
          </form>
          <div className="flex flex-wrap gap-4 mt-4">
            {mode === 'login' ? (
              <>
                <button className="text-link" disabled={busy} onClick={() => switchMode('signup')}>
                  Sign up
                </button>
                <button className="text-link" disabled={busy} onClick={() => switchMode('reset')}>
                  Need account access?
                </button>
              </>
            ) : (
              <button className="text-link" disabled={busy} onClick={() => switchMode('login')}>
                Back to sign in
              </button>
            )}
            {mode === 'reset' && demoCode && (
              <button
                className="text-link"
                disabled={busy}
                onClick={() => {
                  setDemoCode('');
                  setCode('');
                  setError('');
                }}
              >
                Request another code
              </button>
            )}
          </div>
          {mode === 'reset' && (
            <p className="notice mt-3">
              OTP delivery is simulated in the demo inbox on this page. Successful verification changes the
              stored demo password. Anyone with this browser can access this simulation.
            </p>
          )}
          {mode === 'login' && (
            <>
              <div className="demo-accounts">
                <div className="eyebrow">
                  EXPLORE THE DEMO <span>SELECT A ROLE</span>
                </div>
                {DEMO_USERS.map((user) => (
                  <button
                    key={user.id}
                    disabled={busy}
                    onClick={() => {
                      setEmail(user.email);
                      setPassword(user.password);
                      setError('');
                    }}
                    className="demo-account"
                  >
                    <span className="avatar">{user.name.charAt(0)}</span>
                    <span>
                      <strong>{user.role}</strong>
                      <small>
                        {user.name} · {user.role === 'Warehouse Staff' ? user.warehouse : 'All facilities'}
                      </small>
                    </span>
                    <ArrowRight size={14} />
                  </button>
                ))}
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-2">
                Presets fill the original demo passwords. After a reset, enter your new password.
              </p>
            </>
          )}
          <p className="login-disclosure">
            <ShieldCheck size={14} />
            Demo data is saved in this browser. No shared server account.
          </p>
        </div>
        <div className="login-bottomline">StockSense / Inventory control, with clarity.</div>
      </section>
      <ConfirmDialog
        isOpen={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Reset saved account data?"
        message="This removes local accounts, password changes, reset codes, sign-in and contact details. Inventory is preserved. Original bundled demo passwords will work again."
        confirmLabel="Reset account data"
        variant="danger"
        onConfirm={() => {
          const result = resetSavedAccount();
          if (result.success) {
            setResetOpen(false);
            setError('');
          } else setError(result.error);
        }}
      />
    </main>
  );
};
