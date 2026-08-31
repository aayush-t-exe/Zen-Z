import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Animated, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { AuthPalette as Palette } from '@/constants/auth-palette';
import { FontFamily } from '@/constants/fonts';
import { AuthButton } from '@/components/auth-button';
import { OptionPill } from '@/components/option-pill';
import { OptionChip } from '@/components/option-chip';
import { QuizProgressBar } from '@/components/quiz-progress-bar';
import { ScaleQuestionSlider, type ScaleStop } from '@/components/scale-question-slider';
import { MASCOT_STOPS } from '@/components/personality-mascot';
import { PersonalityRevealCard } from '@/components/personality-reveal-card';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';

interface Option {
  id: number;
  label: string;
  display_order: number;
}

interface ScaleTierLabel {
  tier: 0 | 1 | 2;
  label: string;
  description: string;
}

interface Question {
  id: number;
  prompt: string;
  question_type: 'single_select' | 'multi_select' | 'scale';
  display_order: number;
  is_active: boolean;
  options?: Option[];
  scaleDimensionLabel?: string;
  scaleTierLabels?: ScaleTierLabel[];
}

interface Answer {
  questionId: number;
  selectedOptionIds?: number[];
  scaleValue?: number;
}

const CURATING_STEPS = ['Reading your instincts', 'Weighing every answer', 'Shaping your chapter'];
const CURATING_MIN_MS = 2200;

type Phase = 'quiz' | 'curating' | 'recap';

