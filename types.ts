
import type React from 'react';

export type StepId = 
  | 'data-assembly'
  | 'pocket-detection'
  | 'generative-design'
  | 'rapid-triage'
  | 'docking-rescoring'
  | 'md-simulation'
  | 'admet-prediction'
  | 'active-learning'
  | 'synthesis-planning'
  | 'final-report';

export interface PipelineStep {
  id: StepId;
  name: string;
  description: string;
  Icon: React.ElementType;
}

export type StepResult = {
    type: 'json' | 'text' | 'image_and_text';
    data: any;
    explanation?: string;
};
