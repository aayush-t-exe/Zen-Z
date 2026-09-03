import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Share,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FontFamily } from '@/constants/fonts';
import { FLOW_CONTENT_MAX, FLOW_SIDE_PADDING, FlowText } from '@/constants/flow-theme';
import { FlowSurfaceBox } from '@/components/flow-panel';
import { FlowPillButton } from '@/components/flow-pill-button';
import { FlowBackButton } from '@/components/flow-back-button';
import { supabase } from '@/lib/supabase';

/** Matches the primary pill's near-white, as the other redesigned screens set it. */
const LOADER = '#FFFDF8';

/** A stat as one row: the approved label ranged left, its figure right. */
function StatRow({ label, value, width }: { label: string; value: number; width: number }) {
  return (
    <FlowSurfaceBox width={width}>
      <View style={styles.statRow}>
        <Text style={FlowText.rowLabel}>{label}</Text>
        <Text style={styles.statValue}>{value}</Text>
      </View>
    </FlowSurfaceBox>
  );
}

export default function InviteScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();

  // Same content column the rest of the redesign runs.
  const contentWidth = Math.min(FLOW_CONTENT_MAX, screenWidth - FLOW_SIDE_PADDING * 2);

  const [code, setCode] = useState<string | null>(null);
  const [redeemedCount, setRedeemedCount] = useState(0);
  const [availableCredits, setAvailableCredits] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      const { data: myCode, error: codeError } = await supabase.rpc('get_or_create_referral_code');

      if (codeError || !myCode) {
        setError('Could not load your invite code');
        setIsLoading(false);
        return;
      }

      setCode(myCode);

      const [{ count }, { data: credits }] = await Promise.all([
        supabase
          .from('referral_redemptions')
          .select('id', { count: 'exact', head: true })
          .eq('code', myCode),
        supabase.from('referral_credits').select('status'),
      ]);

      setRedeemedCount(count ?? 0);
      setAvailableCredits((credits ?? []).filter((c) => c.status === 'available').length);
      setIsLoading(false);
    };

    load();
  }, []);

  const handleShare = async () => {
    if (!code || isSharing) return;
    setIsSharing(true);
    try {
      await Share.share({
        message: `Come step into the story with me on Zen-Z. Use my code ${code} when you join: https://zen-z.site`,
      });
    } catch {
      // A dismissed share sheet isn't an error worth surfacing.
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={{ width: contentWidth }}>
          <Text style={FlowText.title}>Invite someone{'\n'}into the story</Text>
          <Text style={styles.subtitle}>
            Your next Café or Dinner is on us when a friend takes their first step in. Bigger
            adventures get ₹21 off.
          </Text>

          {isLoading ? (
            <ActivityIndicator size="large" color={LOADER} style={{ marginTop: 40 }} />
          ) : error ? (
            <Text style={styles.error}>{error}</Text>
          ) : (
            <>
              <View style={{ marginTop: 36, gap: 14 }}>
                <Text style={FlowText.sectionLabel}>Your code</Text>
                <FlowSurfaceBox width={contentWidth}>
                  <View style={styles.codeRow}>
                    <Text style={styles.codeValue}>{code}</Text>
                  </View>
                </FlowSurfaceBox>
              </View>

              {/* Label and figure on one row each, rather than the two boxed
                  numerals this had side by side: a half-width box has to
                  stretch tall to hold a stacked value and caption, and the row
                  art's corners pull out of shape when it does. */}
              <View style={{ marginTop: 28, gap: 12 }}>
                <StatRow label="Friends who stepped in" value={redeemedCount} width={contentWidth} />
                <StatRow label="₹21 credits waiting" value={availableCredits} width={contentWidth} />
              </View>
            </>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <FlowBackButton onPress={() => router.back()} />
        <View style={{ marginTop: 18 }}>
          <FlowPillButton
            label="Share via WhatsApp"
            width={contentWidth}
            onPress={handleShare}
            loading={isSharing}
            disabled={!code}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scroll: {
    alignItems: 'center',
    // The header drop the rest of this stack uses.
    paddingTop: 88,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  subtitle: {
    ...FlowText.subtitle,
    marginTop: 14,
  },
  codeRow: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  // The one figure on this screen that is the point of it, so it carries the
  // redesign's numeral face at the size the old card gave it.
  codeValue: {
    color: '#FFFFFF',
    fontSize: 26,
    letterSpacing: 2,
    fontFamily: FontFamily.accent.interBold,
  },
  statRow: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 14,
    gap: 12,
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontFamily: FontFamily.accent.interBold,
  },
  error: {
    ...FlowText.error,
    textAlign: 'left',
    marginTop: 36,
  },
  footer: {
    alignSelf: 'center',
    paddingBottom: 40,
    paddingTop: 12,
  },
});
