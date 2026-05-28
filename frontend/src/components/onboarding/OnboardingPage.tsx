import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import type { OnboardingData } from "../../api/client";
import { useAuth } from "../../AuthContext";
import {
  getDigitalTwinMethodDetails,
  getDigitalTwinRecommendations,
} from "../../lib/digitalTwin";
import {
  ArrowRight,
  Building,
  Check,
  LayoutDashboard,
  Mail,
  MapPin,
  Package,
  Search,
  Truck,
  Zap,
} from "../Icons";
import MultiSelectChips from "./MultiSelectChips";
import OnboardingLayout from "./OnboardingLayout";
import OnboardingStep from "./OnboardingStep";
import OnboardingSummary from "./OnboardingSummary";
import OptionCard from "./OptionCard";

const restaurantTypes = [
  "Casual dining",
  "Fast casual",
  "Cafe / lunchroom",
  "Fine dining",
  "Delivery / ghost kitchen",
  "Bar / pub",
  "Buffet / all-you-can-eat",
  "Other",
];

const acquisitionSources = [
  "Someone recommended it",
  "School / project demo",
  "LinkedIn",
  "Instagram / TikTok",
  "Restaurant owner / colleague",
  "Google",
  "Other",
];

const orderingStyles = [
  "Mostly by feeling",
  "Based on previous weeks",
  "Based on POS/sales data",
  "Based on supplier history",
  "Staff tells me what is low",
  "A mix of everything",
];

const orderingFrequencies = [
  "Daily",
  "2–3 times per week",
  "Weekly",
  "Every two weeks",
  "Irregular / when needed",
];

const suggestedProducts = [
  "Chicken breast",
  "Tomatoes",
  "Lettuce",
  "Brioche buns",
  "Parmesan",
  "Beer",
  "Fries",
  "Coffee beans",
  "Milk",
  "Bread",
];

const suggestedSuppliers = [
  "Sligro",
  "Hanos",
  "Makro",
  "Local butcher",
  "Local bakery",
  "Local greengrocer",
  "Beverage supplier",
];

const forecastingSignalOptions = [
  "Weather",
  "Local events",
  "Holidays",
  "Day of the week",
  "Seasonality",
  "Terrace / outdoor seating",
  "Delivery orders",
  "Reservations",
  "Manual stock counts",
  "Supplier lead times",
];

const primaryGoals = [
  "Reduce waste",
  "Prevent stockouts",
  "Save time ordering",
  "Improve margins",
  "Understand demand",
  "Automate supplier orders",
];

const defaultSignals = [
  "Weather",
  "Day of the week",
  "Holidays",
  "Seasonality",
  "Supplier lead times",
];

const totalSteps = 12;

