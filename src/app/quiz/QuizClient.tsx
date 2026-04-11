'use client';

import { useState } from 'react';
import Link from 'next/link';
import quizContent from '@/content/quiz.json';

type DimensionKey = 'fatigue' | 'stress' | 'memory' | 'focus';
type DimensionScores = Record<DimensionKey, number>;
type QuizAnswers = Record<string, string>;

const DIMENSION_ORDER: DimensionKey[] = ['fatigue', 'stress', 'memory', 'focus'];
const MAX_SCORE_PER_DIMENSION = 15; // 5 questions × max 3 pts each
const BORDER_OPACITY_HEX = '33'; // ~20 % opacity suffix for hex colours

const DIMENSION_STYLES: Record<DimensionKey, { color: string; light: string; label: string }> = {
  fatigue: { color: 'var(--color-dim-fatigue)', light: 'var(--color-dim-fatigue-light)', label: 'FATIGUE' },
  stress:  { color: 'var(--color-dim-stress)',  light: 'var(--color-dim-stress-light)',  label: 'STRESS'  },
  memory:  { color: 'var(--color-dim-memory)',  light: 'var(--color-dim-memory-light)',  label: 'MEMORY'  },
  focus:   { color: 'var(--color-dim-focus)',   light: 'var(--color-dim-focus-light)',   label: 'FOCUS'   },
};

function calculateScores(answers: QuizAnswers): DimensionScores {
  const scores: DimensionScores = { fatigue: 0, stress: 0, memory: 0, focus: 0 };
  for (const question of quizContent.questions) {
    const selectedValue = answers[question.id];
    if (!selectedValue) continue;
    const option = question.options.find((o) => o.value === selectedValue);
    if (!option) continue;
    for (const dim of DIMENSION_ORDER) {
      scores[dim] += (option.scores as DimensionScores)[dim] ?? 0;
    }
  }
  return scores;
}

function topDimension(scores: DimensionScores): DimensionKey {
  return DIMENSION_ORDER.reduce((best, dim) => (scores[dim] > scores[best] ? dim : best), DIMENSION_ORDER[0]);
}

