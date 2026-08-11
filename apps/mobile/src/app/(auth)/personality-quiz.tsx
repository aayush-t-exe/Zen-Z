import { useState, useEffect } from 'react';
import { View, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';

interface Question {
  id: number;
  prompt: string;
  question_type: 'single_select' | 'multi_select' | 'scale';
  display_order: number;
  is_active: boolean;
  options?: Option[];
}

interface Option {
  id: number;
  label: string;
  display_order: number;
}

interface Answer {
  questionId: number;
  selectedOptionIds?: number[];
  scaleValue?: number;
}

export default function PersonalityQuizScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<number, Answer>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Fetch questions on mount
  useEffect(() => {
    const fetchQuestions = async () => {
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
            personality_question_options (
              id,
              label,
              display_order
            )
          `
          )
          .eq('is_active', true)
          .order('display_order', { ascending: true });

        if (fetchError) {
          setError(fetchError.message);
          return;
        }

        // Type the data properly
        const typedData = (data || []).map((q: any) => ({
          ...q,
          options: q.personality_question_options || [],
        })) as Question[];

        setQuestions(typedData);
        setIsLoading(false);
      } catch (err: any) {
        setError(err.message || 'Failed to load questions');
        setIsLoading(false);
      }
    };

    fetchQuestions();
  }, []);

  if (isLoading) {
    return (
      <ThemedView className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#000" />
      </ThemedView>
    );
  }

  if (questions.length === 0) {
    return (
      <ThemedView className="flex-1 items-center justify-center px-6">
        <ThemedText type="default">No questions available</ThemedText>
      </ThemedView>
    );
  }

  const currentQuestion = questions[currentIndex];
  const isAnswered =
    answers.has(currentQuestion.id) &&
    (answers.get(currentQuestion.id)?.selectedOptionIds?.length ||
      answers.get(currentQuestion.id)?.scaleValue !== undefined);
  const isLastQuestion = currentIndex === questions.length - 1;
  const allAnswered = questions.every((q) => {
    const answer = answers.get(q.id);
    return answer?.selectedOptionIds?.length || answer?.scaleValue !== undefined;
  });

  const handleSelectOption = (optionId: number) => {
    const existing = answers.get(currentQuestion.id) || {};
    const newAnswer: Answer = {
      questionId: currentQuestion.id,
      selectedOptionIds: [optionId],
      ...existing,
    };
    setAnswers(new Map(answers.set(currentQuestion.id, newAnswer)));
  };

  const handleScaleChange = (value: number) => {
    const newAnswer: Answer = {
      questionId: currentQuestion.id,
      scaleValue: value,
    };
    setAnswers(new Map(answers.set(currentQuestion.id, newAnswer)));
  };

  const handleNext = () => {
    if (isAnswered && !isLastQuestion) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleComplete = async () => {
    if (!allAnswered || !user) return;

    setIsSaving(true);
    setError('');

    try {
      // Save all answers to database
      const answerRows = Array.from(answers.values()).map((answer) => ({
        user_id: user.id,
        question_id: answer.questionId,
        selected_option_ids: answer.selectedOptionIds || null,
        scale_value: answer.scaleValue || null,
      }));

      const { error: saveError } = await supabase
        .from('personality_answers')
        .upsert(answerRows, { onConflict: 'user_id,question_id' });

      if (saveError) {
        setError(saveError.message);
        setIsSaving(false);
        return;
      }

      // Call the scoring edge function to compute personality scores
      const { error: scoreError } = await supabase.functions.invoke('score-personality', {
        body: { user_id: user.id },
      });

      if (scoreError) {
        // Don't block on scoring error - answers are saved
        console.warn('Scoring function error:', scoreError);
      }

      // Navigate to home
      router.replace('/(home)');
    } catch (err: any) {
      setError(err.message || 'Failed to save answers');
      setIsSaving(false);
    }
  };

  return (
    <ThemedView className="flex-1">
      <ScrollView className="flex-1 px-6 py-8">
        {/* Progress */}
        <View className="mb-6">
          <View className="flex-row gap-1">
            {questions.map((_, idx) => (
              <View
                key={idx}
                className={`h-2 flex-1 rounded-full ${
                  idx <= currentIndex ? 'bg-black dark:bg-white' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              />
            ))}
          </View>
          <ThemedText type="default" themeColor="textSecondary" className="mt-2 text-sm">
            Question {currentIndex + 1} of {questions.length}
          </ThemedText>
        </View>

        {/* Question */}
        <View className="mb-8">
          <ThemedText type="title" className="text-xl">
            {currentQuestion.prompt}
          </ThemedText>
        </View>

        {/* Answer Options */}
        <View className="mb-8 gap-3">
          {currentQuestion.question_type === 'single_select' && (
            <>
              {currentQuestion.options?.map((option) => {
                const isSelected =
                  answers.get(currentQuestion.id)?.selectedOptionIds?.[0] === option.id;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => handleSelectOption(option.id)}
                    className={`rounded-lg border px-4 py-3 ${
                      isSelected
                        ? 'border-black bg-white dark:border-white dark:bg-gray-900'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    <ThemedText
                      className={isSelected ? 'font-semibold' : ''}
                    >
                      ○ {option.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </>
          )}

          {currentQuestion.question_type === 'scale' && (
            <View className="gap-4">
              {/* Scale labels */}
              <View className="flex-row justify-between">
                <ThemedText type="default" themeColor="textSecondary" className="text-xs">
                  Strongly Disagree
                </ThemedText>
                <ThemedText type="default" themeColor="textSecondary" className="text-xs">
                  Strongly Agree
                </ThemedText>
              </View>

              {/* Scale slider - simple button grid 1-10 */}
              <View className="gap-3">
                <View className="flex-row gap-2">
                  {[1, 2, 3, 4, 5].map((num) => {
                    const isSelected = answers.get(currentQuestion.id)?.scaleValue === num;
                    return (
                      <Pressable
                        key={num}
                        onPress={() => handleScaleChange(num)}
                        className={`flex-1 rounded-lg py-2 ${
                          isSelected
                            ? 'bg-black dark:bg-white'
                            : 'border border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        <ThemedText
                          className={`text-center text-sm font-semibold ${
                            isSelected ? 'text-white dark:text-black' : ''
                          }`}
                        >
                          {num}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
                <View className="flex-row gap-2">
                  {[6, 7, 8, 9, 10].map((num) => {
                    const isSelected = answers.get(currentQuestion.id)?.scaleValue === num;
                    return (
                      <Pressable
                        key={num}
                        onPress={() => handleScaleChange(num)}
                        className={`flex-1 rounded-lg py-2 ${
                          isSelected
                            ? 'bg-black dark:bg-white'
                            : 'border border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        <ThemedText
                          className={`text-center text-sm font-semibold ${
                            isSelected ? 'text-white dark:text-black' : ''
                          }`}
                        >
                          {num}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          )}
        </View>

        {error && (
          <ThemedText type="default" themeColor="textSecondary" className="mb-4 text-red-500">
            {error}
          </ThemedText>
        )}

        {/* Navigation Buttons */}
        <View className="flex-row gap-3">
          <Pressable
            onPress={handlePrevious}
            disabled={currentIndex === 0}
            className="flex-1 rounded-lg border border-gray-300 py-3 px-4 disabled:opacity-30 dark:border-gray-600"
          >
            <ThemedText className="text-center font-semibold">← Back</ThemedText>
          </Pressable>

          {!isLastQuestion && (
            <Pressable
              onPress={handleNext}
              disabled={!isAnswered || isSaving}
              className="flex-1 rounded-lg bg-black py-3 px-4 disabled:opacity-50 dark:bg-white"
            >
              {isSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText className="text-center font-semibold text-white dark:text-black">
                  Next →
                </ThemedText>
              )}
            </Pressable>
          )}

          {isLastQuestion && (
            <Pressable
              onPress={handleComplete}
              disabled={!allAnswered || isSaving}
              className="flex-1 rounded-lg bg-black py-3 px-4 disabled:opacity-50 dark:bg-white"
            >
              {isSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText className="text-center font-semibold text-white dark:text-black">
                  Complete →
                </ThemedText>
              )}
            </Pressable>
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}
