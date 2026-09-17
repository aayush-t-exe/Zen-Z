// One-off dev tool: generates a real OTP for a tester without relying on
// email delivery, by calling Supabase's Admin API directly. Use this to
// unblock testers while Brevo/Gmail sender reputation is still warming up.
//
// Usage:
//   SUPABASE_SERVICE_ROLE_KEY=... node get-otp.mjs someone@email.com
//
// Get the service_role key from: Supabase Dashboard → Settings → API
// (campus-social-prod project). Never commit this key or paste it into chat.

const email = process.argv[2];
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const projectRef = 'hzydzyeyvfuokveujbki'; // campus-social-prod

if (!email || !serviceRoleKey) {
  console.error('Usage: SUPABASE_SERVICE_ROLE_KEY=... node get-otp.mjs someone@email.com');
  process.exit(1);
}

const res = await fetch(`https://${projectRef}.supabase.co/auth/v1/admin/generate_link`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  },
  body: JSON.stringify({
    type: 'magiclink',
    email,
  }),
});

const data = await res.json();

if (!res.ok) {
  console.error('Failed:', data);
  process.exit(1);
}

console.log('OTP code for', email, ':', data.email_otp);
console.log('(Give this code to the tester to enter in the app. Expires per your OTP expiry setting.)');
