// Copyright 2026 The ThunderID Authors
// SPDX-License-Identifier: Apache-2.0

import {Loading, SignedIn, SignedOut, SignInButton, UserDropdown, useTheme} from '@thunderid/react';
import {useState, type ReactElement} from 'react';
import {Link, Outlet, useNavigate} from 'react-router';
import {MoonIcon, SunIcon} from './icons';
import ReactLogo from './icons/ReactLogo';

export interface LayoutContext {
  dark: boolean;
}

export default function Nav(): ReactElement {
  const [dark, setDark] = useState<boolean>(false);
  const navigate = useNavigate();
  const {toggleTheme} = useTheme();

  const toggleDark = (): void => {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : '');
    toggleTheme();
  };

  return (
    <div className="app" data-theme={dark ? 'dark' : undefined}>
      <nav className="nav">
        <Link to="/" className="nav-logo">
          <ReactLogo size={24} />
          <span className="wordmark-name">Account</span>
        </Link>
        <div className="nav-actions">
          <button
            className="dark-toggle"
            onClick={toggleDark}
            aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {dark ? <SunIcon /> : <MoonIcon />}
          </button>
          <SignedIn>
            <UserDropdown
              showTriggerLabel
              manageProfileLabel="Account"
              onManageProfile={() => void navigate('/account')}
            />
          </SignedIn>
          <SignedOut>
            <SignInButton>
              {({signIn, isLoading}) => (
                <button className="btn-primary" onClick={() => void signIn()} disabled={isLoading}>
                  {isLoading ? 'Signing in…' : 'Sign in'}
                </button>
              )}
            </SignInButton>
          </SignedOut>
        </div>
      </nav>

      <Loading>
        <div className="loading-screen">Loading…</div>
      </Loading>

      <Outlet context={{dark} satisfies LayoutContext} />
    </div>
  );
}
