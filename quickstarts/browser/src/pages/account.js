import {
  CredentialConstants,
  describeUserAgent,
  evaluateChangePasswordForm,
  getMeSessions,
  mapCredentialUpdateError,
  resolveChangeCredentialPolicy,
  revokeMeSession,
  revokeMeSessions,
  supportsCredential,
  updateMeCredentials,
} from '@thunderid/browser'
import { createFetcher, escapeHtml, fetchProfileFormContext, renderProfileFields, attachProfileFieldHandlers } from '../components/profileFields.js'

const ICON_HOME = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12l9-9 9 9"/><path d="M5 10v10h14V10"/></svg>`
const ICON_PERSON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`
const ICON_SHIELD = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`
const ICON_EYE = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
const ICON_CHECK = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
const ICON_X = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
const ICON_CHEVRON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>`

const TABS = [
  { id: 'home', label: 'Home', icon: ICON_HOME },
  { id: 'personal', label: 'Personal info', icon: ICON_PERSON },
  { id: 'security', label: 'Login and Security', icon: ICON_SHIELD },
]

const TILES = [
  { id: 'personal', icon: ICON_PERSON, tone: 'blue', title: 'Personal info', description: 'Name, email, phone, and profile photo' },
  { id: 'security', icon: ICON_SHIELD, tone: 'green', title: 'Login and Security', description: 'Credentials and active sessions' },
]

// Mirrors the React/Vue quickstarts' Security tab: one credential per row.
const CREDENTIALS = [
  {
    attribute: CredentialConstants.PASSWORD,
    title: 'Password',
    description: 'Used to sign in to your account.',
    cta: 'Change password',
    submitLabel: 'Update Password',
  },
]

function renderHomeTab(user) {
  const givenName = user?.given_name || user?.givenName || user?.name || user?.username || 'there'

  const tiles = TILES.map(
    (tile) => `
      <button type="button" class="account-tile" data-tab="${tile.id}">
        <span class="account-tile-icon account-tile-icon--${tile.tone}">${tile.icon}</span>
        <span class="account-tile-title">${escapeHtml(tile.title)}</span>
        <span class="account-tile-desc">${escapeHtml(tile.description)}</span>
      </button>`,
  ).join('')

  return `
    <h2 class="account-content-title">Hi, ${escapeHtml(givenName)}</h2>
    <p class="account-content-subtitle">Manage your info and security across ThunderID apps.</p>
    <div class="account-tiles">${tiles}</div>`
}

function renderCredentialCard(credential, { schema, openAttribute }) {
  const isOpen = openAttribute === credential.attribute

  return `
    <div class="account-security-card">
      <div class="account-security-card-row">
        <div>
          <div class="account-security-card-title">${escapeHtml(credential.title)}</div>
          <div class="account-security-card-desc">${escapeHtml(credential.description)}</div>
        </div>
        <button type="button" class="account-security-card-cta" aria-expanded="${isOpen}" data-cred-toggle="${credential.attribute}">
          ${escapeHtml(credential.cta)}
          <span class="account-security-card-chevron${isOpen ? ' account-security-card-chevron--open' : ''}">${ICON_CHEVRON}</span>
        </button>
      </div>
      ${isOpen ? renderCredentialForm(credential, schema) : ''}
    </div>`
}

// The form fields, always rendered so the "unavailable" state has something to sit behind
// (blurred, disabled) rather than showing nothing at all — matches
// `BaseChangeCredential`'s unavailable rendering in the React/Vue SDKs.
function renderCredentialFields(credential) {
  const nameLower = credential.title.toLowerCase()
  const newFieldId = `cred-${credential.attribute}-new`
  const confirmFieldId = `cred-${credential.attribute}-confirm`

  return `
    <div class="cred-field">
      <label class="cred-label" for="${newFieldId}">New ${escapeHtml(credential.title)}</label>
      <div class="cred-input-wrap">
        <input id="${newFieldId}" type="password" class="cred-input" data-cred-field="newValue" placeholder="Enter your new ${escapeHtml(nameLower)}" autocomplete="new-password" />
        <button type="button" class="cred-eye-btn" data-cred-toggle-visibility aria-label="Show password">${ICON_EYE}</button>
      </div>
    </div>
    <div class="cred-requirements" data-cred-requirements hidden>
      <p class="cred-requirements-heading">Your ${escapeHtml(nameLower)} must have:</p>
      <ul class="cred-requirements-list" data-cred-requirements-list></ul>
    </div>
    <div class="cred-field">
      <label class="cred-label" for="${confirmFieldId}">Confirm New ${escapeHtml(credential.title)}</label>
      <div class="cred-input-wrap">
        <input id="${confirmFieldId}" type="password" class="cred-input" data-cred-field="confirmValue" placeholder="Re-enter your new ${escapeHtml(nameLower)}" autocomplete="new-password" />
        <button type="button" class="cred-eye-btn" data-cred-toggle-visibility aria-label="Show password">${ICON_EYE}</button>
      </div>
    </div>
    <div class="account-security-card-error" data-cred-error hidden></div>
    <div class="account-security-card-success" data-cred-success hidden>Your ${escapeHtml(nameLower)} has been updated.</div>
    <div class="cred-form-actions">
      <button type="button" class="btn-primary" data-cred-submit disabled>${escapeHtml(credential.submitLabel)}</button>
    </div>`
}

function renderCredentialForm(credential, schema) {
  const unavailable = !supportsCredential(schema, credential.attribute)
  const fields = renderCredentialFields(credential)

  const body = unavailable
    ? `
      <div class="cred-unavailable">
        <div class="cred-unavailable-content" inert>${fields}</div>
        <div class="cred-unavailable-overlay" role="status">
          <strong>${escapeHtml(credential.title)} changes unavailable</strong>
          <div>Please contact your administrator.</div>
        </div>
      </div>`
    : `<div data-cred-form="${credential.attribute}">${fields}</div>`

  return `<div class="account-security-card-form">${body}</div>`
}

// The session waiting for its revoke to be confirmed is its id, or this for revoking every other one.
const ALL_OTHERS = 'all-others'

// Names a session the way the React/Vue `ActiveSessions` component does: "Chrome on macOS". A mobile
// SDK's session names no browser, so the application stands in for it and the device for the
// operating system: "Quickstart on Redmi Note 8 Pro".
function describeSession(session) {
  const { browser, device, os } = describeUserAgent(session.userAgent)
  const client = browser ?? session.participants[0]?.appName
  const place = device ?? os

  if (client && place) return `${client} on ${place}`
  return client ?? place ?? 'Unknown device'
}

function formatDateTime(value) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function renderSessionConfirm(message, busy) {
  return `
    <div class="account-session-confirm" role="group" aria-label="${escapeHtml(message)}">
      <p class="account-security-card-desc">${escapeHtml(message)}</p>
      <div class="account-session-confirm-actions">
        <button type="button" class="account-session-btn" data-session-cancel>Cancel</button>
        <button type="button" class="account-session-btn account-session-btn--danger" data-session-confirm ${busy ? 'disabled' : ''}>Revoke</button>
      </div>
    </div>`
}

function renderSession(session, { confirming, busy }) {
  const name = describeSession(session)
  const ip = session.lastActiveIp ?? session.creationIp ?? 'Unknown'
  const apps = session.participants.map((participant) => participant.appName ?? participant.appId).join(', ') || 'Unknown'
  const revoke = session.isCurrent
    ? ''
    : `<button type="button" class="account-security-card-cta" data-session-revoke="${escapeHtml(session.id)}" ${busy ? 'disabled' : ''}>Revoke</button>`

  return `
    <li class="account-session">
      <div class="account-security-card-row">
        <div>
          <div class="account-security-card-title">
            ${escapeHtml(name)}
            ${session.isCurrent ? '<span class="account-session-current">This device</span>' : ''}
          </div>
          <div class="account-security-card-desc">IP address ${escapeHtml(ip)} · Last active ${escapeHtml(formatDateTime(session.lastActiveAt))}</div>
          <div class="account-security-card-desc">Applications: ${escapeHtml(apps)}</div>
        </div>
        ${revoke}
      </div>
      ${confirming === session.id ? renderSessionConfirm(`Revoke the session on ${name}?`, busy) : ''}
    </li>`
}

// Mirrors the React/Vue `ActiveSessions` component: the signed-in user's live SSO sessions, current
// one first, each other one revocable, and all of them at once.
function renderSessionsCard({ page, loading, loadError, revokeError, confirming, busy }) {
  const sessions = [...(page?.sessions ?? [])].sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent))
  const total = page?.totalResults ?? sessions.length
  // The current session may be on another page, and the server keeps it when revoking the rest.
  const canRevokeOthers =
    sessions.some((session) => !session.isCurrent) &&
    (sessions.some((session) => session.isCurrent) || total > sessions.length)

  let summary = ''
  if (total > 1) summary = `${total} active sessions · revoke any you don’t recognize`
  else if (sessions[0]?.isCurrent) summary = 'This is your only active session'

  let error = ''
  if (revokeError) error = 'An error occurred while revoking the session. Please try again.'
  else if (loadError) error = 'An error occurred while loading your sessions. Please try again.'

  let body = ''
  if (loading && sessions.length === 0) body = '<p class="account-security-card-desc">Loading sessions…</p>'
  else if (sessions.length === 0 && !error) body = '<p class="account-security-card-desc">No active sessions.</p>'
  else if (sessions.length > 0) {
    body = `<ul class="account-sessions-list">${sessions.map((session) => renderSession(session, { confirming, busy })).join('')}</ul>`
  }

  return `
    <div class="account-security-card">
      <div class="account-security-card-row">
        <div>
          <div class="account-security-card-title">Active sessions</div>
          <div class="account-security-card-desc">${escapeHtml(summary)}</div>
        </div>
        ${canRevokeOthers ? `<button type="button" class="account-security-card-cta" data-session-revoke="${ALL_OTHERS}" ${busy ? 'disabled' : ''}>Revoke all others</button>` : ''}
      </div>
      ${confirming === ALL_OTHERS ? renderSessionConfirm('Revoke all other sessions? You’ll stay signed in here.', busy) : ''}
      ${error ? `<div class="account-security-card-error account-sessions-error">${escapeHtml(error)}</div>` : ''}
      ${body}
    </div>`
}

function renderSecurityTab({ schema, openAttribute }) {
  const cards = CREDENTIALS.map((credential) => renderCredentialCard(credential, { schema, openAttribute })).join('')

  return `
    <h2 class="account-content-title">Login and Security</h2>
    <p class="account-content-subtitle">Manage your credentials and active sessions.</p>
    <div class="account-security-list">${cards}<div data-sessions></div></div>`
}

function renderPersonalTab(user, { schema, profile }) {
  return `
    <h2 class="account-content-title">Personal info</h2>
    <p class="account-content-subtitle">Manage the basic profile info others may see.</p>
    <div class="account-box">${renderProfileFields(user, { schema, profile })}</div>`
}

function renderAccountPage({ tab, user, schema, profile, openAttribute }) {
  const nav = TABS.map(
    (t) => `
      <button type="button" class="account-nav-item${tab === t.id ? ' account-nav-item--active' : ''}" data-tab="${t.id}">
        ${t.icon}
        ${escapeHtml(t.label)}
      </button>`,
  ).join('')

  let content
  if (tab === 'personal') {
    content = renderPersonalTab(user, { schema, profile })
  } else if (tab === 'security') {
    content = renderSecurityTab({ schema, openAttribute })
  } else {
    content = renderHomeTab(user)
  }

  return `
    <div class="account-page">
      <aside class="account-sidebar">
        <h1 class="account-sidebar-title">Account</h1>
        <nav class="account-nav">${nav}</nav>
      </aside>
      <main class="account-content">
        <div class="account-content-inner" id="account-content-inner">${content}</div>
      </main>
    </div>`
}

function attachCredentialForm(formEl, { attribute, schema, baseUrl, auth, onDone }) {
  const policy = resolveChangeCredentialPolicy(schema, attribute)
  const newInput = formEl.querySelector('[data-cred-field="newValue"]')
  const confirmInput = formEl.querySelector('[data-cred-field="confirmValue"]')
  const reqBox = formEl.querySelector('[data-cred-requirements]')
  const reqList = formEl.querySelector('[data-cred-requirements-list]')
  const submitBtn = formEl.querySelector('[data-cred-submit]')
  const errorBox = formEl.querySelector('[data-cred-error]')
  const successBox = formEl.querySelector('[data-cred-success]')

  const evaluate = () => {
    const { ruleResults, isValid } = evaluateChangePasswordForm(
      { newPassword: newInput.value, confirmPassword: confirmInput.value },
      policy,
    )

    if (ruleResults.length > 0) {
      reqBox.hidden = false
      reqList.innerHTML = ruleResults
        .map(
          (result) =>
            `<li class="${result.passed ? 'passed' : ''}">${result.passed ? ICON_CHECK : ICON_X} Matches the required format</li>`,
        )
        .join('')
    } else {
      reqBox.hidden = true
    }

    submitBtn.disabled = !isValid
  }

  newInput.addEventListener('input', evaluate)
  confirmInput.addEventListener('input', evaluate)

  formEl.querySelectorAll('[data-cred-toggle-visibility]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = btn.previousElementSibling
      input.type = input.type === 'password' ? 'text' : 'password'
    })
  })

  submitBtn.addEventListener('click', async () => {
    errorBox.hidden = true
    successBox.hidden = true
    submitBtn.disabled = true

    try {
      const fetcher = createFetcher(auth)
      await updateMeCredentials({ baseUrl, payload: { [attribute]: newInput.value }, fetcher })

      successBox.hidden = false
      newInput.value = ''
      confirmInput.value = ''
      evaluate()
      onDone?.()
    } catch (err) {
      const { message } = mapCredentialUpdateError(err)
      errorBox.hidden = false
      errorBox.textContent = message || 'An error occurred while updating your credential. Please try again.'
      submitBtn.disabled = false
    }
  })
}

// Self-mounting Account page: fetches the schema/profile once, then owns its own tab and
// per-credential open/closed state, re-rendering just its own container on every change
// rather than the whole app shell.
export async function mountAccountPage(container, { user, auth, initialTab = 'home', onUserUpdated }) {
  const baseUrl = import.meta.env.VITE_THUNDERID_BASE_URL

  let tab = initialTab
  let openAttribute = null
  let currentUser = user

  const { schema, profile } = await fetchProfileFormContext({ baseUrl, auth })

  // The sessions card re-renders on its own, so loading or revoking a session never wipes a
  // half-typed credential form next to it.
  const sessions = { page: null, loading: false, loadError: false, revokeError: false, confirming: null, busy: false }

  const renderSessions = () => {
    const sessionsEl = container.querySelector('[data-sessions]')
    if (!sessionsEl) return

    sessionsEl.innerHTML = renderSessionsCard(sessions)

    sessionsEl.querySelectorAll('[data-session-revoke]').forEach((btn) => {
      btn.addEventListener('click', () => {
        sessions.confirming = btn.dataset.sessionRevoke
        renderSessions()
        sessionsEl.querySelector('[data-session-cancel]')?.focus()
      })
    })
    sessionsEl.querySelector('[data-session-cancel]')?.addEventListener('click', () => {
      sessions.confirming = null
      renderSessions()
    })
    sessionsEl.querySelector('[data-session-confirm]')?.addEventListener('click', () => revokeSessions(sessions.confirming))
  }

  const loadSessions = async () => {
    sessions.loading = true
    renderSessions()

    try {
      sessions.page = await getMeSessions({ baseUrl, fetcher: createFetcher(auth) })
      sessions.loadError = false
    } catch {
      sessions.loadError = true
    }

    sessions.loading = false
    renderSessions()
  }

  const revokeSessions = async (target) => {
    sessions.confirming = null
    sessions.busy = true
    sessions.revokeError = false
    renderSessions()

    try {
      const fetcher = createFetcher(auth)
      if (target === ALL_OTHERS) await revokeMeSessions({ baseUrl, exceptCurrent: true, fetcher })
      else await revokeMeSession({ baseUrl, sessionId: target, fetcher })
    } catch (err) {
      // A 404 means the session is already gone, revoked elsewhere or expired, so the reload is enough.
      sessions.revokeError = err?.statusCode !== 404
    }

    sessions.busy = false
    await loadSessions()
  }

  const render = () => {
    container.innerHTML = renderAccountPage({ tab, user: currentUser, schema, profile, openAttribute })
    attachHandlers()
    renderSessions()
  }

  const attachHandlers = () => {
    container.querySelectorAll('[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        tab = btn.dataset.tab
        openAttribute = null
        sessions.confirming = null
        render()
        if (tab === 'security') loadSessions()
      })
    })

    if (tab === 'personal') {
      attachProfileFieldHandlers({
        user: currentUser,
        auth,
        schema,
        profile,
        onSaved: (updatedUser) => {
          currentUser = updatedUser
          onUserUpdated?.(updatedUser)
        },
      })
    }

    if (tab === 'security') {
      // The same button opens and closes the form: clicking it while its own credential is
      // already open collapses it, same as clicking the chevron.
      container.querySelectorAll('[data-cred-toggle]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const attribute = btn.dataset.credToggle
          openAttribute = openAttribute === attribute ? null : attribute
          render()
        })
      })

      const formEl = container.querySelector('[data-cred-form]')
      if (formEl) {
        attachCredentialForm(formEl, {
          attribute: formEl.dataset.credForm,
          schema,
          baseUrl,
          auth,
          onDone: () => {
            openAttribute = null
            render()
          },
        })
      }
    }
  }

  render()
  if (tab === 'security') loadSessions()
}
