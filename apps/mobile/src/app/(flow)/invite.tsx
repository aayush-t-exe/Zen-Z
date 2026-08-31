import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Share, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { AuthPalette as Palette } from '@/constants/auth-palette';
import { FontFamily } from '@/constants/fonts';
import { AuthButton } from '@/components/auth-button';
import { supabase } from '@/lib/supabase';

export default function InviteScreen() {
  const router = useRouter();

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
        <View style={{ gap: 6, marginBottom: 28 }}>
          <Text style={styles.title}>Invite someone into the story</Text>
          <Text style={styles.subtitle}>
            Your next Café or Dinner is on us when a friend takes their first step in. Bigger
            adventures get ₹21 off.
          </Text>
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color={Palette.text} />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.codeLabel}>Your code</Text>
              <Text style={styles.codeValue}>{code}</Text>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{redeemedCount}</Text>
                <Text style={styles.statLabel}>Friends who stepped in</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{availableCredits}</Text>
                <Text style={styles.statLabel}>₹21 credits waiting</Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <View style={{ paddingHorizontal: 24, paddingBottom: 32, gap: 14 }}>
        <AuthButton label="Share via WhatsApp" onPress={handleShare} loading={isSharing} disabled={!code} />
        <Text style={styles.backLink} onPress={() => router.back()}>
          Back
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Palette.canvas,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 24,
  },
  title: {
    color: Palette.text,
    fontSize: 24,
    fontWeight: '700',
    fontFamily: FontFamily.display.bold,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: Palette.muted,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: FontFamily.body.regular,
  },
  card: {
    borderWidth: 2.5,
    borderColor: Palette.ring,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  codeLabel: {
    color: Palette.muted,
    fontSize: 12,
    fontFamily: FontFamily.body.regular,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  codeValue: {
    color: Palette.text,
    fontSize: 34,
    fontWeight: '800',
    fontFamily: FontFamily.body.bold,
    letterSpacing: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 14,
  },
  statCard: {
    flex: 1,
    borderWidth: 2,
    borderColor: Palette.ring,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    color: Palette.text,
    fontSize: 26,
    fontWeight: '800',
    fontFamily: FontFamily.body.bold,
  },
  statLabel: {
    color: Palette.muted,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FontFamily.body.regular,
    textAlign: 'center',
  },
  error: {
    color: Palette.error,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: FontFamily.body.semiBold,
  },
  backLink: {
    color: Palette.muted,
    fontSize: 14,
    fontFamily: FontFamily.body.regular,
    textAlign: 'center',
  },
});
