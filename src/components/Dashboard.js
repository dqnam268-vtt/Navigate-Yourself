import React from 'react';

const Dashboard = ({ masteryData }) => {
  return (
    <div className="dashboard-container">
      <h2>Knowledge Mastery Dashboard</h2>
      <div className="stats-grid">
        {Object.entries(masteryData).map(([topic, probability]) => (
          <div key={topic} className="skill-card">
            <div className="skill-info">
              <span className="skill-name">{topic}</span>
              <span className="skill-percentage">
                {(probability * 100).toFixed(1)}%
              </span>
            </div>
            <div className="progress-bar-container">
              <div 
                className="progress-bar-fill" 
                style={{ 
                  width: `${probability * 100}%`,
                  backgroundColor: probability > 0.8 ? '#4caf50' : '#2196f3' 
                }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;