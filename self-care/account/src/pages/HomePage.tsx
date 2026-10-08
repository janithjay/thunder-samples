// Copyright 2026 The ThunderID Authors
// SPDX-License-Identifier: Apache-2.0

import {SignedIn, SignedOut, SignInButton} from '@thunderid/react';
import type {ReactElement} from 'react';
import {Navigate, useOutletContext} from 'react-router';
import type {LayoutContext} from '../components/Nav';
import ThunderMark from '../components/ThunderMark';

export default function HomePage(): ReactElement {
  const {dark} = useOutletContext<LayoutContext>();

  return (
    <>
      <SignedOut>
        <div className="hero">
          <div className="hero-inner">
            <div className="hero-mark">
              <ThunderMark height={44} dark={dark} />
            </div>

            <div className="hero-badge">
              <span className="hero-badge-line" />
              <span>Account</span>
              <span className="hero-badge-line" />
            </div>

            <h1 className="hero-title">Your Account, Your Way</h1>

            <p className="hero-subtitle">
              A self-care Account page built with the ThunderID React SDK. Users can manage their own profile
              details.
            </p>

            <div className="hero-ctas">
              <SignInButton>
                {({signIn, isLoading}) => (
                  <button className="btn-primary" onClick={() => void signIn()} disabled={isLoading}>
                    {isLoading ? 'Signing in…' : 'Sign in'}
                  </button>
                )}
              </SignInButton>
            </div>
          </div>
        </div>
      </SignedOut>

      <SignedIn>
        <Navigate to="/account" replace />
      </SignedIn>
    </>
  );
}
