"use client";

/**
 * /onboarding/[step] — paso del wizard de onboarding (1-7).
 *
 * Client Component: el estado del wizard se carga via GET /api/onboarding/state
 * al montar cada paso. Cada Siguiente hace POST /api/onboarding/step.
 * El paso 7 hace POST /api/onboarding/complete y redirige al dashboard.
 *
 * Source of truth: siempre el servidor. Los campos del form se inicializan
 * desde la respuesta de GET /state para que el usuario pueda volver y editar.
 */

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { WizardShell } from "@/components/onboarding/WizardShell";
import { WizardSkeleton } from "@/components/onboarding/WizardSkeleton";
import { Step1Distribuidor, validateStep1 } from "@/components/onboarding/Step1Distribuidor";
import { Step2Contacto, validateStep2 } from "@/components/onboarding/Step2Contacto";
import { Step3Branding, validateStep3 } from "@/components/onboarding/Step3Branding";
import { Step4Credenciales, validateStep4 } from "@/components/onboarding/Step4Credenciales";
import { Step5Cartera, validateStep5 } from "@/components/onboarding/Step5Cartera";
import { Step6Vendedores, validateStep6 } from "@/components/onboarding/Step6Vendedores";
import { Step7Confirmacion, validateStep7 } from "@/components/onboarding/Step7Confirmacion";
import { toast } from "@/components/toast/useToast";
import {
  getOnboardingState,
  postOnboardingStep,
  postOnboardingComplete,
  OnboardingApiError,
} from "@/lib/onboardingApi";
import type { OnboardingData } from "@/lib/onboardingApi";

const TOTAL_STEPS = 7;

type StepErrors = Partial<Record<keyof OnboardingData, string>>;

type ValidateFn = (data: Partial<OnboardingData>) => StepErrors;

const VALIDATORS: Record<number, ValidateFn> = {
  1: validateStep1,
  2: validateStep2,
  3: validateStep3,
  4: validateStep4,
  5: validateStep5,
  6: validateStep6,
  7: validateStep7,
};

export default function OnboardingStepPage({
  params,
}: {
  params: Promise<{ step: string }>;
}) {
  const resolvedParams = use(params);
  const stepNum = Math.max(1, Math.min(7, parseInt(resolvedParams.step, 10) || 1));

  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<OnboardingData>>({});
  const [errors, setErrors] = useState<StepErrors>({});
  const [maxReached, setMaxReached] = useState(stepNum);

  // Load state from server on mount / step change
  const loadState = useCallback(async () => {
    setLoading(true);
    setErrors({});
    try {
      const state = await getOnboardingState();

      // If already complete, go to dashboard
      if (state.is_complete) {
        router.replace("/dashboard");
        return;
      }

      setFormData(state.data ?? {});
      setMaxReached(Math.max(state.step, stepNum));
    } catch (e) {
      if (e instanceof OnboardingApiError && e.status === 401) {
        router.replace("/login");
        return;
      }
      toast.error("No pudimos cargar tu progreso. Intenta recargar la página.");
    } finally {
      setLoading(false);
    }
  }, [stepNum, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadState();
  }, [loadState]);

  function handleChange(patch: Partial<OnboardingData>) {
    setFormData((prev) => ({ ...prev, ...patch }));
    // Clear errors for changed keys
    const patchKeys = Object.keys(patch) as (keyof OnboardingData)[];
    setErrors((prev) => {
      const next = { ...prev };
      for (const k of patchKeys) delete next[k];
      return next;
    });
  }

  async function handleNext() {
    // Validate
    const validate = VALIDATORS[stepNum];
    const errs = validate ? validate(formData) : {};
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setSaving(true);
    try {
      if (stepNum === TOTAL_STEPS) {
        // Final step — POST /complete
        const completeRes = await postOnboardingComplete();
        toast.success("Bienvenido al cotizador.", { title: "Cuenta activada" });
        const destination = completeRes.dashboard_url
          ? new URL(completeRes.dashboard_url).pathname
          : "/dashboard";
        router.push(destination);
      } else {
        // Save step and advance
        await postOnboardingStep({ step: stepNum, data: formData });
        router.push(`/onboarding/${stepNum + 1}`);
      }
    } catch (e) {
      if (e instanceof OnboardingApiError && e.status === 401) {
        router.replace("/login");
        return;
      }
      toast.error(
        e instanceof OnboardingApiError
          ? e.message
          : "Algo salió mal al guardar. Intenta de nuevo.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSkip() {
    // Skip only allowed on steps 5 and 6
    if (stepNum !== 5 && stepNum !== 6) return;

    const skipPatch: Partial<OnboardingData> =
      stepNum === 5 ? { skip_cartera: true } : { skip_vendedores: true };

    setSaving(true);
    try {
      await postOnboardingStep({ step: stepNum, data: { ...formData, ...skipPatch } });
      setFormData((prev) => ({ ...prev, ...skipPatch }));
      router.push(`/onboarding/${stepNum + 1}`);
    } catch (e) {
      if (e instanceof OnboardingApiError && e.status === 401) {
        router.replace("/login");
        return;
      }
      toast.error(
        e instanceof OnboardingApiError ? e.message : "Algo salió mal. Intenta de nuevo.",
      );
    } finally {
      setSaving(false);
    }
  }

  function handleBack() {
    if (stepNum <= 1) return;
    router.push(`/onboarding/${stepNum - 1}`);
  }

  if (loading) return <WizardSkeleton />;

  const stepContent = (() => {
    switch (stepNum) {
      case 1:
        return <Step1Distribuidor data={formData} onChange={handleChange} errors={errors} />;
      case 2:
        return <Step2Contacto data={formData} onChange={handleChange} errors={errors} />;
      case 3:
        return <Step3Branding data={formData} onChange={handleChange} errors={errors} />;
      case 4:
        return <Step4Credenciales data={formData} onChange={handleChange} errors={errors} />;
      case 5:
        return <Step5Cartera data={formData} onChange={handleChange} errors={errors} />;
      case 6:
        return <Step6Vendedores data={formData} onChange={handleChange} errors={errors} />;
      case 7:
        return <Step7Confirmacion data={formData} onChange={handleChange} errors={errors} />;
      default:
        return null;
    }
  })();

  return (
    <WizardShell
      step={stepNum}
      maxReached={maxReached}
      onNext={handleNext}
      onBack={stepNum > 1 ? handleBack : null}
      onSkip={stepNum === 5 || stepNum === 6 ? handleSkip : undefined}
      nextLabel={stepNum === TOTAL_STEPS ? "Empezar" : "Siguiente"}
      nextLoading={saving}
      nextDisabled={saving}
    >
      {stepContent}
    </WizardShell>
  );
}
