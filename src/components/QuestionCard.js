import React from 'react';
import { TOPIC_COLORS } from './MasteryBadges';

const QuestionCard = ({
  currentQuestion,
  selectedOption,
  isCorrectAnswer,
  isWaitingNext,
  onAnswer,
  onNext
}) => {
  if (!currentQuestion) {
    return (
      <div className="question-card">
        <div className="loading-state">
          <div className="loading-spinner" />
          <p>Loading optimal BKT question...</p>
        </div>
      </div>
    );
  }

  const topicColor = TOPIC_COLORS[currentQuestion.topic] || '#2563eb';

  return (
    <div className="question-card">
      {/* Meta info */}
      <div className="question-meta">
        <span
          className="question-topic-tag"
          style={{
            background: `${topicColor}12`,
            color: topicColor,
          }}
        >
          {currentQuestion.topic}
        </span>
        <span className="question-level-tag">
          <span className="question-level-dot" style={{ background: topicColor }} />
          Level: {currentQuestion.level}
        </span>
      </div>

      {/* Question text */}
      <h3 className="question-text">{currentQuestion.content}</h3>

      {/* Options */}
      <div className="options-list">
        {currentQuestion.options.map((opt, i) => {
          const isSelected = selectedOption === opt;
          const isActualAnswer = opt.startsWith(currentQuestion.answer.charAt(0));

          let className = 'option-btn';
          if (isWaitingNext) {
            if (isSelected) {
              className += isCorrectAnswer ? ' correct-selected' : ' wrong-selected';
            } else if (isActualAnswer) {
              className += ' correct-hint';
            }
          }

          return (
            <button
              key={i}
              className={className}
              onClick={() => onAnswer(opt)}
              disabled={isWaitingNext}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {/* Feedback */}
      {isWaitingNext && (
        <div className={`feedback-box ${isCorrectAnswer ? 'correct' : 'wrong'}`}>
          <h4 className={`feedback-title ${isCorrectAnswer ? 'correct' : 'wrong'}`}>
            {isCorrectAnswer ? 'Correct!' : 'Incorrect!'}
          </h4>

          {!isCorrectAnswer && (
            <p className="feedback-answer">
              The correct answer is: <strong>{currentQuestion.answer}</strong>
            </p>
          )}

          {currentQuestion.explanation && (
            <p className="feedback-explanation">
              Explanation: {currentQuestion.explanation}
            </p>
          )}

          <button
            className="next-btn"
            onClick={onNext}
            style={{ background: topicColor }}
          >
            Next Question
          </button>
        </div>
      )}
    </div>
  );
};

export default QuestionCard;
