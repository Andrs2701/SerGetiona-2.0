'use client';

import { clsx } from 'clsx';
import { Check } from 'lucide-react';

export interface FlowStep {
  role: string;
  label: string;
  status: string;
  responsible?: string;
  completed: boolean;
  active?: boolean;
}

interface DeliverableFlowProps {
  steps: FlowStep[];
}

export default function DeliverableFlow({ steps }: DeliverableFlowProps) {
  if (!steps || steps.length === 0) return null;

  return (
    <div className="w-full">
      {/* Desktop: horizontal */}
      <div className="hidden sm:flex items-start gap-0">
        {steps.map((step, idx) => (
          <div key={step.role} className="flex items-start flex-1 min-w-0">
            <div className="flex flex-col items-center flex-1 min-w-0">
              {/* Circle */}
              <div
                className={clsx(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 border-2',
                  step.completed
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : step.active
                    ? 'bg-blue-500 border-blue-500 text-white animate-pulse'
                    : 'bg-white border-gray-300 text-gray-400'
                )}
              >
                {step.completed ? <Check size={14} /> : idx + 1}
              </div>
              {/* Labels */}
              <div className="mt-1.5 text-center px-0.5">
                <p
                  className={clsx(
                    'text-xs font-semibold leading-tight',
                    step.completed
                      ? 'text-emerald-600'
                      : step.active
                      ? 'text-blue-600'
                      : 'text-gray-400'
                  )}
                >
                  {step.label}
                </p>
                {step.responsible && (
                  <p className="text-[10px] text-gray-400 truncate mt-0.5 max-w-[72px]">
                    {step.responsible.split(' ')[0]}
                  </p>
                )}
                {step.status && (
                  <p
                    className={clsx(
                      'text-[10px] leading-tight mt-0.5',
                      step.completed
                        ? 'text-emerald-500'
                        : step.active
                        ? 'text-blue-500'
                        : 'text-gray-400'
                    )}
                  >
                    {step.status}
                  </p>
                )}
              </div>
            </div>
            {/* Arrow between steps */}
            {idx < steps.length - 1 && (
              <div className="flex items-center mt-3.5 flex-shrink-0">
                <div
                  className={clsx(
                    'w-4 h-0.5',
                    step.completed ? 'bg-emerald-400' : 'bg-gray-200'
                  )}
                />
                <div
                  className={clsx(
                    'w-0 h-0 border-y-4 border-y-transparent border-l-4',
                    step.completed ? 'border-l-emerald-400' : 'border-l-gray-200'
                  )}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Mobile: vertical */}
      <div className="flex flex-col gap-2 sm:hidden">
        {steps.map((step, idx) => (
          <div key={step.role} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div
                className={clsx(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 border-2',
                  step.completed
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : step.active
                    ? 'bg-blue-500 border-blue-500 text-white animate-pulse'
                    : 'bg-white border-gray-300 text-gray-400'
                )}
              >
                {step.completed ? <Check size={12} /> : idx + 1}
              </div>
              {idx < steps.length - 1 && (
                <div className={clsx('w-0.5 h-4 mt-0.5', step.completed ? 'bg-emerald-300' : 'bg-gray-200')} />
              )}
            </div>
            <div className="pb-1">
              <p
                className={clsx(
                  'text-xs font-semibold',
                  step.completed
                    ? 'text-emerald-600'
                    : step.active
                    ? 'text-blue-600 font-bold'
                    : 'text-gray-400'
                )}
              >
                {step.label}
              </p>
              {step.responsible && (
                <p className="text-[10px] text-gray-400">{step.responsible}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
