import React from 'react';

const TOPIC_COLORS = {
  "Relative clause": "#2563eb",
  "Will/Be Going To": "#059669",
  "First Conditional": "#d97706",
  "Second Conditional": "#dc2626",
  "Verb Patterns": "#7c3aed"
};

const MasteryBadges = ({ mastery, topics }) => {
  return (
    <div className="mastery-grid">
      {topics.map(topic => {
        const value = (mastery[topic] * 100).toFixed(1);
        const color = TOPIC_COLORS[topic] || '#2563eb';
        return (
          <div className="mastery-badge" key={topic}>
            <div className="mastery-badge-topic">{topic}</div>
            <div className="mastery-badge-value" style={{ color }}>
              {value}%
            </div>
            <div className="mastery-badge-bar">
              <div
                className="mastery-badge-fill"
                style={{ width: `${value}%`, background: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export { TOPIC_COLORS };
export default MasteryBadges;
