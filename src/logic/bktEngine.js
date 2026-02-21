export const updateBKT = (pL_prev, isCorrect) => {
  const pG = 0.3; // Xác suất đoán mò
  const pS = 0.1; // Xác suất sơ suất
  const pT = 0.1; // Xác suất học được kiến thức mới

  let pL_conditional;
  if (isCorrect) {
    pL_conditional = (pL_prev * (1 - pS)) / (pL_prev * (1 - pS) + (1 - pL_prev) * pG);
  } else {
    pL_conditional = (pL_prev * pS) / (pL_prev * pS + (1 - pL_prev) * (1 - pG));
  }

  const pL_new = pL_conditional + (1 - pL_conditional) * pT;
  // Chặn ngưỡng để biểu đồ luôn nằm trong khoảng 0-100%
  return Math.min(0.999, Math.max(0.001, pL_new));
};