export default function PersonalityQuizScreen() {
  const router = useRouter();
  const { name } = useLocalSearchParams<{ name?: string }>();
  const user = useAuthStore((state) => state.user);

  const [phase, setPhase] = useState<Phase>('quiz');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<number, Answer>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [topTraitLabel, setTopTraitLabel] = useState<string | null>(null);
  const [topTraitValue, setTopTraitValue] = useState(0.5);

  const fetchQuestions = async () => {
    setIsLoading(true);
    setError('');
    try {
      const { data, error: fetchError } = await supabase
        .from('personality_questions')
        .select(
          `
          id,
          prompt,
          question_type,
          display_order,
          is_active,
          personality_question_options ( id, label, display_order ),
          personality_scale_mappings ( dimension_id, personality_dimensions ( label ) ),
          personality_scale_labels ( tier, label, description )
        `
        )
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (fetchError) {
        setError(fetchError.message);
        setIsLoading(false);
        return;
      }

      const typedData = (data || []).map((q: any) => ({
        ...q,
        options: q.personality_question_options || [],
        scaleDimensionLabel: q.personality_scale_mappings?.[0]?.personality_dimensions?.label,
        scaleTierLabels: q.personality_scale_labels || [],
      })) as Question[];

      if (typedData.length === 0) {
        setError('No questions are available right now.');
      }

      setQuestions(typedData);
      setIsLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to load questions');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // fetchQuestions synchronously sets isLoading/error at its top so the
    // same function also works as the Retry button's onPress (line below) —
    // that's not the cascading-render pattern this rule guards against,
    // just a one-shot fetch-on-mount reusing its own reset logic.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchQuestions();
  }, []);

  // Resume in-progress answers — runScoring only used to write
  // personality_answers in one bulk upsert at the very end, so killing the
  // app mid-quiz lost everything. Each answer is now persisted as soon as
  // it's given (see handleSelectOption etc. below), so this rehydrates that
  // progress and lands the student back on their first unanswered question.
  useEffect(() => {
    if (!user || questions.length === 0) return;
    let cancelled = false;

    const restoreAnswers = async () => {
      const { data } = await supabase
        .from('personality_answers')
        .select('question_id, selected_option_ids, scale_value')
        .eq('user_id', user.id);

      if (cancelled || !data || data.length === 0) return;

      const activeQuestionIds = new Set(questions.map((q) => q.id));
      const restored = new Map<number, Answer>();
      for (const row of data) {
        if (!activeQuestionIds.has(row.question_id)) continue;
        restored.set(row.question_id, {
          questionId: row.question_id,
          selectedOptionIds: row.selected_option_ids ?? undefined,
          scaleValue: row.scale_value ?? undefined,
        });
      }

      if (restored.size === 0) return;

      setAnswers(restored);
      const firstUnanswered = questions.findIndex((q) => !restored.has(q.id));
      setCurrentIndex(firstUnanswered === -1 ? questions.length - 1 : firstUnanswered);
    };

    restoreAnswers();
    return () => {
      cancelled = true;
    };
  }, [user, questions]);

  if (isLoading) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator size="large" color={Palette.paper} />
      </View>
    );
  }

  if (questions.length === 0) {
    return (
      <View style={[styles.root, styles.centered]}>
        <Text style={styles.title}>{error || 'No questions available'}</Text>
        <View style={{ marginTop: 24, width: '100%', paddingHorizontal: 20 }}>
          <AuthButton label="Retry" onPress={fetchQuestions} />
        </View>
      </View>
    );
  }

  if (phase === 'curating') {
    return <CuratingScreen />;
  }

  if (phase === 'recap') {
    return (
      <RecapScreen
        name={name}
        traitLabel={topTraitLabel}
        traitValue={topTraitValue}
        onContinue={() => router.replace('/(home)')}
      />
    );
  }

  const currentQuestion = questions[currentIndex];
  const currentAnswer = answers.get(currentQuestion.id);
  const isAnswered =
    (currentAnswer?.selectedOptionIds?.length ?? 0) > 0 || currentAnswer?.scaleValue !== undefined;
  const isLastQuestion = currentIndex === questions.length - 1;

  // The top progress bar tints to match a scale question's current stop —
  // every other question type keeps the plain cream fill (tintColor undefined).
  const scaleZone =
    currentQuestion.question_type === 'scale'
      ? currentAnswer?.scaleValue === undefined
        ? 1
        : currentAnswer.scaleValue <= 2
          ? 0
          : currentAnswer.scaleValue >= 8
            ? 2
            : 1
      : undefined;
  const progressTint = scaleZone !== undefined ? MASCOT_STOPS[scaleZone].footer : undefined;

  // Fire-and-forget: persists a single answer as it's given, so progress
  // survives an app kill. Not awaited/blocking — a failure here isn't fatal
  // since runScoring's final bulk upsert covers anything that didn't make
  // it, this is purely a resume convenience.
  const persistAnswer = (answer: Answer) => {
    if (!user) return;
    supabase
      .from('personality_answers')
      .upsert(
        {
          user_id: user.id,
          question_id: answer.questionId,
          selected_option_ids: answer.selectedOptionIds || null,
          scale_value: answer.scaleValue ?? null,
        },
        { onConflict: 'user_id,question_id' }
      )
      .then(({ error: persistError }) => {
        if (persistError) console.warn('Failed to persist answer draft:', persistError);
      });
  };

  const handleSelectOption = (optionId: number) => {
    const answer = { questionId: currentQuestion.id, selectedOptionIds: [optionId] };
    setAnswers(new Map(answers.set(currentQuestion.id, answer)));
    persistAnswer(answer);
  };

  const handleToggleMultiOption = (optionId: number) => {
    const existing = currentAnswer?.selectedOptionIds || [];
    const newSelectedIds = existing.includes(optionId)
      ? existing.filter((id) => id !== optionId)
      : [...existing, optionId];
    const answer = { questionId: currentQuestion.id, selectedOptionIds: newSelectedIds };
    setAnswers(new Map(answers.set(currentQuestion.id, answer)));
    persistAnswer(answer);
  };

  const handleScaleChange = (value: number) => {
    const answer = { questionId: currentQuestion.id, scaleValue: value };
    setAnswers(new Map(answers.set(currentQuestion.id, answer)));
    persistAnswer(answer);
  };

  const handleBack = () => {
    if (currentIndex === 0) {
      router.back();
      return;
    }
    setCurrentIndex(currentIndex - 1);
  };

  const handleNext = () => {
    if (!isAnswered) return;
    if (!isLastQuestion) {
      setCurrentIndex(currentIndex + 1);
      return;
    }
    runScoring();
  };

  const runScoring = async () => {
    if (!user) return;

    setPhase('curating');
    setIsSaving(true);
    setError('');

    // CuratingScreen runs its own ring-fill animation over this same
    // duration, entirely self-contained — this just holds the phase open
    // for at least that long so the real save/score work never finishes
    // and yanks the screen away mid-animation.
    const minDelay = new Promise((resolve) => setTimeout(resolve, CURATING_MIN_MS));

    const work = (async () => {
      const answerRows = Array.from(answers.values()).map((answer) => ({
        user_id: user.id,
        question_id: answer.questionId,
        selected_option_ids: answer.selectedOptionIds || null,
        scale_value: answer.scaleValue ?? null,
      }));

      const { error: saveError } = await supabase
        .from('personality_answers')
        .upsert(answerRows, { onConflict: 'user_id,question_id' });

      if (saveError) throw new Error(saveError.message);

      // Answers are safely saved at this point, so a scoring failure here
      // isn't catastrophic — but it can't be swallowed either.
      // getPostAuthRoute gates onboarding completion purely on
      // personality_scores existing, so silently proceeding to recap/home
      // without scores meant the student got bounced straight back to this
      // quiz on their next session with zero explanation. Retry once for a
      // transient blip, then surface a real error instead of faking success.
      // A 200 with an empty/missing `scores` array counts as a failure too
      // (e.g. the function resolved a caller with no saved answers) — every
      // currently active question except the logistics one (Q9) carries a
      // weight, so a real scoring run for a completed quiz is never empty.
      let scoreData: { scores?: { dimension_id: number; score: number }[] } | null = null;
      let lastScoreError: unknown = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        const result = await supabase.functions.invoke('score-personality', {
          body: { user_id: user.id },
        });
        if (!result.error && result.data?.scores?.length) {
          scoreData = result.data;
          lastScoreError = null;
          break;
        }
        lastScoreError = result.error ?? new Error(`Scoring returned no scores: ${JSON.stringify(result.data)}`);
      }

      if (lastScoreError) {
        // FunctionsHttpError's `context` is the raw fetch Response — the
        // status/body carrying the *actual* server-side reason are on it,
        // but console.warn(error) only prints the generic
        // "Edge Function returned a non-2xx status code" message unless we
        // read them out explicitly.
        if (lastScoreError instanceof FunctionsHttpError) {
          const status = lastScoreError.context?.status;
          const body = await lastScoreError.context?.text?.().catch(() => null);
          console.warn('Scoring function error:', status, body);
        } else {
          console.warn('Scoring function error:', lastScoreError);
        }
        throw new Error("Couldn't finish scoring your answers. Please try again.");
      }

      const scores = scoreData!.scores!;

      const top = scores.reduce((best, row) => (row.score > best.score ? row : best), scores[0]);

      const { data: dimensions } = await supabase
        .from('personality_dimensions')
        .select('id, label')
        .eq('id', top.dimension_id)
        .single();

      if (dimensions?.label) {
        setTopTraitLabel(dimensions.label);
        setTopTraitValue(top.score);
      }
    })();

    try {
      await Promise.all([work, minDelay]);
      setPhase('recap');
    } catch (err: any) {
      // Stay on the quiz (not recap) so the error is actually visible, and
      // so the last question's Continue button is right there to retry —
      // answers already given are untouched in local state either way.
      setError(err.message || 'Failed to save answers');
      setPhase('quiz');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text onPress={handleBack} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
          {'←'}
        </Text>
        <View style={{ flex: 1, marginLeft: 16 }}>
          <QuizProgressBar step={currentIndex} total={questions.length} tintColor={progressTint} />
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>{currentQuestion.prompt}</Text>

        {currentQuestion.question_type === 'single_select' && (
          <View style={{ gap: 12, marginTop: 28 }}>
            {currentQuestion.options?.map((option) => {
              const isSelected = currentAnswer?.selectedOptionIds?.[0] === option.id;
              const hasSelection = (currentAnswer?.selectedOptionIds?.length ?? 0) > 0;
              return (
                <OptionPill
                  key={option.id}
                  label={option.label}
                  selected={isSelected}
                  dimmed={hasSelection && !isSelected}
                  onPress={() => handleSelectOption(option.id)}
                  variant="radio"
                />
              );
            })}
          </View>
        )}

        {currentQuestion.question_type === 'multi_select' && (
          <View style={styles.chipGrid}>
            {currentQuestion.options?.map((option) => (
              <OptionChip
                key={option.id}
                label={option.label}
                selected={currentAnswer?.selectedOptionIds?.includes(option.id) ?? false}
                onPress={() => handleToggleMultiOption(option.id)}
              />
            ))}
          </View>
        )}

        {currentQuestion.question_type === 'scale' && (
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <ScaleQuestion
              value={currentAnswer?.scaleValue}
              dimensionLabel={currentQuestion.scaleDimensionLabel}
              tierLabels={currentQuestion.scaleTierLabels}
              onChange={handleScaleChange}
            />
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <View style={styles.footer}>
        <AuthButton
          label={isLastQuestion ? 'Continue  →' : 'Next  →'}
          onPress={handleNext}
          loading={isSaving}
          disabled={!isAnswered || isSaving}
        />
      </View>
    </View>
  );
}

const ZONE_LABEL = ['Low on', 'Balanced on', 'High on'] as const;
const ZONE_SCALE_VALUE = [0, 5, 10] as const;

function ScaleQuestion({
  value,
  dimensionLabel,
  tierLabels,
  onChange,
}: {
  value: number | undefined;
  dimensionLabel?: string;
  tierLabels?: ScaleTierLabel[];
  onChange: (value: number) => void;
}) {
  const zone: 0 | 1 | 2 = value === undefined ? 1 : value <= 2 ? 0 : value >= 8 ? 2 : 1;

  // Falls back to generic "Low/Balanced/High on {dimension}" copy for a
  // future scale question that hasn't been given its own tier labels yet —
  // this one already has (see personality_scale_labels).
  const stops: ScaleStop[] =
    tierLabels && tierLabels.length === 3
      ? [...tierLabels].sort((a, b) => a.tier - b.tier).map((t) => ({ label: t.label, description: t.description }))
      : ZONE_LABEL.map((prefix) => ({ label: `${prefix} ${dimensionLabel ?? ''}`.trim(), description: '' }));

  return (
    <ScaleQuestionSlider stops={stops} value={zone} onChange={(z) => onChange(ZONE_SCALE_VALUE[z])} />
  );
}

function CuratingScreen() {
  // Matches the lazy-useState pattern email-input.tsx uses for Animated.Value
  // — refs flag the new react-hooks/refs lint rule, useState doesn't.
  const [rotation] = useState(() => new Animated.Value(0));
  const [ringValues] = useState(() => CURATING_STEPS.map(() => new Animated.Value(0)));
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const spin = Animated.loop(
      Animated.timing(rotation, { toValue: 1, duration: 3200, useNativeDriver: true })
    );
    spin.start();
    return () => spin.stop();
  }, [rotation]);

  // Each point's ring fills fully before the next one starts, rather than
  // every marker flipping from empty to done at the same instant.
  useEffect(() => {
    let cancelled = false;
    const stepDuration = Math.round(CURATING_MIN_MS / CURATING_STEPS.length);

    const runStep = (index: number) => {
      if (cancelled || index >= ringValues.length) return;
      setActiveStep(index);
      Animated.timing(ringValues[index], {
        toValue: 1,
        duration: stepDuration,
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) runStep(index + 1);
      });
    };

    runStep(0);
    return () => {
      cancelled = true;
    };
  }, [ringValues]);

  const spinStyle = {
    transform: [
      {
        rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }),
      },
    ],
  };

  const dots = Array.from({ length: 6 }, (_, i) => i);
  const radius = 44;

  return (
    <View style={[styles.root, styles.centered]}>
      <Animated.View style={[styles.dotRing, spinStyle]}>
        {dots.map((i) => {
          const angle = (i / dots.length) * Math.PI * 2;
          const tierColor = MASCOT_STOPS[i % MASCOT_STOPS.length].footer;
          return (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: tierColor,
                  left: radius + radius * Math.cos(angle) - 6,
                  top: radius + radius * Math.sin(angle) - 6,
                },
              ]}
            />
          );
        })}
      </Animated.View>

      <Text style={[styles.title, { textAlign: 'center', marginTop: 32 }]}>
        {'We’re piecing together\nyour story'}
      </Text>

      <View style={styles.curatingList}>
        {CURATING_STEPS.map((label, idx) => (
          <View key={label} style={styles.curatingRow}>
            <CuratingRing
              progress={ringValues[idx]}
              reached={idx <= activeStep}
              color={MASCOT_STOPS[idx % MASCOT_STOPS.length].footer}
            />
            <Text style={[styles.curatingLabel, idx <= activeStep && styles.curatingLabelDone]}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const RING_SIZE = 18;
const RING_RADIUS = 7;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** A single checklist point, filling clockwise as its slice of curating time elapses. */
function CuratingRing({
  progress,
  reached,
  color,
}: {
  progress: Animated.Value;
  reached: boolean;
  color: string;
}) {
  const strokeDashoffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [RING_CIRCUMFERENCE, 0],
  });

  return (
    <Svg width={RING_SIZE} height={RING_SIZE}>
      <Circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_RADIUS}
        fill="none"
        stroke={Palette.ring}
        strokeWidth={2}
      />
      {reached && (
        <AnimatedCircle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeDasharray={`${RING_CIRCUMFERENCE}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          // Ring grows from 12 o'clock, matching the rotation dots above.
          transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
        />
      )}
    </Svg>
  );
}

function RecapScreen({
  name,
  traitLabel,
  traitValue,
  onContinue,
}: {
  name?: string;
  traitLabel: string | null;
  traitValue: number;
  onContinue: () => void;
}) {
  const greetingName = name ? `, ${name}` : '';
  const tier: 0 | 1 | 2 = traitValue < 0.34 ? 0 : traitValue < 0.67 ? 1 : 2;

  return (
    <View style={styles.root}>
      <View style={[styles.body, styles.centered]}>
        {traitLabel && <PersonalityRevealCard tier={tier} label={traitLabel} />}
        <Text style={[styles.title, { textAlign: 'center', marginTop: 28 }]}>
          {`Hey${greetingName}, we're starting\nto see your shape in this story.`}
        </Text>
        {traitLabel ? (
          <Text style={styles.subtitleCenter}>
            {`You lean ${traitLabel}. It'll shape the table we build for you.`}
          </Text>
        ) : (
          <Text style={styles.subtitleCenter}>
            {'Your answers are in. The rest happens quietly, on our end.'}
          </Text>
        )}
      </View>

      <View style={styles.footer}>
        <AuthButton label="Continue  →" onPress={onContinue} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Palette.canvas,
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  back: {
    color: Palette.text,
    fontSize: 22,
    fontWeight: '600',
    fontFamily: FontFamily.body.semiBold,
  },
  body: {
    flex: 1,
  },
  footer: {
    paddingTop: 12,
  },
  title: {
    color: Palette.text,
    fontSize: 25,
    lineHeight: 32,
    fontWeight: '700',
    fontFamily: FontFamily.display.bold,
    letterSpacing: -0.4,
  },
  subtitleCenter: {
    color: Palette.muted,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: FontFamily.body.regular,
    textAlign: 'center',
    marginTop: 14,
    paddingHorizontal: 12,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 28,
  },
  error: {
    color: Palette.error,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: FontFamily.body.semiBold,
    textAlign: 'center',
    marginTop: 16,
  },
  dotRing: {
    width: 88,
    height: 88,
  },
  dot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Palette.paper,
  },
  curatingList: {
    marginTop: 40,
    gap: 16,
    width: '100%',
    paddingHorizontal: 12,
  },
  curatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  curatingLabel: {
    color: Palette.muted,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FontFamily.body.semiBold,
  },
  curatingLabelDone: {
    color: Palette.text,
  },
});
