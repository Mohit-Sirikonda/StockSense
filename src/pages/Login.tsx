import React, { useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import { useToast } from '../context/ToastContext';

interface LoginProps {
  onSuccess: () => void;
}

export const Login: React.FC<LoginProps> = ({ onSuccess }) => {
  const { login, users } = useInventory();
  const { showToast } = useToast();

  // Reflect the live (persisted) user list so demo shortcuts stay valid
  // even after accounts are edited or removed via User Management.
  const adminAccount = users.find((u) => u.role === 'Administrator');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Forgot password flow
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [enteredOtp, setEnteredOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotStep, setForgotStep] = useState<'request' | 'otp' | 'reset' | 'completed'>('request');
  const [forgotError, setForgotError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (!email.trim() || !password.trim()) {
      const err = 'Invalid email or password.';
      setLoginError(err);
      showToast(err, 'error');
      return;
    }

    setIsSubmitting(true);
    const result = login(email, password);

    if (!result.success) {
      setIsSubmitting(false);
      const errMsg = 'Invalid email or password.';
      setLoginError(errMsg);
      showToast(errMsg, 'error');
      return;
    }

    showToast('Signed in successfully.', 'success');
    setIsSubmitting(false);
    onSuccess();
  };

  const handleStartForgot = () => {
    setForgotStep('request');
    setForgotError('');
    setForgotEmail(email.trim());
    setIsForgotOpen(true);
  };

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      setForgotError('Please enter your account email.');
      return;
    }
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);
    setForgotStep('otp');
    setForgotError('');
    showToast(`Verification code: ${code}`, 'info');
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (enteredOtp.trim() !== generatedOtp) {
      setForgotError('Invalid verification code.');
      return;
    }
    setForgotStep('reset');
    setForgotError('');
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword.trim() || newPassword.length < 6) {
      setForgotError('Password must contain at least 6 characters.');
      return;
    }
    setPassword(newPassword);
    setForgotStep('completed');
  };

  const loadPreset = (userEmail: string, userPass: string) => {
    setEmail(userEmail);
    setPassword(userPass);
    setLoginError('');
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[var(--surface)] border border-[var(--border)] rounded-md shadow-sm p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-base font-semibold text-[var(--text)]">StockSense</h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Sign in to your inventory workspace.
          </p>
        </div>

        {/* Form */}
        {!isForgotOpen ? (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {loginError && (
              <div className="p-2 bg-[var(--danger-subtle)] text-[var(--danger)] rounded border border-[var(--danger)]/20 text-xs">
                {loginError}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[var(--text-secondary)] font-medium">Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setLoginError('');
                }}
                placeholder="name@company.com"
                className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[var(--text-secondary)] font-medium">Password</label>
                <button
                  type="button"
                  onClick={handleStartForgot}
                  className="text-[11px] text-[var(--accent)] hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setLoginError('');
                }}
                placeholder="••••••••"
                className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium rounded transition-colors"
            >
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>

            {/* Quick Demo Credentials */}
            <div className="pt-4 border-t border-[var(--border-subtle)] space-y-2">
              <div className="text-[11px] text-[var(--text-secondary)]">
                Demo accounts:
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => loadPreset('manager@stocksense.demo', 'manager123')}
                  className="p-2 border border-[var(--border)] rounded hover:bg-[var(--surface-secondary)] text-left transition-colors"
                >
                  <div className="font-medium text-[var(--text)] text-[11px]">Manager</div>
                  <div className="text-[10px] text-[var(--text-secondary)]">Arjun Mehta (All)</div>
                </button>

                <button
                  type="button"
                  onClick={() => loadPreset('staff@stocksense.demo', 'staff123')}
                  className="p-2 border border-[var(--border)] rounded hover:bg-[var(--surface-secondary)] text-left transition-colors"
                >
                  <div className="font-medium text-[var(--text)] text-[11px]">Warehouse staff</div>
                  <div className="text-[10px] text-[var(--text-secondary)]">Ravi Kumar (Floor)</div>
                </button>
              </div>

              {adminAccount && (
                <button
                  type="button"
                  onClick={() => loadPreset(adminAccount.email, '')}
                  className="w-full p-2 border border-[var(--border)] rounded hover:bg-[var(--surface-secondary)] text-left transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[var(--text)] text-[11px]">Administrator</span>
                    <span className="text-[10px] text-[var(--text-secondary)]">{adminAccount.name}</span>
                  </div>
                </button>
              )}
            </div>
          </form>
        ) : (
          <div className="space-y-4 text-xs">
            {forgotStep === 'request' && (
              <form onSubmit={handleSendOtp} className="space-y-3">
                <div>
                  <div className="font-medium text-[var(--text)]">Reset password</div>
                  <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                    Enter your email to receive a simulation code.
                  </div>
                </div>

                {forgotError && (
                  <div className="text-xs text-[var(--danger)]">{forgotError}</div>
                )}

                <div className="space-y-1">
                  <label className="text-[var(--text-secondary)] font-medium">Email address</label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setIsForgotOpen(false)}
                    className="text-xs text-[var(--text-secondary)] hover:text-[var(--text)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium rounded"
                  >
                    Send code
                  </button>
                </div>
              </form>
            )}

            {forgotStep === 'otp' && (
              <form onSubmit={handleVerifyOtp} className="space-y-3">
                <div>
                  <div className="font-medium text-[var(--text)]">Enter code</div>
                  <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                    Simulation code: <span className="font-mono font-semibold text-[var(--text)]">{generatedOtp}</span>
                  </div>
                </div>

                {forgotError && (
                  <div className="text-xs text-[var(--danger)]">{forgotError}</div>
                )}

                <input
                  type="text"
                  required
                  maxLength={6}
                  value={enteredOtp}
                  onChange={(e) => setEnteredOtp(e.target.value)}
                  placeholder="6-digit code"
                  className="w-full px-2.5 py-1.5 text-center font-mono text-base tracking-widest bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                />

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setIsForgotOpen(false)}
                    className="text-xs text-[var(--text-secondary)] hover:text-[var(--text)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium rounded"
                  >
                    Verify
                  </button>
                </div>
              </form>
            )}

            {forgotStep === 'reset' && (
              <form onSubmit={handleResetPassword} className="space-y-3">
                <div>
                  <div className="font-medium text-[var(--text)]">New password</div>
                  <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                    Choose a new password for your account.
                  </div>
                </div>

                {forgotError && (
                  <div className="text-xs text-[var(--danger)]">{forgotError}</div>
                )}

                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full px-2.5 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                />

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setIsForgotOpen(false)}
                    className="text-xs text-[var(--text-secondary)] hover:text-[var(--text)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-medium rounded"
                  >
                    Save password
                  </button>
                </div>
              </form>
            )}

            {forgotStep === 'completed' && (
              <div className="space-y-3 text-center py-2">
                <div className="text-xs text-[var(--success)] font-medium">
                  Password updated successfully.
                </div>
                <button
                  type="button"
                  onClick={() => setIsForgotOpen(false)}
                  className="w-full py-1.5 bg-[var(--accent)] text-white text-xs font-medium rounded"
                >
                  Return to sign in
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
