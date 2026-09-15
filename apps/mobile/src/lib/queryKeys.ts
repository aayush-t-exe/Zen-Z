// Shared between bookings.tsx and chats.tsx so whichever tab fetches
// fetchMyGroups() most recently warms the other one's cache too, instead
// of each keeping its own separate copy of the same data.
export const myGroupsKey = (userId: string) => ['myGroups', userId] as const;
export const myBookingsKey = (userId: string) => ['myBookings', userId] as const;
