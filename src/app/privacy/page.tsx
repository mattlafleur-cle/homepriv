import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { offer } from "@/config/offer";
import { contact, vendors } from "@/config/site";

export const metadata: Metadata = { title: "Privacy notice", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  const c = contact();
  const v = vendors();
  const who = c.legalName ?? offer.brandName;
  return (
    <LegalPage title="Privacy notice" intro="We're a privacy service, so we try to collect as little as we can and say exactly what we do with it.">
      <h2>Who we are</h2>
      <p>
        This site is run by {who}
        {c.mailingAddress ? `, ${c.mailingAddress}` : ""}.{" "}
        {c.email ? <>Questions or requests: <a className="text-link" href={`mailto:${c.email}`}>{c.email}</a>.</> : "Contact details will be listed here before launch."}
      </p>

      <h2>What we collect</h2>
      <h3>When you ask about your home</h3>
      <ul>
        <li>The home&apos;s address, your name, and your email address.</li>
        <li>Your phone number, only if you choose to give it.</li>
        <li>Whether you own the home or act for the owner (this is your statement; we don&apos;t verify ownership at this stage), whether it&apos;s listed right now, any listing links, and any notes you add.</li>
        <li>Whether you agreed to be contacted about this request, and whether you opted in to occasional news.</li>
      </ul>
      <h3>If you buy</h3>
      <ul>
        <li>Payment confirmation from Stripe: the amount, date, and a payment reference. Stripe collects your card details on its own page; we never receive or store your card number.</li>
        <li>Your written authorization (typed name and the date you signed), anything you tell us about the listing agent, and whether you asked for a Street View blur request.</li>
        <li>The work record: which sites we checked, what we requested, and dated evidence of the results, including screenshots of public web pages.</li>
      </ul>
      <h3>Real estate agents</h3>
      <p>Name, email, brokerage, and message, if you use the agent inquiry form.</p>

      <h2>What we don&apos;t collect</h2>
      <ul>
        <li>No passwords to property websites or other accounts.</li>
        <li>No advertising trackers, session recording, or third-party analytics scripts.</li>
        <li>Customers get no cookies from us. The only cookie we set is a sign-in cookie for our own staff area.</li>
      </ul>
      <p>
        We count a few steps anonymously, such as how many people click the main button and how many purchases are confirmed. Those
        counts store the step name, which part of the page it came from, and the time. They don&apos;t include names, emails,
        addresses, IP addresses, or device identifiers.
      </p>

      <h2>How we use it</h2>
      <ul>
        <li>To review whether we can help with your home, and to contact you about your request.</li>
        <li>To deliver the service: making requests to websites, the original listing agent or brokerage, and MLS contacts on your behalf, which means sharing the address and, where required, your name as the owner.</li>
        <li>To take payment, issue refunds, and keep business and tax records.</li>
        <li>To send occasional news, only if you opted in. You can unsubscribe at any time.</li>
      </ul>
      <p>We don&apos;t sell or rent your information, and we don&apos;t share it for advertising.</p>

      <h2>Service providers</h2>
      <ul>
        <li>Stripe processes payments.</li>
        <li>{v.email ? `${v.email} delivers our transactional email.` : "An email delivery provider sends our transactional email. We'll name it here before launch."}</li>
        <li>{v.hosting ? `${v.hosting} hosts this website${v.database ? "" : " and its database"}.` : "A hosting provider runs this website. We'll name it here before launch."}</li>
        {v.database && <li>{v.database} stores the website&apos;s database.</li>}
      </ul>

      <h2>How long we keep it</h2>
      <ul>
        <li>Requests we decline, or homes that were listed at the time: deleted after {offer.retention.declinedInquiryDays} days.</li>
        <li>Approved requests that never become orders: deleted after {offer.retention.unpaidApprovedInquiryDays} days.</li>
        <li>Agent inquiries: deleted after {offer.retention.agentInquiryDays} days.</li>
        <li>Copies of the emails we send you: deleted after 90 days.</li>
        <li>Orders, authorizations, and the work record: kept as business records for as long as we need them for tax, accounting, and dispute purposes. We&apos;ll state the exact period before launch.</li>
      </ul>

      <h2>Your choices</h2>
      <p>
        You can ask to see, correct, or delete your information. We&apos;ll delete anything we aren&apos;t required to keep for tax,
        accounting, or legal reasons, and tell you what we kept and why.
      </p>

      <h2>Security</h2>
      <p>
        Customer details are kept in a private database that only our staff area can read, behind a password. Links we email you use
        long random codes rather than your name or address. Payment pages are run by Stripe.
      </p>
    </LegalPage>
  );
}
