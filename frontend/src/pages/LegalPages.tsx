import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Brand } from "../components/Layout";

/**
 * Privacy policy and terms of use.
 * DRAFT — written to describe how Proppros actually handles data; have it reviewed
 * before opening Proppros to other landlords. Set CONTACT_EMAIL before relying on it.
 */
const CONTACT_EMAIL = ""; // e.g. "privacy@yourdomain.com" — shown on both pages
const UPDATED = "October 17, 2026";

function Contact() {
  return CONTACT_EMAIL ? <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> : <>the landlord or property manager who invited you</>;
}

function Privacy() {
  return (
    <>
      <h1>Privacy policy</h1>
      <p className="muted">Last updated {UPDATED}</p>

      <h2>Who this covers</h2>
      <p>
        Proppros is property-management software. Landlords and property managers (“owners”) use it to run their rentals, and invite tenants
        and team members to it. Each owner’s organization controls the information it enters about its properties, tenants and leases.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account details:</strong> name, email, phone (optional) and a password, which is stored only as a one-way hash.</li>
        <li><strong>Property records entered by owners:</strong> properties, units, tenants’ names and contact details, emergency contacts, vehicles, pets, leases, rent, payments, expenses and maintenance requests.</li>
        <li><strong>Files you upload:</strong> leases, receipts, photos and other documents.</li>
        <li><strong>Activity records:</strong> an audit log of changes, and a log of emails the app sent.</li>
      </ul>

      <h2>How it’s used</h2>
      <p>
        Only to provide the service: posting rent, keeping ledgers, sending receipts, reminders and maintenance updates, and showing tenants
        their own lease, balance and requests. We don’t sell personal information or use it for advertising.
      </p>

      <h2>Who can see it</h2>
      <ul>
        <li>Members of the organization that owns the record, according to their role (owner, manager, accountant, maintenance).</li>
        <li>Tenants see only their own leases, payments, requests and the documents the owner chose to share.</li>
        <li>
          Service providers that run the app on our behalf: Vercel (hosting and file storage), Neon (database), and the email provider used to
          send messages. They process data only to provide their service.
        </li>
      </ul>

      <h2>Cookies and storage</h2>
      <p>
        One essential cookie keeps you signed in. Your browser also remembers your theme and selected portfolio. There are no advertising or
        tracking cookies.
      </p>

      <h2>Security and retention</h2>
      <p>
        Data travels over HTTPS. Documents are kept in private storage and are only served to signed-in users with access. Records are kept
        while the owner’s organization uses Proppros; owners can delete their records, and you can ask for your account to be deleted.
      </p>

      <h2>Your choices</h2>
      <p>
        You can update your profile and email notification preferences in Settings. For access, correction or deletion of information an owner
        holds about you, contact <Contact />.
      </p>
    </>
  );
}

function Terms() {
  return (
    <>
      <h1>Terms of use</h1>
      <p className="muted">Last updated {UPDATED}</p>

      <h2>Using Proppros</h2>
      <p>
        Proppros helps landlords manage properties, leases, rent records, expenses and maintenance. You’re responsible for the accuracy of what
        you enter and for keeping your password private.
      </p>

      <h2>Owners’ responsibilities</h2>
      <ul>
        <li>Only enter information about tenants that you’re allowed to collect, and only invite people with their agreement.</li>
        <li>You remain responsible for complying with landlord–tenant, fair-housing, privacy and tax laws where your properties are.</li>
        <li>Rent charges, late fees and balances are calculated from the lease terms you enter — review them.</li>
      </ul>

      <h2>Not professional advice</h2>
      <p>
        Reports and figures are provided for record-keeping. They are not legal, tax or accounting advice; check with a professional before
        filing taxes or taking legal action.
      </p>

      <h2>Availability</h2>
      <p>
        We work to keep Proppros available and your data safe, but the service is provided “as is”, without guarantees of uninterrupted
        availability. Keep your own copies of important documents; reports can be exported to CSV at any time.
      </p>

      <h2>Acceptable use</h2>
      <p>Don’t misuse the service: no attempts to access other organizations’ data, no uploading unlawful content, and no disrupting the app.</p>

      <h2>Changes and contact</h2>
      <p>
        We may update these terms and will change the date above when we do. Questions: <Contact />.
      </p>
    </>
  );
}

export function LegalPage({ doc }: { doc: "privacy" | "terms" }) {
  const { t } = useTranslation();
  return (
    <div className="legal">
      <header className="portal-top">
        <div className="portal-top-inner">
          <Link to="/" style={{ textDecoration: "none" }}>
            <Brand />
          </Link>
          <nav className="portal-nav" aria-label={t("nav.legal_nav")}>
            <Link to="/privacy" className={doc === "privacy" ? "active" : ""}>
              {t("nav.privacy")}
            </Link>
            <Link to="/terms" className={doc === "terms" ? "active" : ""}>
              {t("nav.terms")}
            </Link>
          </nav>
        </div>
      </header>
      <main id="main" className="portal-content legal-body">{doc === "privacy" ? <Privacy /> : <Terms />}</main>
    </div>
  );
}
