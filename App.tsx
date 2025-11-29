import React, { useState, useCallback } from 'react';
import { Header } from './components/Header';
import { PipelineStepper } from './components/PipelineStepper';
import { StepCard } from './components/StepCard';
import { PIPELINE_STEPS } from './constants';
import type { PipelineStep, StepResult, StepId } from './types';
import {
  analyzeDataAssembly,
  detectPocket,
  generateCandidates,
  triageCandidates,
  runDocking,
  runMDSimulation,
  predictADMET,
  suggestNextSteps,
  planSynthesis,
  generateFinalReport,
} from './services/geminiService';

const App: React.FC = () => {
  const [activeStep, setActiveStep] = useState<StepId>('data-assembly');
  const [moleculeSmiles, setMoleculeSmiles] = useState<string>('CCO'); // Default example
  const [receptorPdbId, setReceptorPdbId] = useState<string>('4HER'); // Default example
  const [results, setResults] = useState<Record<StepId, StepResult | null>>({
    'data-assembly': null,
    'pocket-detection': null,
    'generative-design': null,
    'rapid-triage': null,
    'docking-rescoring': null,
    'md-simulation': null,
    'admet-prediction': null,
    'active-learning': null,
    'synthesis-planning': null,
    'final-report': null,
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleStepClick = (id: StepId) => {
    setActiveStep(id);
    setError(null);
  };

  const handleStepExecution = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const getTopTriageCandidate = (): string | null => {
        const triageResult = results['rapid-triage'];
        if (triageResult?.type === 'json' && triageResult.data.triage_results && Array.isArray(triageResult.data.triage_results) && triageResult.data.triage_results.length > 0) {
          // Sort by pIC50 descending to find the best candidate
          const sortedCandidates = [...triageResult.data.triage_results].sort((a: any, b: any) => b.pIC50 - a.pIC50);
          return sortedCandidates[0].smiles;
        }
        return null;
      };

    try {
      let response: StepResult | undefined;
      const currentStepIndex = PIPELINE_STEPS.findIndex(step => step.id === activeStep);

      switch (activeStep) {
        case 'data-assembly':
          response = await analyzeDataAssembly(moleculeSmiles);
          break;
        case 'pocket-detection':
          response = await detectPocket(moleculeSmiles);
          break;
        case 'generative-design':
          response = await generateCandidates(moleculeSmiles);
          break;
        case 'rapid-triage':
          const generatedSmilesResult = results['generative-design'];
          if (generatedSmilesResult?.type === 'json' && generatedSmilesResult.data.generated_smiles) {
            response = await triageCandidates(generatedSmilesResult.data.generated_smiles);
          } else {
            throw new Error('Generated molecules not found. Please complete the "Generative Design" step first.');
          }
          break;
        case 'docking-rescoring':
           const triageResult = results['rapid-triage'];
           if (triageResult?.type === 'json' && triageResult.data.triage_results && Array.isArray(triageResult.data.triage_results) && triageResult.data.triage_results.length > 0) {
             const topSmiles = [...triageResult.data.triage_results]
                .sort((a: any, b: any) => b.pIC50 - a.pIC50)
                .slice(0, 3)
                .map((item: any) => item.smiles);
             response = await runDocking(topSmiles, receptorPdbId);
           } else {
             throw new Error('Triage results not found. Please complete the "Rapid Triage" step first.');
           }
          break;
        case 'md-simulation': {
           const topMolecule = getTopTriageCandidate();
           if (topMolecule) {
             response = await runMDSimulation(topMolecule);
           } else {
             throw new Error('Triage results not found. Please complete the "Rapid Triage" step first.');
           }
          break;
        }
        case 'admet-prediction': {
           const topMolecule = getTopTriageCandidate();
            if (topMolecule) {
              response = await predictADMET(topMolecule);
            } else {
              throw new Error('Triage results not found. Please complete the "Rapid Triage" step first.');
            }
          break;
        }
        case 'active-learning': {
           const topMolecule = getTopTriageCandidate();
           if (topMolecule) {
             response = await suggestNextSteps(topMolecule);
           } else {
             throw new Error('Triage results not found. Please complete the "Rapid Triage" step first.');
           }
          break;
        }
        case 'synthesis-planning': {
           const topMolecule = getTopTriageCandidate();
           if (topMolecule) {
             response = await planSynthesis(topMolecule);
           } else {
             throw new Error('Triage results not found. Please complete the "Rapid Triage" step first.');
           }
          break;
        }
        case 'final-report': {
            const finalCandidateSmiles = getTopTriageCandidate();
            if (finalCandidateSmiles) {
              response = await generateFinalReport(moleculeSmiles, finalCandidateSmiles, results);
            } else {
              throw new Error('Triage results not found. Please complete the "Rapid Triage" step first.');
            }
          break;
        }
      }

      if (response) {
        setResults(prev => ({ ...prev, [activeStep]: response }));
        if (currentStepIndex < PIPELINE_STEPS.length - 1) {
          setActiveStep(PIPELINE_STEPS[currentStepIndex + 1].id);
        }
      }
    } catch (e: any) {
      setError(e.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, [activeStep, moleculeSmiles, results, receptorPdbId]);

  const currentStepInfo: PipelineStep | undefined = PIPELINE_STEPS.find(step => step.id === activeStep);

  return (
    <div className="min-h-screen bg-base-100 text-content-100 font-sans">
      <Header />
      <main className="container mx-auto p-4 md:p-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <aside className="lg:w-1/3 xl:w-1/4">
            <PipelineStepper 
              steps={PIPELINE_STEPS} 
              activeStepId={activeStep} 
              completedSteps={Object.keys(results).filter(k => results[k as StepId] !== null) as StepId[]}
              onStepClick={handleStepClick}
            />
          </aside>
          <div className="flex-1">
            {currentStepInfo && (
              <StepCard
                step={currentStepInfo}
                onExecute={handleStepExecution}
                result={results[activeStep]}
                isLoading={isLoading}
                error={error}
                isSmilesInputVisible={activeStep === 'data-assembly'}
                smilesValue={moleculeSmiles}
                onSmilesChange={(e) => setMoleculeSmiles(e.target.value)}
                isReceptorInputVisible={activeStep === 'docking-rescoring'}
                receptorValue={receptorPdbId}
                onReceptorChange={(e) => setReceptorPdbId(e.target.value)}
                isCompleted={results[activeStep] !== null}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;