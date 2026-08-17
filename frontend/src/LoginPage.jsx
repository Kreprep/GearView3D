import { useState } from 'react'
import { checkEmailExists } from './lib/api'
import { usePageTitle } from './hooks/usePageTitle'
import './LoginPage.css'

const RESET_RECIPIENTS = [
  'eclmaniego@mymail.mapua.edu.ph',
  'jigggacay@mymail.mapua.edu.ph',
  'bedocampo@mymail.mapua.edu.ph',
]

function buildResetMailto(email) {
  const subject = 'GearView3D password reset request'
  const body = [
    'Hello,',
    '',
    `Please reset the password for my GearView3D account${email ? ` (${email})` : ''}.`,
    '',
    'Thank you.',
  ].join('\n')

  const params = new URLSearchParams({ subject, body })
  return `mailto:${RESET_RECIPIENTS.join(',')}?${params.toString()}`
}

function LoginPage({ onLogin, onSignup, loginError, setLoginError }) {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isCheckingReset, setIsCheckingReset] = useState(false)
  const [showEmailNotFound, setShowEmailNotFound] = useState(false)

  const isSignup = mode === 'signup'
  usePageTitle(isSignup ? 'Create Account' : 'Sign In')

  const switchMode = (nextMode) => {
    setMode(nextMode)
    setError('')
    setLoginError('')
    setPassword('')
    setConfirmPassword('')
  }

  const handleForgotPassword = async () => {
    setError('')
    setLoginError('')

    if (!email) {
      setError('Enter your email first')
      return
    }

    setIsCheckingReset(true)
    try {
      const { exists } = await checkEmailExists(email)
      if (exists) {
        window.location.href = buildResetMailto(email)
      } else {
        setShowEmailNotFound(true)
      }
    } catch (err) {
      setLoginError(err.message || 'Unable to check that email right now')
    } finally {
      setIsCheckingReset(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoginError('')

    if (!email || !password) {
      setError('Please fill in all fields')
      return
    }
    if (isSignup && password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (isSignup && password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setIsLoading(true)
    try {
      if (isSignup) {
        await onSignup({ email, password })
      } else {
        await onLogin({ email, password })
      }
    } catch (err) {
      setLoginError(err.message || (isSignup ? 'Unable to create account' : 'Unable to sign in'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-content">
          <h1>Welcome to GearView 3D</h1>
          <p className="login-subtitle">
            {isSignup ? 'Create an account to start your learning journey' : 'Sign in to continue your learning journey'}
          </p>

          <div className="auth-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={!isSignup}
              className={!isSignup ? 'active' : ''}
              onClick={() => switchMode('login')}
            >
              Sign In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isSignup}
              className={isSignup ? 'active' : ''}
              onClick={() => switchMode('signup')}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {error && <div className="error-message">{error}</div>}
            {loginError && <div className="error-message">{loginError}</div>}

            <div className="form-group">
              <label htmlFor="email">Email</label>
              <div className="input-wrapper">
                <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M3 8l9 6 9-6M3 8v10a2 2 0 002 2h14a2 2 0 002-2V8M3 8l9 6 9-6" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <input
                  id="email"
                  type="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="input-wrapper">
                <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M3 16l2.26 2.26A9.75 9.75 0 0 0 12 21a9 9 0 0 0 9-9M9 12a3 3 0 1 1 6 0 3 3 0 0 1-6 0" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="12" cy="12" r="3" strokeWidth="2" />
                  </svg>
                </button>
              </div>
            </div>

            {isSignup && (
              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm password</label>
                <div className="input-wrapper">
                  <svg className="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M3 16l2.26 2.26A9.75 9.75 0 0 0 12 21a9 9 0 0 0 9-9M9 12a3 3 0 1 1 6 0 3 3 0 0 1-6 0" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>
            )}

            <div className="form-options">
              {isSignup ? (
                <span className="password-hint">At least 8 characters</span>
              ) : (
                <div className="checkbox-wrapper">
                  <input
                    id="remember"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <label htmlFor="remember">Remember me</label>
                </div>
              )}
              {!isSignup && (
                <button
                  type="button"
                  className="forgot-password-link"
                  onClick={handleForgotPassword}
                  disabled={isCheckingReset}
                >
                  {isCheckingReset ? 'Checking...' : 'Forgot password?'}
                </button>
              )}
            </div>

            <button type="submit" className="login-button" disabled={isLoading}>
              {isLoading ? (isSignup ? 'Creating account...' : 'Signing in...') : isSignup ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <div className="signup-section">
            {isSignup ? (
              <p>
                Already have an account?{' '}
                <button type="button" className="link-button" onClick={() => switchMode('login')}>
                  Sign in
                </button>
              </p>
            ) : (
              <p>
                New here?{' '}
                <button type="button" className="link-button" onClick={() => switchMode('signup')}>
                  Create an account
                </button>
              </p>
            )}
          </div>
        </div>
      </div>

      {showEmailNotFound && (
        <div
          className="email-not-found-modal-backdrop"
          role="presentation"
          onClick={() => setShowEmailNotFound(false)}
        >
          <div
            className="email-not-found-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="email-not-found-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <strong id="email-not-found-modal-title">We couldn't find that account</strong>
            <p>No GearView3D account is registered under "{email}". Double-check the email address and try again.</p>
            <button type="button" className="email-not-found-modal-dismiss" onClick={() => setShowEmailNotFound(false)}>
              Okay
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default LoginPage
