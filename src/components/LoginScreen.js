import React from 'react';

const LoginScreen = ({ email, setEmail, password, setPassword, onLogin, onAdminUpload }) => {
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') onLogin();
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">NY</div>
        <h2 className="login-title">Navigate Yourself</h2>
        <p className="login-subtitle">Adaptive English Learning with BKT</p>

        <input
          type="email"
          className="login-input"
          placeholder="Your email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={handleKeyPress}
          autoComplete="email"
        />
        <input
          type="password"
          className="login-input"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyPress}
          autoComplete="current-password"
        />

        <button className="login-btn" onClick={onLogin}>
          Start Learning
        </button>

        <div className="login-divider">
          <p className="login-admin-label">Teacher / Admin</p>
          <button className="login-admin-btn" onClick={onAdminUpload}>
            Upload Question Bank (500)
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;
