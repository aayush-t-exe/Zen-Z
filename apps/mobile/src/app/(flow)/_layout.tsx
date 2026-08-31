import { Stack } from 'expo-router';

// These screens are booking/chat flows pushed on top of the (home) tabs,
// not tab destinations themselves. Nesting them in their own Stack (rather
// than as hidden Tabs.Screen entries inside (home)/_layout.tsx) gives them
// a real back-stack: pushing sports-select -> booking-flow -> payment pops
// one step at a time, and backing out of the first screen in this stack
// returns to whichever (home) tab was active, instead of a bottom-tabs
// navigator's back button always resetting to the first tab.
export default function FlowLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="sports-select" />
      <Stack.Screen name="booking-flow" />
      <Stack.Screen name="payment" />
      <Stack.Screen name="payment-callback" />
      <Stack.Screen name="booking-details" />
      <Stack.Screen name="no-show" />
      <Stack.Screen name="group/[groupId]" />
      <Stack.Screen name="invite" />
    </Stack>
  );
}