function createDefaultOnboardingData(
  existing?: OnboardingData,
): OnboardingData {
  return {
    restaurantType: existing?.restaurantType,
    acquisitionSource: existing?.acquisitionSource,
    orderingDecisionStyle: existing?.orderingDecisionStyle,
    orderingFrequency: existing?.orderingFrequency,
    initialProducts: existing?.initialProducts ?? [],
    suppliers: existing?.suppliers ?? [],
    forecastingSignals: existing?.forecastingSignals?.length
      ? existing.forecastingSignals
      : defaultSignals,
    restaurantLocation: {
      city: existing?.restaurantLocation?.city,
      postalCodeOrNeighborhood:
        existing?.restaurantLocation?.postalCodeOrNeighborhood,
    },
    primaryGoal: existing?.primaryGoal,
    digitalTwinSetup: {
      selectedMethods: existing?.digitalTwinSetup?.selectedMethods ?? [],
      recommendedMethods: existing?.digitalTwinSetup?.recommendedMethods ?? [],
    },
  };
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, saveOnboarding } = useAuth();
  const [stepIndex, setStepIndex] = useState(0);
  const [data, setData] = useState<OnboardingData>(() =>
    createDefaultOnboardingData(user?.onboardingData),
  );
  const [productInput, setProductInput] = useState("");
  const [supplierInput, setSupplierInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(createDefaultOnboardingData(user?.onboardingData));
  }, [user?.onboardingData]);

  const isLastStep = stepIndex === totalSteps - 1;
  const canGoBack = stepIndex > 0;

  function updateData(patch: Partial<OnboardingData>) {
    setData((current) => ({ ...current, ...patch }));
  }

  function toggleMultiValue(
    key: "initialProducts" | "suppliers" | "forecastingSignals",
    value: string,
  ) {
    setData((current) => {
      const currentValues = current[key];
      return {
        ...current,
        [key]: currentValues.includes(value)
          ? currentValues.filter((item) => item !== value)
          : [...currentValues, value],
      };
    });
  }

  function addCustomValue(
    key: "initialProducts" | "suppliers",
    rawValue: string,
  ) {
    const value = rawValue.trim();
    if (!value) return;
    setData((current) => ({
      ...current,
      [key]: current[key].includes(value)
        ? current[key]
        : [...current[key], value],
    }));
  }

  function isStepValid(index: number) {
    switch (index) {
      case 0:
        return true;
      case 1:
        return Boolean(data.restaurantType);
      case 2:
        return Boolean(data.acquisitionSource);
      case 3:
        return Boolean(data.orderingDecisionStyle);
      case 4:
        return Boolean(data.orderingFrequency);
      case 5:
        return data.initialProducts.length > 0;
      case 6:
        return data.suppliers.length > 0;
      case 7:
        return data.forecastingSignals.length > 0;
      case 8:
        return Boolean(data.restaurantLocation?.city?.trim());
      case 9:
        return Boolean(data.primaryGoal);
      case 10:
        return true;
      case 11:
        return true;
      default:
        return false;
    }
  }

  async function persistCurrentState(completed = false) {
    setSubmitting(true);
    setError(null);
    try {
      await saveOnboarding({ data, completed });
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save onboarding.",
      );
      throw saveError;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleContinue() {
    if (submitting) return;
    if (!isStepValid(stepIndex)) return;
    if (isLastStep) {
      await persistCurrentState(true);
      navigate("/overview", { replace: true });
      return;
    }
    await persistCurrentState(false);
    setStepIndex((current) => Math.min(current + 1, totalSteps - 1));
  }

  function handleBack() {
    if (!canGoBack || submitting) return;
    setStepIndex((current) => Math.max(current - 1, 0));
  }

  async function handleSkipProducts() {
    updateData({ initialProducts: [] });
    await persistCurrentState(false);
    setStepIndex(6);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const targetTag = target?.tagName?.toLowerCase();
      const isInputFocused =
        targetTag === "input" ||
        targetTag === "textarea" ||
        targetTag === "select";

      if (event.key === "ArrowLeft" && canGoBack && !isInputFocused) {
        event.preventDefault();
        handleBack();
      }

      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.metaKey &&
        !event.ctrlKey
      ) {
        if (isInputFocused && [5, 6, 8].includes(stepIndex)) return;
        event.preventDefault();
        void handleContinue();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canGoBack, stepIndex, data, submitting]);

  const footer = (
    <div className="flex flex-col gap-4 border-t border-[rgba(23,52,43,0.08)] pt-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        {canGoBack ? (
          <button
            type="button"
            onClick={handleBack}
            className="rounded-full border border-[rgba(23,52,43,0.1)] bg-white px-4 py-2.5 text-sm font-medium text-heading"
          >
            Back
          </button>
        ) : (
          <span className="text-sm text-body">Takes about 2 minutes</span>
        )}
        {stepIndex === 5 ? (
          <button
            type="button"
            onClick={() => void handleSkipProducts()}
            className="text-sm font-medium text-body"
          >
            I’ll add products later
          </button>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        {error ? <p className="text-sm text-alert">{error}</p> : null}
        <button
          type="button"
          onClick={() => void handleContinue()}
          disabled={!isStepValid(stepIndex) || submitting}
          className="inline-flex items-center gap-2 rounded-full bg-emerald-dark px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(23,52,43,0.2)] disabled:opacity-50"
        >
          {isLastStep
            ? "Open HVAS"
            : stepIndex === 0
              ? "Get started"
              : "Continue"}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  let content;
  const recommendedTwinMethods = getDigitalTwinRecommendations(
    data.restaurantType,
  );
  const twinMethodDetails = getDigitalTwinMethodDetails(data.restaurantType);

  switch (stepIndex) {
    case 0:
      content = (
        <OnboardingStep
          stepKey="welcome"
          eyebrow="Welcome"
          title="Let’s set up your restaurant brain."
          subtitle="Answer a few quick questions so HVAS can predict your first orders."
          footer={footer}
        >
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                title: "Forecast smarter",
                description:
                  "HVAS starts with the ordering habits that matter most.",
                icon: <Zap className="h-5 w-5" />,
              },
              {
                title: "Keep it lightweight",
                description:
                  "No long admin setup. Just enough signal to start helping.",
                icon: <Check className="h-5 w-5" />,
              },
              {
                title: "Open a real workspace",
                description:
                  "You’ll land in a ready-to-use forecast flow, completely personalized to your restaurant.",
                icon: <LayoutDashboard className="h-5 w-5" />,
              },
            ].map(({ title, description, icon }) => (
              <div
                key={title}
                className="rounded-[26px] border border-[rgba(23,52,43,0.08)] bg-white/85 p-5"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#edf4ef] text-emerald-dark">
                  {icon}
                </div>
                <p className="mt-4 text-lg font-semibold tracking-[-0.03em] text-heading">
                  {title}
                </p>
                <p className="mt-2 text-sm leading-6 text-body">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </OnboardingStep>
      );
      break;
    case 1:
      content = (
        <OnboardingStep
          stepKey="restaurant-type"
          eyebrow="Step 1"
          title="What type of restaurant are you running?"
          subtitle="This helps HVAS set the right demand rhythm from day one."
          footer={footer}
        >
          <div className="grid gap-4 md:grid-cols-2">
            {restaurantTypes.map((option) => (
              <OptionCard
                key={option}
                label={option}
                selected={data.restaurantType === option}
                onClick={() => updateData({ restaurantType: option })}
                icon={<Building className="h-5 w-5" />}
              />
            ))}
          </div>
        </OnboardingStep>
      );
      break;
    case 2:
      content = (
        <OnboardingStep
          stepKey="acquisition-source"
          eyebrow="Step 2"
          title="How did you first hear about HVAS?"
          subtitle="This helps us understand which introductions are actually useful."
          footer={footer}
        >
          <div className="grid gap-4 md:grid-cols-2">
            {acquisitionSources.map((option) => (
              <OptionCard
                key={option}
                label={option}
                selected={data.acquisitionSource === option}
                onClick={() => updateData({ acquisitionSource: option })}
                icon={<Search className="h-5 w-5" />}
              />
            ))}
          </div>
        </OnboardingStep>
      );
      break;
    case 3:
      content = (
        <OnboardingStep
          stepKey="ordering-style"
          eyebrow="Step 3"
          title="How do you currently decide what to order?"
          subtitle="HVAS uses this to meet you where you already are."
          footer={footer}
        >
          <div className="grid gap-4 md:grid-cols-2">
            {orderingStyles.map((option) => (
              <OptionCard
                key={option}
                label={option}
                selected={data.orderingDecisionStyle === option}
                onClick={() => updateData({ orderingDecisionStyle: option })}
                icon={<Truck className="h-5 w-5" />}
              />
            ))}
          </div>
        </OnboardingStep>
      );
      break;
    case 4:
      content = (
        <OnboardingStep
          stepKey="ordering-frequency"
          eyebrow="Step 4"
          title="How often do you usually place supplier orders?"
          subtitle="This helps HVAS shape the right forecasting window and replenishment cadence."
          footer={footer}
        >
          <div className="grid gap-4 md:grid-cols-2">
            {orderingFrequencies.map((option) => (
              <OptionCard
                key={option}
                label={option}
                selected={data.orderingFrequency === option}
                onClick={() => updateData({ orderingFrequency: option })}
                icon={<Zap className="h-5 w-5" />}
              />
            ))}
          </div>
        </OnboardingStep>
      );
      break;
    case 5:
      content = (
        <OnboardingStep
          stepKey="products"
          eyebrow="Step 5"
          title="What products should HVAS start predicting first?"
          subtitle="Choose a few important items. You can refine the full catalog later."
          footer={footer}
        >
          <MultiSelectChips
            label="Start with a few products"
            values={data.initialProducts}
            suggested={suggestedProducts}
            inputValue={productInput}
            inputPlaceholder="Add a product"
            onInputChange={setProductInput}
            onAddCustom={() => {
              addCustomValue("initialProducts", productInput);
              setProductInput("");
            }}
            onToggleValue={(value) =>
              toggleMultiValue("initialProducts", value)
            }
            onRemoveValue={(value) =>
              updateData({
                initialProducts: data.initialProducts.filter(
                  (item) => item !== value,
                ),
              })
            }
          />
        </OnboardingStep>
      );
      break;
    case 6:
      content = (
        <OnboardingStep
          stepKey="suppliers"
          eyebrow="Step 6"
          title="Which suppliers do you order from?"
          subtitle="Add the names you buy from most often. One is enough to get started."
          footer={footer}
        >
          <MultiSelectChips
            label="Suppliers"
            values={data.suppliers}
            suggested={suggestedSuppliers}
            inputValue={supplierInput}
            inputPlaceholder="Add a supplier"
            onInputChange={setSupplierInput}
            onAddCustom={() => {
              addCustomValue("suppliers", supplierInput);
              setSupplierInput("");
            }}
            onToggleValue={(value) => toggleMultiValue("suppliers", value)}
            onRemoveValue={(value) =>
              updateData({
                suppliers: data.suppliers.filter((item) => item !== value),
              })
            }
          />
        </OnboardingStep>
      );
      break;
    case 7:
      content = (
        <OnboardingStep
          stepKey="signals"
          eyebrow="Step 7"
          title="What should HVAS take into account when predicting demand?"
          subtitle="Keep the defaults or tailor the signals you want the assistant to watch."
          footer={footer}
        >
          <div className="grid gap-4 md:grid-cols-2">
            {forecastingSignalOptions.map((signal) => (
              <OptionCard
                key={signal}
                label={signal}
                selected={data.forecastingSignals.includes(signal)}
                onClick={() => toggleMultiValue("forecastingSignals", signal)}
                icon={<Check className="h-5 w-5" />}
              />
            ))}
          </div>
        </OnboardingStep>
      );
      break;
    case 8:
      content = (
        <OnboardingStep
          stepKey="location"
          eyebrow="Step 8"
          title="Where is your restaurant located?"
          subtitle="HVAS uses this for weather, holidays, and local demand context."
          footer={footer}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[26px] border border-[rgba(23,52,43,0.08)] bg-white/88 p-5">
              <label className="text-sm font-medium text-heading">City</label>
              <div className="mt-3 flex h-12 items-center gap-3 rounded-2xl border border-border bg-[#fafbf8] px-4">
                <MapPin className="h-4 w-4 text-body" />
                <input
                  type="text"
                  value={data.restaurantLocation?.city ?? ""}
                  onChange={(event) =>
                    updateData({
                      restaurantLocation: {
                        ...data.restaurantLocation,
                        city: event.target.value,
                      },
                    })
                  }
                  placeholder="Amsterdam"
                  className="h-full w-full bg-transparent text-sm text-heading outline-none"
                />
              </div>
            </div>

            <div className="rounded-[26px] border border-[rgba(23,52,43,0.08)] bg-white/88 p-5">
              <label className="text-sm font-medium text-heading">
                Postal code or neighborhood
              </label>
              <div className="mt-3 flex h-12 items-center gap-3 rounded-2xl border border-border bg-[#fafbf8] px-4">
                <Mail className="h-4 w-4 text-body" />
                <input
                  type="text"
                  value={
                    data.restaurantLocation?.postalCodeOrNeighborhood ?? ""
                  }
                  onChange={(event) =>
                    updateData({
                      restaurantLocation: {
                        ...data.restaurantLocation,
                        postalCodeOrNeighborhood: event.target.value,
                      },
                    })
                  }
                  placeholder="Jordaan"
                  className="h-full w-full bg-transparent text-sm text-heading outline-none"
                />
              </div>
            </div>
          </div>
        </OnboardingStep>
      );
      break;
    case 9:
      content = (
        <OnboardingStep
          stepKey="goal"
          eyebrow="Step 9"
          title="What do you want HVAS to help with first?"
          subtitle="Pick the first outcome that matters. We’ll bias the workspace toward it."
          footer={footer}
        >
          <div className="grid gap-4 md:grid-cols-2">
            {primaryGoals.map((goal) => (
              <OptionCard
                key={goal}
                label={goal}
                selected={data.primaryGoal === goal}
                onClick={() => updateData({ primaryGoal: goal })}
                icon={<Package className="h-5 w-5" />}
              />
            ))}
          </div>
        </OnboardingStep>
      );
      break;
    case 10:
      content = (
        <OnboardingStep
          stepKey="digital-twin"
          eyebrow="Step 10"
          title="Digital Twin Setup"
          subtitle="Choose the easiest ways for HVAS to build a more complete twin of your restaurant. You can skip this and continue later."
          footer={footer}
        >
          <div className="space-y-5">
            <div className="rounded-[26px] border border-[rgba(23,52,43,0.08)] bg-[#f6f8f5] p-5">
              <p className="text-sm font-semibold text-heading">
                Recommended for {data.restaurantType ?? "your setup"}
              </p>
              <p className="mt-2 text-sm leading-6 text-body">
                HVAS recommends starting with{" "}
                {recommendedTwinMethods.slice(0, 2).join(" and ").toLowerCase()}{" "}
                based on the restaurant type you selected.
              </p>
            </div>

            <div className="grid gap-4">
              {twinMethodDetails.map((option) => {
                const selected =
                  data.digitalTwinSetup?.selectedMethods.includes(
                    option.method,
                  ) ?? false;
                const recommended = recommendedTwinMethods.includes(
                  option.method,
                );

                return (
                  <button
                    key={option.method}
                    type="button"
                    onClick={() => {
                      const current =
                        data.digitalTwinSetup?.selectedMethods ?? [];
                      const nextSelected = current.includes(option.method)
                        ? current.filter((item) => item !== option.method)
                        : [...current, option.method];
                      updateData({
                        digitalTwinSetup: {
                          selectedMethods: nextSelected,
                          recommendedMethods: recommendedTwinMethods,
                        },
                      });
                    }}
                    className={`rounded-[26px] border px-5 py-5 text-left transition ${
                      selected
                        ? "border-[rgba(23,52,43,0.28)] bg-[#edf4ef] shadow-[0_10px_30px_rgba(23,52,43,0.08)]"
                        : "border-[rgba(23,52,43,0.08)] bg-white/88"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-semibold tracking-[-0.03em] text-heading">
                        {option.method}
                      </p>
                      {recommended ? (
                        <span className="rounded-full bg-emerald-dark px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
                          Recommended
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-body">
                      {option.why}
                    </p>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl bg-white/70 px-3 py-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-body">
                          Effort
                        </p>
                        <p className="mt-1 text-sm font-medium text-heading">
                          {option.effort}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white/70 px-3 py-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-body">
                          HVAS can predict
                        </p>
                        <p className="mt-1 text-sm font-medium text-heading">
                          {option.predicts}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white/70 px-3 py-3">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-body">
                          Twin confidence
                        </p>
                        <p className="mt-1 text-sm font-medium text-heading">
                          {option.confidence}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </OnboardingStep>
      );
      break;
    case 11:
      content = (
        <OnboardingStep
          stepKey="summary"
          eyebrow="Ready"
          title="Your first forecast workspace is ready."
          subtitle="You can start with this light setup now and refine the details later in settings."
          footer={footer}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.08, duration: 0.28 }}
            className="space-y-6"
          >
            <OnboardingSummary data={data} />
            <div className="rounded-[26px] bg-emerald-dark px-5 py-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b7d1c7]">
                What happens next
              </p>
              <p className="mt-3 text-base leading-7 text-[#dfe9e4]">
                HVAS will take you into a focused overview with forecasting,
                smart ordering, and the products and signals you selected here.
              </p>
            </div>
          </motion.div>
        </OnboardingStep>
      );
      break;
    default:
      content = null;
  }

  return (
    <OnboardingLayout
      step={stepIndex + 1}
      totalSteps={totalSteps}
      canGoBack={canGoBack}
      onBack={handleBack}
    >
      {content}
    </OnboardingLayout>
  );
}
