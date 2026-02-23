import React from 'react';

const TeacherPanel = ({
  allStudents,
  viewingStudent,
  userEmail,
  onSelectStudent,
  onDeleteStudent,
  onDeleteAll
}) => {
  return (
    <div className="teacher-panel">
      <div className="teacher-panel-header">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        Teacher Mode: Student Progress
      </div>

      <select
        className="teacher-select"
        value={viewingStudent}
        onChange={(e) => onSelectStudent(e.target.value)}
      >
        {allStudents.map(email => (
          <option key={email} value={email}>
            {email === userEmail ? `${email} (Me)` : email}
          </option>
        ))}
      </select>

      <div className="teacher-actions">
        <button
          className="btn-danger soft"
          onClick={onDeleteStudent}
          disabled={!viewingStudent}
        >
          Delete This Student
        </button>
        <button
          className="btn-danger hard"
          onClick={onDeleteAll}
        >
          Delete ALL Data
        </button>
      </div>
    </div>
  );
};

export default TeacherPanel;
