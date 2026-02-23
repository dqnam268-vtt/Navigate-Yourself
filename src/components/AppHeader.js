import React from 'react';

const AppHeader = ({ userEmail, onLogout }) => {
  return (
    <header className="app-header">
      <div className="header-left">
        <div className="header-logo">NY</div>
        <div>
          <h2 className="header-title">Navigate-Yourself BKT</h2>
          <span className="header-email">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
            {userEmail}
          </span>
        </div>
      </div>
      <button className="logout-btn" onClick={onLogout}>
        Sign Out
      </button>
    </header>
  );
};

export default AppHeader;
