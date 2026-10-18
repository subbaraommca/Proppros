import { useEffect, type ReactNode } from "react";
import { Link, NavLink, useLocation, useParams } from "react-router-dom";
import { ArrowRight, BarChart3, Check, CreditCard, FileText, Megaphone, Users, Wrench } from "lucide-react";
import { Brand } from "../components/Layout";
import { HelpPage } from "./HelpPages";
import { CLOSING, FAQ, FEATURES, FOUNDER, HERO, MONTH, PLANS, VACANCY, type Feature } from "../marketing/content";
import { metaFor } from "../marketing/seo";

const ICONS = { lease: FileText, rent: CreditCard, repair: Wrench, vacancy: Megaphone, portal: Users, report: BarChart3 } as const;

/** Keeps the tab title and description right when visitors move between public pages. */
function usePageMeta() {
  const { pathname } = useLocation();
  useEffect(() => {
    const meta = metaFor(pathname);
    if (!meta) return;
    document.title = meta.title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", meta.description);
    window.scrollTo(0, 0);
  }, [pathname]);
}

function MarketingShell({ children }: { children: ReactNode }) {
  usePageMeta();
  return (
    <div className="site">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-nav">
        <div className="site-wrap site-nav-inner">
          <Link to="/" className="site-brand" aria-label="Proppros home">
            <Brand />
          </Link>
          <nav className="site-links" aria-label="Site">
            <NavLink to="/features">Features</NavLink>
            <NavLink to="/features/vacancies">Vacancies</NavLink>
            <NavLink to="/pricing">Pricing</NavLink>
            <NavLink to="/help">Help</NavLink>
          </nav>
          <div className="site-actions">
            <Link to="/login" className="site-signin">
              Sign in
            </Link>
            <Link to="/register" className="site-btn site-btn-primary site-btn-sm">
              Start free
            </Link>
          </div>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="site-footer">
        <div className="site-wrap site-footer-inner">
          <div>
            <Brand />
            <p className="site-muted">Property management for independent landlords.</p>
          </div>
          <nav aria-label="Product">
            <h2>Product</h2>
            {FEATURES.map((f) => (
              <Link key={f.slug} to={`/features/${f.slug}`}>
                {f.name}
              </Link>
            ))}
          </nav>
          <nav aria-label="Company">
            <h2>Proppros</h2>
            <Link to="/pricing">Pricing</Link>
            <Link to="/help">Help center</Link>
            <Link to="/login">Sign in</Link>
            <Link to="/register">Start free</Link>
          </nav>
          <nav aria-label="Legal">
            <h2>Legal</h2>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
          </nav>
        </div>
        <div className="site-wrap site-copy">© {new Date().getFullYear()} Proppros</div>
      </footer>
    </div>
  );
}

function Screen({ name, alt, phone, eager }: { name: string; alt: string; phone?: boolean; eager?: boolean }) {
  return (
    <figure className={`site-screen${phone ? " site-screen-phone" : ""}`}>
      {!phone && (
        <div className="site-screen-bar" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      )}
      <img
        src={`/screens/${name}-dark.webp`}
        alt={alt}
        width={phone ? 780 : 2160}
        height={phone ? 1688 : 1350}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={eager ? "high" : "auto"}
      />
      <figcaption>Example data</figcaption>
    </figure>
  );
}

function StartButtons({ secondary = { to: "/pricing", label: "See pricing" } }: { secondary?: { to: string; label: string } | null }) {
  return (
    <div className="site-cta-row">
      <Link to="/register" className="site-btn site-btn-primary">
        Start free
      </Link>
      {secondary && (
        <Link to={secondary.to} className="site-btn site-btn-ghost">
          {secondary.label}
        </Link>
      )}
    </div>
  );
}

function Faq({ items }: { items: readonly { q: string; a: string }[] }) {
  return (
    <div className="site-faq">
      {items.map(({ q, a }) => (
        <details key={q}>
          <summary>{q}</summary>
          <p>{a}</p>
        </details>
      ))}
    </div>
  );
}

