import React from 'react';

const AppHeader = ({ userEmail, onLogout }) => {
  return (
    <header className="app-header">
      <div className="header-left">
        <div className="header-logo">NY</div>
        <div>
          <h2 className="header-title">Navigate Yourself</h2>
          <span className="header-email">{userEmail}</span>
        </div>
      </div>
      <button className="logout-btn" onClick={onLogout}>
        Sign Out
      </button>
    </header>
  );
};

export default AppHeader;
