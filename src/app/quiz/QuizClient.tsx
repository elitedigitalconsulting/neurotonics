'use client';

import { useState } from 'react';
import Link from 'next/link';
import quizContent from '@/content/quiz.json';

type QuizAnswers = Record<string, string>;

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
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const handleRestart = () => {
    setCurrentQuestion(0);
    setAnswers({});
    setShowResult(false);
  };

  const resultKey = (answers.primary_concern || 'stress') as keyof typeof quizContent.results;
  const result = quizContent.results[resultKey] || quizContent.results.stress;

  if (showResult) {
    return (
      <main id="main-content" className="bg-white min-h-screen flex items-center justify-center">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-brand-primary mb-6" aria-hidden="true">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">{result.title}</h1>
            <p className="text-gray-600 text-lg leading-relaxed max-w-2xl mx-auto">{result.description}</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Here are our top tips for you:</h2>
            <ul className="space-y-4">
              {result.tips.map((tip, index) => (
                <li key={index} className="flex items-start space-x-3">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand-primary-light text-brand-primary text-xs font-bold flex-shrink-0 mt-0.5" aria-hidden="true">
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
              className="w-full sm:w-auto px-8 py-4 bg-brand-primary hover:bg-brand-primary-dark text-white font-semibold rounded-xl transition-all duration-300 text-center"
            >
              {result.ctaText}
            </Link>
            <button
              onClick={handleRestart}
              className="w-full sm:w-auto px-8 py-4 border border-brand-primary/20 text-brand-primary hover:bg-brand-primary-light font-medium rounded-xl transition-all duration-300 text-center"
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
