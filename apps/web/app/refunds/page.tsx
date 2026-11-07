import LegalPage from "@/components/LegalPage";
export const metadata = { title: "Refund Policy — Y2ube" };
export default function Refunds() {
  return (
    <LegalPage title="Refund & Cancellation Policy" updated="10 September 2026">
      <h2>Credits</h2>
      <ul>
        <li>If a generation fails, the credits reserved for it are refunded automatically to your balance.</li>
        <li>If a generation completes, the credits actually used are charged (never more than the reservation) and the rest is released.</li>
        <li>Edits and re-renders of a finished video are free.</li>
      </ul>
      <h2>Payments</h2>
      <ul>
        <li>Plan purchases are non-refundable once credits from that purchase have been used.</li>
        <li>If none of the purchased credits have been used, you can request a full refund within 7 days of payment by emailing support@y2ube.io with your payment id. Refunds are returned to the original payment method within 5–10 business days.</li>
        <li>Duplicate charges are refunded in full.</li>
      </ul>
      <h2>Cancellation</h2>
      <p>Monthly plans do not auto-renew unless you have enabled auto-pay; you can stop renewing at any time from Billing. Your credits remain usable until the end of the paid period.</p>
      <p>Contact: support@y2ube.io</p>
    </LegalPage>
  );
}