export default function QuizClient() {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswers>({});
  const [showResult, setShowResult] = useState(false);

  const questions = quizContent.questions;
  const totalQuestions = questions.length;
  const progress = ((currentQuestion + 1) / totalQuestions) * 100;

  const handleAnswer = (questionId: string, value: string) => {
    const newAnswers = { ...answers, [questionId]: value };
    setAnswers(newAnswers);
    if (currentQuestion < totalQuestions - 1) {
      setTimeout(() => setCurrentQuestion(currentQuestion + 1), 300);
    } else {
      setTimeout(() => setShowResult(true), 300);
    }
  };

  const handleBack = () => {
    if (currentQuestion > 0) setCurrentQuestion(currentQuestion - 1);
  };

  const handleRestart = () => {
    setCurrentQuestion(0);
    setAnswers({});
    setShowResult(false);
  };

  if (showResult) {
    const scores = calculateScores(answers);
    const topDim = topDimension(scores);
    const result = quizContent.results[topDim];
    const topStyle = DIMENSION_STYLES[topDim];

    return (
      <main id="main-content" className="bg-white min-h-screen">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">

          {/* Header */}
          <div className="text-center mb-10">
            <div
              className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6"
              style={{ backgroundColor: topStyle.light }}
              aria-hidden="true"
            >
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ color: topStyle.color }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-semibold uppercase tracking-widest mb-2" style={{ color: topStyle.color }}>
              Your Cognitive Profile
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">{result.title}</h1>
            <p className="text-gray-600 text-lg leading-relaxed max-w-2xl mx-auto">{result.description}</p>
          </div>

          {/* Dimension Score Bars */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 mb-8">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Your 4 Scoring Dimensions</h2>
            <p className="text-xs text-gray-500 mb-6">Based on your answers — higher scores indicate areas that need more support.</p>
            <div className="space-y-5">
              {DIMENSION_ORDER.map((dim) => {
                const style = DIMENSION_STYLES[dim];
                const pct = Math.round((scores[dim] / MAX_SCORE_PER_DIMENSION) * 100);
                const dimInfo = quizContent.dimensions[dim];
                const isTop = dim === topDim;
                return (
                  <div key={dim}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold tracking-wider" style={{ color: style.color }}>
                          {style.label}
                        </span>
                        {isTop && (
                          <span
                            className="text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: style.light, color: style.color }}
                          >
                            Primary
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-gray-700">{pct}%</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{dimInfo.description}</p>
                    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${pct}%`, backgroundColor: style.color }}
                        role="progressbar"
                        aria-label={`${style.label} score: ${pct}%`}
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top dimension tips */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              Your personalised plan for{' '}
              <span style={{ color: topStyle.color }}>{topStyle.label.charAt(0) + topStyle.label.slice(1).toLowerCase()}</span>
            </h2>
            <p className="text-xs text-gray-500 mb-5">Evidence-based strategies targeting your highest-scoring dimension.</p>
            <ul className="space-y-4">
              {result.tips.map((tip, index) => (
                <li key={index} className="flex items-start space-x-3">
                  <span
                    className="inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-xs font-bold flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: topStyle.color }}
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                  <span className="text-gray-600 text-sm leading-relaxed">{tip}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-center text-gray-500 text-xs mb-6">
            If your symptoms are severe or persistent, please consult a healthcare professional for personalised advice.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={result.ctaLink}
              className="w-full sm:w-auto px-8 py-4 text-white font-semibold rounded-xl transition-all duration-300 text-center"
              style={{ backgroundColor: topStyle.color }}
            >
              {result.ctaText}
            </Link>
            <button
              onClick={handleRestart}
              className="w-full sm:w-auto px-8 py-4 border text-sm font-medium rounded-xl transition-all duration-300 text-center"
              style={{ borderColor: topStyle.color + BORDER_OPACITY_HEX, color: topStyle.color }}
            >
              Retake Quiz
            </button>
          </div>
        </div>
      </main>
    );
  }

  const question = questions[currentQuestion];

  return (
    <main id="main-content" className="bg-white min-h-screen flex items-center justify-center">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 w-full">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{quizContent.title}</h1>
          <p className="text-gray-500">{quizContent.subtitle}</p>
        </div>

        {/* Dimension pills */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {DIMENSION_ORDER.map((dim) => {
            const s = DIMENSION_STYLES[dim];
            return (
              <span
                key={dim}
                className="text-xs font-bold tracking-widest px-3 py-1 rounded-full"
                style={{ backgroundColor: s.light, color: s.color }}
              >
                {s.label}
              </span>
            );
          })}
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-gray-500 mb-2" aria-hidden="true">
            <span>Question {currentQuestion + 1} of {totalQuestions}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-primary rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-label={`Quiz progress: question ${currentQuestion + 1} of ${totalQuestions}`}
              aria-valuenow={Math.round(progress)}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>

        {/* Question */}
        <div className="mb-8">
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-6">{question.question}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="group" aria-labelledby="quiz-question">
            {question.options.map((option) => {
              const isSelected = answers[question.id] === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => handleAnswer(question.id, option.value)}
                  aria-pressed={isSelected}
                  className={`p-4 sm:p-5 rounded-xl border text-left transition-all duration-200 ${
                    isSelected
                      ? 'bg-brand-primary-light border-brand-primary text-gray-900'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-brand-primary/30 hover:bg-brand-primary-light'
                  }`}
                >
                  <p className="font-medium text-sm sm:text-base">{option.label}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <button
            onClick={handleBack}
            disabled={currentQuestion === 0}
            className="px-6 py-2.5 text-gray-500 hover:text-gray-900 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium"
            aria-label="Go to previous question"
          >
            ← Back
          </button>
          <Link
            href="/"
            className="px-6 py-2.5 text-gray-500 hover:text-gray-700 transition-colors text-sm"
          >
            Exit Quiz
          </Link>
        </div>
      </div>
    </main>
  );
}

