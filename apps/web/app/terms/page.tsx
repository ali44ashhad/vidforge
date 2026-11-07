import LegalPage from "@/components/LegalPage";
export const metadata = { title: "Terms of Service — Y2ube" };
export default function Terms() {
  return (
    <LegalPage title="Terms of Service" updated="10 September 2026">
      <p>By creating an account or using Y2ube you agree to these terms. Y2ube is operated by FNA Marketing Solutions, Punjab, India.</p>
      <h2>The service</h2>
      <p>Y2ube turns your prompts and scripts into videos using automated AI and media systems. Output quality varies; generation can fail or produce results you don't like. We provide targeted retries and refunds of credits for failed generations as described in the Refund Policy.</p>
      <h2>Your content and licence</h2>
      <ul>
        <li>You keep ownership of prompts, scripts and files you provide, and you grant us the rights needed to process them to produce your videos.</li>
        <li>Subject to payment, you may use the videos we generate for you for personal and commercial purposes, including monetised channels.</li>
        <li>Stock footage is licensed from Pexels under the Pexels License; AI-generated images, clips, voices and music are subject to the terms of the respective providers. You are responsible for checking that your use complies with platform rules (e.g. YouTube's AI-content disclosure).</li>
      </ul>
      <h2>Acceptable use</h2>
      <p>Don't use Y2ube to create content that is illegal, defamatory, infringing, sexually explicit, hateful, deceptive (including impersonating real people without consent), or that targets minors inappropriately. We may refuse, remove or suspend accounts that violate this.</p>
      <h2>Credits and plans</h2>
      <p>Videos consume credits; the estimate is shown before you generate and the final charge is settled on completion (never above the reservation). Monthly plans renew credits each billing period; unused plan credits expire at the end of the period unless stated otherwise. Prices are shown in USD; customers in India are charged the equivalent INR price. Prices include applicable taxes unless shown otherwise.</p>
      <h2>YouTube</h2>
      <p>Uploading through Y2ube is subject to the <a href="https://www.youtube.com/t/terms" className="underline">YouTube Terms of Service</a> and <a href="https://policies.google.com/privacy" className="underline">Google Privacy Policy</a>. You are responsible for content you publish.</p>
      <h2>Liability</h2>
      <p>The service is provided "as is". To the extent permitted by law, our liability is limited to the amount you paid us in the 3 months before the claim.</p>
      <h2>Changes</h2>
      <p>We may update these terms; material changes are announced in the app or by email.</p>
      <p>Contact: support@y2ube.io</p>
    </LegalPage>
  );
}
