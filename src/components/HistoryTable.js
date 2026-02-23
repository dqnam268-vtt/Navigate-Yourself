import React from 'react';
import { TOPIC_COLORS } from './MasteryBadges';

const HistoryTable = ({ interactionLogs, onExportExcel }) => {
  return (
    <div className="history-section">
      <div className="section-header">
        <h3 className="section-title">Interaction History</h3>
        <button className="export-btn" onClick={onExportExcel}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7,10 12,15 17,10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export Excel
        </button>
      </div>

      <div className="history-scroll">
        <table className="history-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Topic</th>
              <th>Result</th>
              <th>P(L) After</th>
            </tr>
          </thead>
          <tbody>
            {interactionLogs.map((log, i) => {
              const color = TOPIC_COLORS[log.topic] || '#2563eb';
              return (
                <tr key={log.id}>
                  <td>#{interactionLogs.length - i}</td>
                  <td>
                    <span
                      className="topic-chip"
                      style={{ background: `${color}12`, color }}
                    >
                      {log.topic}
                    </span>
                  </td>
                  <td>
                    <span className={`result-chip ${log.isCorrect ? 'correct' : 'wrong'}`}>
                      {log.isCorrect ? 'CORRECT' : 'WRONG'}
                    </span>
                  </td>
                  <td className="mastery-value">
                    {(log.pL_after * 100).toFixed(1)}%
                  </td>
                </tr>
              );
            })}
            {interactionLogs.length === 0 && (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center', padding: '40px 10px', color: '#94a3b8' }}>
                  No interactions yet. Start answering questions!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HistoryTable;
