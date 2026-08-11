# Storage Architecture

Student profile photos are stored in a private Supabase Storage bucket with three layers of privacy enforcement.

## Photo Privacy Enforcement

### Layer 1: Private Bucket
- Bucket `profile-photos` is **not public**
- Direct URL access is impossible without credentials

### Layer 2: Row-Level Security (RLS)
On `storage.objects`, only:
- Users can upload/read their own photos (`profile-photos/{user_id}/profile.jpg`)
- Admins can read all photos

Students cannot access other students' photos at any layer.

### Layer 3: Signed URLs (Admin Only)
The admin dashboard **must** use time-limited signed URLs, not raw `photo_url` fields:

```typescript
// Admin dashboard: fetching a student's photo
const photoPath = 'profile-photos/student-uuid/profile.jpg';
const { data } = await supabase.storage
  .from('profile-photos')
  .createSignedUrl(photoPath, 86400); // 24h expiry

// Use data.signedUrl to display photo
```

This prevents accidental public URL leaks (e.g., copying a URL and pasting it in a browser).

## For Mobile App (Student)

### Uploading a Photo
```typescript
// In profile-creation.tsx
const response = await fetch(photoUri);
const blob = await response.blob();

const fileName = `${currentUser.id}/profile.jpg`;
await supabase.storage
  .from('profile-photos')
  .upload(fileName, blob, { contentType: 'image/jpeg' });

const photoUrl = supabase.storage
  .from('profile-photos')
  .getPublicUrl(fileName).data.publicUrl;

// Store photoUrl in profiles.photo_url
await supabase
  .from('profiles')
  .update({ photo_url: photoUrl })
  .eq('id', currentUser.id);
```

### Accessing Own Photo
Students can read their own photo via the RLS policy "self read own photo".

### Cannot See Other Photos
The app queries `group_member_public` view (which excludes `photo_url`), so there is **no code path** to fetch another student's photo.

## For Admin Dashboard (Founder)

### Querying Student List with Photos
```typescript
// Query the admin view with student data
const { data: students } = await supabase
  .from('admin_students_with_personality')
  .select('id, full_name, email, gender, year_of_study, photo_path, personality_scores');

// For each student, generate a signed URL
for (const student of students) {
  if (student.photo_path) {
    const { data } = await supabase.storage
      .from('profile-photos')
      .createSignedUrl(student.photo_path, 86400); // 24h
    
    student.photo_url = data.signedUrl;
  }
}
```

### Database Views Available

**`admin_student_profiles`**
- Basic student info (name, email, gender, year, photo_path)
- Use for admin dashboard lists

**`admin_students_with_personality`**
- Student info + personality scores as JSON
- Use for matching dashboard (scores needed for group compatibility)

**`photo_storage_audit`** (debug only)
- Check if photos are properly stored
- Verify no malformed photo_url values

## Important Notes

1. **`photo_url` is never returned to mobile clients** — it's only in profiles, and RLS + the groupmate view prevent student access.

2. **Admin dashboard must use signed URLs** — never embed a `photo_url` directly. The URL expires after 24h, so the app must generate fresh URLs per session.

3. **Photo paths follow a pattern** — `profile-photos/{user_id}/profile.jpg` — hardcode this, don't rely on stored photo_url for path construction.

4. **Personality scores are JSON** — `admin_students_with_personality` returns scores as `{ "1": 0.75, "3": 0.6, ... }` keyed by dimension_id. Use this for compatibility calculations.

## Testing Photo Privacy

To verify privacy works:

```sql
-- As a regular user, this should return only your own row
select id, full_name, photo_url from profiles;

-- As admin, this returns all rows
select id, full_name, photo_url from profiles;

-- Regular user trying to read another's photo via storage should fail
-- (RLS will block it)
```

## Updating Photos

Students can re-upload a photo (it overwrites the old one):
```typescript
const fileName = `${currentUser.id}/profile.jpg`;
await supabase.storage
  .from('profile-photos')
  .upload(fileName, blob, {
    contentType: 'image/jpeg',
    upsert: true, // Overwrite if exists
  });
```
