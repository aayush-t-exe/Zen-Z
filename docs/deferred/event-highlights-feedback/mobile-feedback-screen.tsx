import { useCallback, useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { FLOW_CONTENT_MAX, FLOW_SIDE_PADDING, FlowText } from '@/constants/flow-theme';
import { ACTIVITY_ART_BADGE_SCALE, activityArt } from '@/constants/activity-art';
import { FlowPillButton } from '@/components/flow-pill-button';
import { FlowPanel, FlowField } from '@/components/flow-panel';
import { OptionChip } from '@/components/option-chip';
import { SummaryBadge } from '@/components/summary-card';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import { formatSlotDateTime } from '@/lib/format';
import { requestAppReview, followInstagram } from '@/lib/social-actions';

/** Matches the primary pill's near-white, as the other redesigned screens set it. */
const LOADER = '#FFFDF8';

const WOULD_REPEAT_OPTIONS: { value: 'yes' | 'maybe' | 'no'; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'no', label: 'No' },
];

interface EventInfo {
  activity_name: string;
  slot_datetime: string;
}

type Step = 'loading' | 'already_submitted' | 'form' | 'thanks';

export default function FeedbackScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router = useRouter();
  const userId = useAuthStore((state) => state.user?.id);
  const { width: screenWidth } = useWindowDimensions();
  const contentWidth = Math.min(FLOW_CONTENT_MAX, screenWidth - FLOW_SIDE_PADDING * 2);

  const [step, setStep] = useState<Step>('loading');
  const [event, setEvent] = useState<EventInfo | null>(null);

  const [rating, setRating] = useState(0);
  const [wouldRepeat, setWouldRepeat] = useState<'yes' | 'maybe' | 'no' | null>(null);
  const [note, setNote] = useState('');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaBase64, setMediaBase64] = useState<string | null>(null);
  const [mediaContentType, setMediaContentType] = useState<string>('image/jpeg');
  const [mediaConsent, setMediaConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!userId || !bookingId) return;
      let cancelled = false;

      const load = async () => {
        const [bookingResult, existingResult] = await Promise.all([
          supabase
            .from('bookings')
            .select('slots:slot_id ( slot_datetime, activity_types:activity_type_id ( name ) )')
            .eq('id', bookingId)
            .single(),
          // Feedback has no unique constraint on booking_id (a plain insert
          // table, same as reports) — this check is what keeps a student
          // from being shown the form again and inserting a second row if
          // they reopen the same notification.
          supabase.from('feedback').select('id').eq('booking_id', bookingId).maybeSingle(),
        ]);
        if (cancelled) return;

        const slot = (bookingResult.data as any)?.slots;
        if (slot) {
          setEvent({
            activity_name: slot.activity_types?.name ?? 'Activity',
            slot_datetime: slot.slot_datetime,
          });
        }

        setStep(existingResult.data ? 'already_submitted' : 'form');
      };

      load();

      return () => {
        cancelled = true;
      };
    }, [userId, bookingId])
  );

  const handlePickMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'We need permission to access your photos and videos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
      base64: true,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    setMediaUri(asset.uri);
    setMediaContentType(asset.mimeType ?? (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'));

    if (asset.base64) {
      // Images: the picker already hands back base64 directly.
      setMediaBase64(asset.base64);
      return;
    }

    // Videos: ImagePicker doesn't populate `base64` for them. Reading via
    // fetch(uri).blob() is the thing profile-creation.tsx's photo upload
    // specifically found unreliable on native — expo-file-system's File
    // API reads the picked asset's real bytes regardless of media type.
    const { File } = await import('expo-file-system');
    const file = new File(asset.uri);
    setMediaBase64(await file.base64());
  };

  const handleRemoveMedia = () => {
    setMediaUri(null);
    setMediaBase64(null);
    setMediaConsent(false);
  };

  const canSubmit = rating > 0 && wouldRepeat !== null && (!mediaUri || mediaConsent) && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit || !bookingId) return;
    setSubmitting(true);

    try {
      const { data: inserted, error: insertError } = await supabase
        .from('feedback')
        .insert({
          booking_id: bookingId,
          rating,
          would_repeat: wouldRepeat,
          private_note: note.trim() || null,
        })
        .select('id')
        .single();

      if (insertError || !inserted) {
        throw insertError ?? new Error('Failed to submit feedback');
      }

      if (mediaUri && mediaBase64 && mediaConsent) {
        const ext = mediaContentType.startsWith('video') ? 'mp4' : 'jpg';
        const path = `${bookingId}/${inserted.id}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('event-highlights')
          .upload(path, decode(mediaBase64), { contentType: mediaContentType, upsert: true });

        if (uploadError) {
          // The rating/feedback itself already saved — a storage hiccup on
          // the optional photo shouldn't be reported as the whole submit
          // having failed.
          console.warn('[feedback] media upload failed:', uploadError);
        } else {
          await supabase
            .from('feedback')
            .update({ media_path: path, media_consent: true })
            .eq('id', inserted.id);
        }
      }

      setStep('thanks');
    } catch (err: any) {
      Alert.alert('Could not submit feedback', err?.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'loading') {
    return (
      <View style={styles.root}>
        <ActivityIndicator size="large" color={LOADER} />
      </View>
    );
  }

  if (step === 'already_submitted') {
    return (
      <View style={[styles.root, { paddingHorizontal: 24 }]}>
        <View style={{ width: contentWidth, alignItems: 'center' }}>
          <Text style={FlowText.titleCentred}>Already got your story on this one.</Text>
          <FlowPillButton
            label="Back to home  →"
            width={contentWidth}
            onPress={() => router.push('/(home)')}
            style={{ marginTop: 40 }}
          />
        </View>
      </View>
    );
  }

  if (step === 'thanks') {
    return (
      <View style={[styles.root, { paddingHorizontal: 24 }]}>
        <View style={{ width: contentWidth, alignItems: 'center' }}>
          <Text style={FlowText.titleCentred}>Thanks for the feedback.</Text>
          <Text style={[styles.centredSubtitle, { marginTop: 10 }]}>
            It genuinely shapes who we put at the next table.
          </Text>

          <FlowPillButton
            label="Rate us"
            width={contentWidth}
            onPress={() => requestAppReview()}
            style={{ marginTop: 32 }}
          />
          <Pressable onPress={() => followInstagram()} style={{ marginTop: 18 }}>
            <Text style={FlowText.link}>Follow @zen_z.app</Text>
          </Pressable>

          <Pressable onPress={() => router.push('/(home)')} style={{ marginTop: 28 }}>
            <Text style={FlowText.link}>Back to home</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={{ width: contentWidth, alignItems: 'center' }}>
          {event && (
            <View style={{ marginBottom: 18 }}>
              <SummaryBadge
                cardWidth={contentWidth}
                icon={{ source: activityArt(event.activity_name), scale: ACTIVITY_ART_BADGE_SCALE }}
              />
            </View>
          )}

          <Text style={FlowText.titleCentred}>How did your story end tonight?</Text>
          {event && (
            <Text style={[styles.centredSubtitle, { marginTop: 10 }]}>
              {event.activity_name}, {formatSlotDateTime(event.slot_datetime, event.activity_name)}
            </Text>
          )}

          <Text style={[FlowText.sectionLabel, styles.sectionLabel]}>Rate the evening</Text>
          <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setRating(n)} hitSlop={6}>
                <Image
                  source={
                    n <= rating
                      ? require('@/assets/images/icon-star-filled.png')
                      : require('@/assets/images/icon-star-outline.png')
                  }
                  style={styles.star}
                  resizeMode="contain"
                  accessibilityIgnoresInvertColors
                />
              </Pressable>
            ))}
          </View>

          <Text style={[FlowText.sectionLabel, styles.sectionLabel]}>Would you do this again?</Text>
          <View style={styles.chipRow}>
            {WOULD_REPEAT_OPTIONS.map((opt) => (
              <OptionChip
                key={opt.value}
                label={opt.label}
                selected={wouldRepeat === opt.value}
                onPress={() => setWouldRepeat(opt.value)}
              />
            ))}
          </View>

          <Text style={[FlowText.sectionLabel, styles.sectionLabel]}>Anything else? (just for us)</Text>
          <FlowField
            width={contentWidth}
            value={note}
            onChangeText={setNote}
            placeholder="Optional"
            style={{ marginTop: 8 }}
          />

          <Text style={[FlowText.sectionLabel, styles.sectionLabel]}>
            Got a photo or clip from tonight?
          </Text>
          <Text style={[styles.centredSubtitle, { marginTop: 4, marginBottom: 12 }]}>
            We might feature it on @zen_z.app — totally optional.
          </Text>

          {mediaUri ? (
            <View style={{ width: contentWidth, alignItems: 'center' }}>
              <Image source={{ uri: mediaUri }} style={styles.mediaPreview} resizeMode="cover" />
              <Pressable onPress={handleRemoveMedia} style={{ marginTop: 10 }}>
                <Text style={FlowText.link}>Remove</Text>
              </Pressable>

              <View style={{ marginTop: 14, width: contentWidth }}>
                <FlowPanel
                  label="Everyone in this is okay with it being posted publicly"
                  selected={mediaConsent}
                  onPress={() => setMediaConsent((v) => !v)}
                  width={contentWidth}
                  align="left"
                  multiSelect
                />
              </View>
            </View>
          ) : (
            <FlowPillButton label="Attach a photo or clip" width={contentWidth} onPress={handlePickMedia} />
          )}

          <FlowPillButton
            label={submitting ? 'Submitting…' : 'Submit'}
            width={contentWidth}
            onPress={handleSubmit}
            disabled={!canSubmit}
            loading={submitting}
            style={{ marginTop: 32, marginBottom: 40 }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 70,
  },
  centredSubtitle: {
    ...FlowText.subtitle,
    textAlign: 'center',
  },
  sectionLabel: {
    alignSelf: 'flex-start',
    marginTop: 28,
    marginBottom: 10,
  },
  starRow: {
    flexDirection: 'row',
    gap: 14,
  },
  star: {
    width: 32,
    height: 32,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignSelf: 'flex-start',
  },
  mediaPreview: {
    width: '100%',
    height: 180,
    borderRadius: 14,
  },
});
