import { Chevron } from '../components/ui';

/*
 * Plain-language starter policies. Have them reviewed before launching paid plans or native apps,
 * and set VITE_SUPPORT_EMAIL so users have a way to reach you.
 */

const UPDATED = 'October 26, 2026';
const EMAIL = (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined) || '';
const contact = EMAIL ? <a href={`mailto:${EMAIL}`}>{EMAIL}</a> : 'the support contact listed on our website';

export type LegalPage = 'terms' | 'privacy' | 'disclaimer';

export function Legal({ page, onBack }: { page: LegalPage; onBack: () => void }) {
  return (
    <div className="legal">
      <button className="back" onClick={onBack}><Chevron dir="left" /> Back</button>
      {page === 'terms' && <Terms />}
      {page === 'privacy' && <Privacy />}
      {page === 'disclaimer' && <Disclaimer />}
      <p className="fine" style={{ marginTop: 30 }}>Last updated {UPDATED}.</p>
    </div>
  );
}

function Disclaimer() {
  return (<>
    <h1>Medical disclaimer</h1>
    <p>Build Up provides general fitness and exercise information. It is not medical advice, and it does not diagnose, treat or cure any injury or condition.</p>
    <p>The rehab plans are general programs for common sports injuries. They can't account for everything about your body or your injury. If your pain is severe, getting worse, not improving after a few weeks, or comes with any of the warning signs listed in the app, stop and see a doctor, physiotherapist or athletic trainer.</p>
    <p>Talk to a doctor before starting any exercise program if you have a heart, lung or other medical condition, are pregnant, have had recent surgery, or are unsure whether exercise is safe for you.</p>
    <p>Stop exercising immediately and seek medical help if you feel chest pain, faintness, severe shortness of breath or sudden severe pain.</p>
  </>);
}

function Terms() {
  return (<>
    <h1>Terms of use</h1>
    <h2>Using Build Up</h2>
    <p>By creating an account or using Build Up you agree to these terms. You must be at least 13 years old. If you are under 18, you confirm a parent or guardian has agreed to these terms for you.</p>
    <h2>Not medical advice</h2>
    <p>Build Up gives general training information only. Read the medical disclaimer below. You are responsible for deciding whether an exercise is right for you and for using safe technique and equipment. You exercise at your own risk.</p>
    <h2>Your account</h2>
    <p>Keep your password private. You're responsible for activity on your account. You can delete your account at any time from the Me tab, which permanently removes your data.</p>
    <h2>Free and paid plans</h2>
    <p>The core app is free. We may offer paid features in the future. Any paid plan will clearly show its price and terms before you pay, and you won't be charged without agreeing.</p>
    <h2>Acceptable use</h2>
    <p>Don't misuse the service: no attempts to break, overload or reverse-engineer it, access other people's data, or use it for anything unlawful.</p>
    <h2>Changes and availability</h2>
    <p>We're improving Build Up all the time, so features may change. We may update these terms; if the changes are significant we'll tell you in the app. The service is provided "as is" without warranties, and to the extent the law allows we aren't liable for injuries or losses arising from its use.</p>
    <h2>Contact</h2>
    <p>Questions? Reach us at {contact}.</p>
    <Disclaimer />
  </>);
}

function Privacy() {
  return (<>
    <h1>Privacy policy</h1>
    <h2>What we collect</h2>
    <p>Your email address and password (stored securely by our authentication provider, never readable by us), the answers you give during setup (name, goal, sport, injuries, schedule, equipment, experience and age range), your generated plan, and what you log: completed exercises, weights, pain ratings, effort and notes.</p>
    <h2>Why</h2>
    <p>Only to run the app: to build your plan, adjust your rehab, and sync your progress across your devices. We don't sell your data and we don't use it for advertising.</p>
    <h2>Health information</h2>
    <p>Injury and pain information is sensitive. It is stored in your account, protected so that only you can read it, and used only to tailor your training.</p>
    <h2>Where it's stored</h2>
    <p>Data is stored with our database provider, Supabase, and a copy is kept on your device so the app works offline. Data is encrypted in transit.</p>
    <h2>Your choices</h2>
    <p>You can download all your data or permanently delete your account at any time from the Me tab. Deleting your account removes your data from our servers.</p>
    <h2>Children</h2>
    <p>Build Up is not for children under 13, and we don't knowingly collect their data. If you believe a child under 13 has an account, contact us and we'll delete it.</p>
    <h2>Contact</h2>
    <p>Questions or requests: {contact}.</p>
  </>);
}