function FeatureGrid() {
  return (
    <div className="site-grid">
      {FEATURES.map((f) => {
        const Icon = ICONS[f.icon];
        return (
          <Link key={f.slug} to={`/features/${f.slug}`} className="site-cell">
            <Icon size={20} strokeWidth={1.6} aria-hidden="true" />
            <h3>{f.name}</h3>
            <p>{f.summary}</p>
            <span className="site-more">
              Learn more <ArrowRight size={14} aria-hidden="true" />
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function Pricing({ heading = "h2" }: { heading?: "h1" | "h2" }) {
  const H = heading;
  return (
    <>
      <div className="site-head">
        <p className="site-eyebrow">Pricing</p>
        <H>Start free. Pay per unit later.</H>
        <p className="site-lead">Everything you need to run your rentals is in the Free plan. Paid plans for growing portfolios are coming soon.</p>
      </div>
      <div className="site-plans">
        {PLANS.map((p) => (
          <div key={p.id} className={`site-plan${p.soon ? "" : " site-plan-free"}`}>
            <div className="site-plan-top">
              <h3>{p.name}</h3>
              {p.soon && <span className="site-tag">Coming soon</span>}
            </div>
            <p className="site-price">
              {p.price}
              {p.unit && <span> {p.unit}</span>}
            </p>
            <ul>
              {p.lines.map((l) => (
                <li key={l}>
                  <Check size={15} aria-hidden="true" /> {l}
                </li>
              ))}
            </ul>
            {p.soon ? (
              <p className="site-muted site-plan-note">Available soon.</p>
            ) : (
              <Link to="/register" className="site-btn site-btn-primary site-btn-block">
                Start free
              </Link>
            )}
          </div>
        ))}
      </div>
      <p className="site-muted site-center">Prices in US dollars. No card needed for the Free plan.</p>
    </>
  );
}

function Closing() {
  return (
    <section className="site-section site-closing">
      <div className="site-wrap">
        <h2>{CLOSING.title}</h2>
        <p className="site-lead">{CLOSING.lead}</p>
        <StartButtons secondary={null} />
      </div>
    </section>
  );
}

export function LandingPage() {
  return (
    <MarketingShell>
      <section className="site-hero">
        <div className="site-wrap site-hero-grid">
          <div className="site-hero-copy">
            <p className="site-eyebrow">{HERO.eyebrow}</p>
            <h1>{HERO.title}</h1>
            <p className="site-lead">{HERO.lead}</p>
            <StartButtons />
            <p className="site-note">{HERO.note}</p>
            <div className="site-founder-line">
              <em>{HERO.founder}</em>
              <span>{HERO.founderNote}</span>
            </div>
          </div>
          <Screen name="dashboard" alt="The Proppros dashboard with rent collected, balances due, occupancy and open work orders" eager />
        </div>
        <div className="site-strata" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
      </section>

      <section className="site-section" aria-labelledby="month-title">
        <div className="site-wrap">
          <div className="site-head">
            <p className="site-eyebrow">{MONTH.eyebrow}</p>
            <h2 id="month-title">{MONTH.title}</h2>
            <p className="site-lead">{MONTH.lead}</p>
          </div>
          <ol className="site-timeline">
            {MONTH.steps.map((s) => (
              <li key={s.day} className={`tone-${s.tone}`}>
                <span className="site-dot" aria-hidden="true" />
                <span className="site-day">{s.day}</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
                <span className="site-chip">{s.tag}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="site-section site-alt" aria-labelledby="features-title">
        <div className="site-wrap">
          <div className="site-head">
            <p className="site-eyebrow">Features</p>
            <h2 id="features-title">Run the property, not just the payments.</h2>
            <p className="site-lead">Leases, rent, repairs, vacancies, tenants and reports. One place, one login.</p>
          </div>
          <FeatureGrid />
        </div>
      </section>

      <section className="site-section" aria-labelledby="vacancy-title">
        <div className="site-wrap site-split">
          <div>
            <p className="site-eyebrow">{VACANCY.eyebrow}</p>
            <h2 id="vacancy-title">{VACANCY.title}</h2>
            <p className="site-lead">{VACANCY.lead}</p>
            <ul className="site-checks">
              {VACANCY.points.map((p) => (
                <li key={p}>
                  <Check size={16} aria-hidden="true" /> {p}
                </li>
              ))}
            </ul>
            <Link to="/features/vacancies" className="site-btn site-btn-ghost">
              {VACANCY.cta}
            </Link>
          </div>
          <Screen name="listing-public-phone" alt="A Proppros public listing page on a phone with photos, rent and an Apply button" phone />
        </div>
      </section>

      <section className="site-section site-alt" aria-labelledby="founder-title">
        <div className="site-wrap site-founder">
          <p className="site-eyebrow">{FOUNDER.eyebrow}</p>
          <h2 id="founder-title">{FOUNDER.title}</h2>
          <p className="site-lead">{FOUNDER.body}</p>
        </div>
      </section>

      <section className="site-section" aria-label="Pricing">
        <div className="site-wrap">
          <Pricing />
        </div>
      </section>

      <section className="site-section site-alt" aria-labelledby="faq-title">
        <div className="site-wrap site-narrow">
          <div className="site-head">
            <p className="site-eyebrow">Questions</p>
            <h2 id="faq-title">Frequently asked questions</h2>
          </div>
          <Faq items={FAQ} />
        </div>
      </section>

      <Closing />
    </MarketingShell>
  );
}

export function FeaturesPage() {
  return (
    <MarketingShell>
      <section className="site-hero site-hero-compact">
        <div className="site-wrap site-head">
          <p className="site-eyebrow">Features</p>
          <h1>Everything a landlord does, in one place.</h1>
          <p className="site-lead">Proppros covers the whole rental: from the listing and the lease to rent, repairs and reports.</p>
        </div>
      </section>
      <section className="site-section site-section-tight">
        <div className="site-wrap">
          <FeatureGrid />
        </div>
      </section>
      <Closing />
    </MarketingShell>
  );
}

function FeatureDetail({ feature }: { feature: Feature }) {
  const others = FEATURES.filter((f) => f.slug !== feature.slug);
  const phone = feature.screen.endsWith("phone");
  return (
    <MarketingShell>
      <section className="site-hero site-hero-compact">
        <div className={`site-wrap ${phone ? "site-split" : ""}`}>
          <div className="site-head">
            <p className="site-eyebrow">
              <Link to="/features">Features</Link> / {feature.name}
            </p>
            <h1>{feature.title}</h1>
            <p className="site-lead">{feature.lead}</p>
            <StartButtons secondary={{ to: `/help/${feature.help}`, label: "Read the guide" }} />
          </div>
          {phone && <Screen name={feature.screen} alt={feature.screenAlt} phone eager />}
        </div>
      </section>
      {!phone && (
        <section className="site-section site-section-tight">
          <div className="site-wrap">
            <Screen name={feature.screen} alt={feature.screenAlt} eager />
            {feature.gallery && (
              <div className="site-gallery">
                {feature.gallery.map((g) => (
                  <figure key={g.src}>
                    <img src={g.src} alt={g.alt} width={g.width} height={g.height} loading="lazy" decoding="async" />
                    <figcaption>{g.caption} · Example data</figcaption>
                  </figure>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
      <section className="site-section">
        <div className="site-wrap">
          <div className="site-points">
            {feature.points.map((p) => (
              <div key={p.title}>
                <h2>{p.title}</h2>
                <p>{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="site-section site-alt">
        <div className="site-wrap">
          <div className="site-head">
            <p className="site-eyebrow">More features</p>
            <h2>The rest of your rental, in the same place.</h2>
          </div>
          <div className="site-grid site-grid-compact">
            {others.map((f) => {
              const Icon = ICONS[f.icon];
              return (
                <Link key={f.slug} to={`/features/${f.slug}`} className="site-cell">
                  <Icon size={20} strokeWidth={1.6} aria-hidden="true" />
                  <h3>{f.name}</h3>
                  <p>{f.summary}</p>
                </Link>
              );
            })}
            <Link to="/features" className="site-cell site-cell-all">
              <h3>All features</h3>
              <p>See everything Proppros does, in one list.</p>
              <span className="site-more">
                View all <ArrowRight size={14} aria-hidden="true" />
              </span>
            </Link>
          </div>
        </div>
      </section>
      <Closing />
    </MarketingShell>
  );
}

export function FeaturePage() {
  const { slug } = useParams();
  const feature = FEATURES.find((f) => f.slug === slug);
  if (!feature) return <FeaturesPage />;
  return <FeatureDetail feature={feature} />;
}

export function PricingPage() {
  return (
    <MarketingShell>
      <section className="site-hero site-hero-compact">
        <div className="site-wrap">
          <Pricing heading="h1" />
        </div>
      </section>
      <section className="site-section site-alt">
        <div className="site-wrap site-narrow">
          <div className="site-head">
            <h2>Pricing questions</h2>
          </div>
          <Faq items={FAQ.slice(0, 3)} />
        </div>
      </section>
      <Closing />
    </MarketingShell>
  );
}

export function PublicHelpPage() {
  return (
    <MarketingShell>
      <div className="content marketing-help">
        <HelpPage />
      </div>
    </MarketingShell>
  );
}
