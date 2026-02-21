import { questionBank } from '../data/questionBank';

/**
 * AdaptiveQuestionSelector
 * Lọc câu hỏi thông minh dựa trên xác suất BKT P(L)
 */
export const getAdaptiveQuestion = (topic, currentMastery, seenIds = []) => {
  // 1. Xác định mức độ mục tiêu dựa trên P(L) hiện tại
  let targetLevel;
  if (currentMastery < 0.4) {
    targetLevel = "Remembering";
  } else if (currentMastery < 0.7) {
    targetLevel = "Understanding";
  } else if (currentMastery < 0.9) {
    targetLevel = "Applying";
  } else {
    targetLevel = "Analyzing";
  }

  // 2. Lọc danh sách câu hỏi theo chủ đề và mức độ, loại bỏ câu đã làm
  let pool = questionBank.filter(q => 
    q.topic === topic && 
    q.level === targetLevel && 
    !seenIds.includes(q.id)
  );

  // 3. Nếu mức độ hiện tại hết câu hỏi, lấy ở mức độ lân cận
  if (pool.length === 0) {
    pool = questionBank.filter(q => 
      q.topic === topic && 
      !seenIds.includes(q.id)
    );
  }

  // 4. Chọn ngẫu nhiên một câu hỏi từ danh sách đã lọc
  if (pool.length === 0) return null; // Đã hết câu hỏi cho chủ đề này
  
  const randomIndex = Math.floor(Math.random() * pool.length);
  return pool[randomIndex];
};