import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TOPIC_COLORS } from './MasteryBadges';

const MasteryChart = ({ chartData, topics }) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="chart-section">
      <div
        className={`section-header ${!isOpen ? 'collapsed' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <h3 className="section-title">Knowledge Mastery Chart</h3>
        <button className="section-toggle" onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}>
          {isOpen ? 'Collapse' : 'Expand'}
        </button>
      </div>

      {isOpen && (
        <div className="chart-container">
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="step"
                tick={{ fontSize: 12, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 12, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 10px 15px -3px rgba(0,0,0,0.06)',
                  fontSize: '13px',
                  fontFamily: 'Inter, sans-serif'
                }}
              />
              <Legend
                iconType="circle"
                wrapperStyle={{ fontSize: '12px', paddingTop: '15px', fontFamily: 'Inter, sans-serif' }}
              />
              {topics.map(topic => (
                <Line
                  key={topic}
                  type="monotone"
                  dataKey={topic}
                  stroke={TOPIC_COLORS[topic] || '#2563eb'}
                  strokeWidth={2.5}
                  connectNulls
                  activeDot={{ r: 6 }}
                  dot={{ r: 3, strokeWidth: 2 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default MasteryChart;
