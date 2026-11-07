import LegalPage from "@/components/LegalPage";
export const metadata = { title: "Privacy Policy — Y2ube" };
export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated="10 September 2026">
      <p>Y2ube ("we", "us") is operated by FNA Marketing Solutions, Punjab, India. This policy explains what we collect when you use y2ube.io and the Y2ube app, and how we use it.</p>
      <h2>What we collect</h2>
      <ul>
        <li><strong>Account data</strong> — your name, email address and, if you sign in with Google, your Google account id and profile picture. We never see your Google password.</li>
        <li><strong>Content you provide</strong> — prompts, scripts, uploaded reference images, logos and any files you attach to a video.</li>
        <li><strong>Generated content</strong> — scripts, images, voiceovers, music, thumbnails and videos we produce for you.</li>
        <li><strong>Usage and billing</strong> — credit balance and ledger, plan, payment references from Stripe (we do not store card or bank details), and technical logs (timestamps, errors, provider request ids) needed to run and debug generations.</li>
      </ul>
      <h2>How we use it</h2>
      <ul>
        <li>To generate the videos you request, using third-party AI and media providers (language models, image/video generation, text-to-speech, music generation, stock footage). Your prompt and related text are sent to those providers to produce your video.</li>
        <li>To bill you, show your history, and provide support.</li>
        <li>To send transactional email (video ready, low credits, payment receipts). We do not send marketing email without your consent.</li>
      </ul>
      <h2>YouTube data</h2>
      <p>If you connect a YouTube channel, Y2ube uses the Google API Services to (a) read the name and picture of the channel you connected so we can show it to you, and (b) upload videos that you explicitly choose to publish, with the title, description, tags, thumbnail, visibility and schedule you set. We store an encrypted refresh token to do this on your behalf. We do not read your videos, comments, subscribers or analytics, and we do not use YouTube data for advertising or share it with third parties. You can disconnect the channel at any time in Settings, which deletes the token; you can also revoke access at <a href="https://myaccount.google.com/permissions" className="underline">myaccount.google.com/permissions</a>. Y2ube's use of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" className="underline">Google API Services User Data Policy</a>, including the Limited Use requirements.</p>
      <h2>Sharing</h2>
      <p>We share data only with the processors needed to provide the service: AI/media providers (for the content of your request), our hosting providers (Vercel, Hostinger, Neon), our payment provider (Stripe), and our email provider. We never sell personal data.</p>
      <h2>Retention</h2>
      <p>Generated videos and assets are kept while your account is active so you can re-download and edit them; you can delete a project at any time. Uploaded reference files are kept with the project. Account data is deleted within 30 days of an account deletion request to <a href="mailto:support@y2ube.io" className="underline">support@y2ube.io</a>.</p>
      <h2>Security</h2>
      <p>Data is encrypted in transit (HTTPS) and OAuth tokens are encrypted at rest. Provider API keys are held only on our servers.</p>
      <h2>Your rights</h2>
      <p>You can access, export or delete your data, and withdraw consent, by emailing <a href="mailto:support@y2ube.io" className="underline">support@y2ube.io</a>.</p>
      <h2>Contact</h2>
      <p>FNA Marketing Solutions · Punjab, India · support@y2ube.io</p>
    </LegalPage>
  );
}
