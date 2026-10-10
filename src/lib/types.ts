export const PASS_MARK = 80;

export type DashboardLevel = {
  level_number: number;
  title: string;
  description: string | null;
  is_unlocked: boolean;
  mcq_best_score: number | null;
  cq_best_score: number | null;
  mcq_passed: boolean;
  cq_passed: boolean;
};

export type McqQuestion = {
  id: string;
  question: string;
  options: { label: string; text: string }[];
};

export type McqResult = {
  score: number;
  correct: number;
  total: number;
  passed: boolean;
  correct_options: Record<string, string>;
};

export type CqQuestion = { id: string; question: string };

export type CqReviewItem = {
  id: string;
  question: string;
  student_answer: string;
  model_answer: string;
};

// Static class names so Tailwind keeps them.
export const TINT_BG: Record<number, string> = {
  1: 'bg-tint-1', 2: 'bg-tint-2', 3: 'bg-tint-3', 4: 'bg-tint-4',
};
export const TINT_TEXT: Record<number, string> = {
  1: 'text-steel-900', 2: 'text-white', 3: 'text-white', 4: 'text-white',
};
