# ClipClash

A GitHub-Pages-friendly gaming clip community with real email/password accounts, email verification, profiles, clips, likes, trending and XP-style profile stats.

## What is already built

- Responsive landing page + gaming feed
- Real Supabase email/password signup and login
- Email verification redirect support
- Forgot-password email flow
- Public usernames + display names + bios
- Post public gaming clip links
- Like/unlike clips
- Trending and latest feeds
- Game filter
- Profile stats (clips / received likes / XP)
- Row Level Security (RLS) so users can only change their own data
- Demo mode before Supabase is connected
- No private server or Node.js required

## 1. Create a Supabase project

1. Go to https://supabase.com and create a free project.
2. Open **SQL Editor**.
3. Create a new query.
4. Paste all of `supabase.sql` and run it once.

## 2. Turn on email verification

In Supabase Dashboard:

**Authentication -> Providers -> Email**

Keep email/password enabled and keep **Confirm email** enabled if you want users to verify their email before signing in.

Then open:

**Authentication -> URL Configuration**

After your GitHub Pages site exists, set:

- **Site URL**: your GitHub Pages URL, for example `https://YOURNAME.github.io/clipclash/`
- Add the same URL to **Redirect URLs**.

For local testing, you can also add `http://localhost:8000/`.

## 3. Connect the frontend

In Supabase Dashboard, open your project API settings and copy:

- Project URL
- Publishable key / anon key intended for browser clients

Open `config.js` and replace:

```js
SUPABASE_URL: "YOUR_SUPABASE_URL",
SUPABASE_PUBLISHABLE_KEY: "YOUR_SUPABASE_PUBLISHABLE_KEY"
```

Do **not** put a `service_role` key in this project. A service-role key is secret and must never be shipped to the browser.

## 4. Test locally

From the project folder, run:

```bash
python -m http.server 8000
```

Open `http://localhost:8000`.

Create a test account, open the verification email, verify it, then log in and post a clip.

## 5. Publish on GitHub Pages

1. Create a GitHub repository, e.g. `clipclash`.
2. Upload **the files inside this folder** to the repository root.
3. Commit/push.
4. GitHub -> repository **Settings -> Pages**.
5. Under Build and deployment choose **Deploy from a branch**.
6. Choose `main` and `/ (root)`.
7. Save.
8. Put the final GitHub Pages URL into Supabase Authentication -> URL Configuration as explained above.

## Important before a public launch

This is a real working MVP, but a public social site also needs moderation. Before promoting it widely, add:

- Terms of Service + Privacy Policy
- Report/block system
- Moderation/admin tools
- Rate limiting / anti-spam controls
- A content policy
- A proper custom domain if you want a stronger brand

Because ClipClash currently stores clip **links**, not uploaded video files, it is much cheaper and simpler to run than a video-hosting platform.
