import { useState } from 'react'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { usePageTitle } from './hooks/usePageTitle'
import { useT } from './i18n'
import LanguageToggle from './components/LanguageToggle'
import { Button } from './components/ui/button'
import { Input } from './components/ui/input'
import { PageState } from './components/ui/pageState'

const RESET_RECIPIENTS = [
  'eclmaniego@mymail.mapua.edu.ph',
  'jigggacay@mymail.mapua.edu.ph',
  'bedocampo@mymail.mapua.edu.ph',
]

// The mailto draft is text a learner reads and sends, so it is translated. The
// recipient addresses are not copy and stay as they are.
function buildResetMailto(email, t) {
  const params = new URLSearchParams({
    subject: t('login.reset.subject'),
    body: email ? t('login.reset.bodyWithEmail', { email }) : t('login.reset.body'),
  })

  return `mailto:${RESET_RECIPIENTS.join(',')}?${params.toString()}`
}

// The first screen anyone sees, and the only place the language switch can do
// its job before a trainee has read anything - which is why it sits in the
// plate band here rather than only in AppHeader, which this page has neither
// room nor a session for.
function LoginPage({ onLogin, onSignup, loginError, setLoginError, sessionExpired = false }) {
  const t = useT()
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const isSignup = mode === 'signup'
  usePageTitle(isSignup ? t('login.pageTitle.signUp') : t('login.pageTitle.signIn'))

  // One region, not two. Local validation and the server's rejection used to
  // render as two stacked error boxes that could appear at the same time.
  const message = error || loginError

  const switchMode = (nextMode) => {
    setMode(nextMode)
    setError('')
    setLoginError('')
    setPassword('')
    setConfirmPassword('')
  }

  // Opens the reset-request email draft regardless of whether the address is
  // registered - checking first would mean the backend confirms or denies an
  // account's existence to anyone who asks, unauthenticated.
  const handleForgotPassword = () => {
    setError('')
    setLoginError('')

    if (!email) {
      setError(t('login.error.emailFirst'))
      return
    }

    window.location.href = buildResetMailto(email, t)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoginError('')

    if (!email || !password) {
      setError(t('login.error.allFields'))
      return
    }
    if (isSignup && password.length < 8) {
      setError(t('login.error.passwordLength'))
      return
    }
    if (isSignup && password !== confirmPassword) {
      setError(t('login.error.passwordMismatch'))
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
      setLoginError(err.message || t(isSignup ? 'login.error.signUpFailed' : 'login.error.signInFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  const tab = (tabMode, label) => {
    const active = (tabMode === 'signup') === isSignup

    return (
      <button
        type="button"
        role="tab"
        aria-selected={active}
        className={`h-11 rounded-lg text-sm font-bold transition ${
          active ? 'bg-panel text-ink shadow-sm' : 'text-muted hover:text-ink'
        }`}
        onClick={() => switchMode(tabMode)}
      >
        {label}
      </button>
    )
  }

  const fieldLabel = 'grid gap-1.5 text-[13.5px] font-bold text-body'
  const fieldIcon = 'pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted'

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-[440px] overflow-hidden rounded-2xl border border-border bg-panel shadow-sm">
        {/* The plate band: the same stamped dark ground the training hub's hero
            uses, carrying the brand and the language switch. */}
        <div className="flex items-center justify-between gap-3 bg-surface-deep px-6 py-4">
          <span className="text-lg font-extrabold tracking-tight text-white">GearView3D</span>
          <LanguageToggle tone="deep" />
        </div>

        <div className="grid gap-4 p-6">
          <p className="m-0 text-[15px] font-semibold text-ink">
            {isSignup ? t('login.subtitle.signUp') : t('login.subtitle.signIn')}
          </p>

          {/* One mode switch. The page used to carry these tabs *and* a
              "New here? Create an account" link doing the same thing. */}
          <div role="tablist" className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
            {tab('login', t('login.tab.signIn'))}
            {tab('signup', t('login.tab.signUp'))}
          </div>

          <form className="grid gap-4" onSubmit={handleSubmit}>
            {/* The expiry notice shares the region and yields to an error, so
                a failed retry never stacks two boxes. */}
            {message
              ? <PageState tone="error" span={false}>{message}</PageState>
              : sessionExpired && <PageState span={false}>{t('login.notice.sessionExpired')}</PageState>}

            <label className={fieldLabel} htmlFor="email">
              {t('login.field.email')}
              <span className="relative block">
                <Mail size={18} className={fieldIcon} aria-hidden="true" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  className="h-[52px] pl-11"
                  placeholder={t('login.field.emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </span>
            </label>

            <label className={fieldLabel} htmlFor="password">
              {t('login.field.password')}
              <span className="relative block">
                <Lock size={18} className={fieldIcon} aria-hidden="true" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  className="h-[52px] pl-11 pr-12"
                  placeholder={t('login.field.passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted transition hover:bg-slate-100 hover:text-ink"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={t(showPassword ? 'login.hidePassword' : 'login.showPassword')}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>

            {isSignup && (
              <label className={fieldLabel} htmlFor="confirmPassword">
                {t('login.field.confirmPassword')}
                <span className="relative block">
                  <Lock size={18} className={fieldIcon} aria-hidden="true" />
                  <Input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    className="h-[52px] pl-11"
                    placeholder={t('login.field.confirmPasswordPlaceholder')}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                  />
                </span>
              </label>
            )}

            <div className="flex min-h-6 items-center justify-between gap-3">
              {isSignup
                ? <span className="text-xs font-semibold text-muted">{t('login.passwordHint')}</span>
                : <span />}
              {!isSignup && (
                <button
                  type="button"
                  className="text-xs font-bold text-accent-strong underline-offset-2 hover:underline"
                  onClick={handleForgotPassword}
                >
                  {t('login.forgotPassword')}
                </button>
              )}
            </div>

            <Button type="submit" variant="deep" size="lg" className="w-full" disabled={isLoading}>
              {isLoading
                ? t(isSignup ? 'login.submit.creating' : 'login.submit.signingIn')
                : t(isSignup ? 'login.submit.signUp' : 'login.submit.signIn')}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
