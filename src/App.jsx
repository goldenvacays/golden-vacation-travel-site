import React, { useMemo, useState, useEffect } from "react";

/*********************************
 * GLOBAL CONSTANTS (declare first)
 *********************************/
// Safer placeholder: tiny transparent PNG (avoids React parsing SVG strings)
const PLACEHOLDER_IMG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/axhS10AAAAASUVORK5CYII=";

// Neutral shoreline fallback (no wave) when hosted images can't load
const NEUTRAL_SHORELINE_URL =
  "https://images.unsplash.com/photo-1526481280698-8fcc13fd6632?q=80&w=1600&auto=format&fit=crop";

// Hero / section images — hosted and reliable
const HERO_SRC =
  "https://alg.widen.net/img/alg/2uhr4klkan/1024px@1x/ZOMBJ-JR-OV-SO-TER-NL.webp?q=80"; // Hero image
const BOOKING_SRC =
  "https://www.travelandleisure.com/thmb/sxjMTvEDiQMp0-e_uSdxOWnFvv4=/2000x1330/filters:no_upscale():max_bytes(150000):strip_icc():format(webp)/TAL-overwater-villa-interior-princess-senses-mangrove-NEWALLINCJAMCA0325-e1871c05755041aeaa070a8e27837cc0.jpg"; // Booking image
const CONTACT_SRC =
  "https://jamaica.moonpalace.com/xxlarge_luxury_activities_moon_palace_jamaica_cd3557d65c.webp"; // Contact image

// Additional Jamaica shots we may fall back to
const JAMAICA_IMAGES = [HERO_SRC, BOOKING_SRC, CONTACT_SRC];

// Alt text constants so diagnostics can reference them
const ALT_HERO = "Overwater villa — Montego Bay, Jamaica (hero image)";
const ALT_BOOKING = "Princess Senses Mangrove — overwater villa interior (booking showcase)";
const ALT_CONTACT = "Moon Palace Jamaica — activities & overwater (contact image)";

/*********************************
 * HELPERS
 *********************************/
// Sanitize phone number with validation
function sanitizePhone(phone) {
  const cleaned = phone.replace(/[^\d]/g, "");
  if (cleaned.length < 7 || cleaned.length > 15) {
    console.warn('Invalid phone number length');
    return "1876XXXXXXX"; // fallback
  }
  return cleaned;
}

// Sanitize user messages (XSS protection)
function sanitizeMessage(msg) {
  return msg
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .trim();
}

function buildWA(message, phone = "1876XXXXXXX") {
  const text = encodeURIComponent(sanitizeMessage(message));
  const num = sanitizePhone(phone);
  return `https://api.whatsapp.com/send?phone=${num}&text=${text}`;
}

// Improved WhatsApp deep-link with better fallback chain
function openWhatsApp(message, phone = "1876XXXXXXX", where = "unknown") {
  try { track('wa_click', { where }); } catch (_) {}
  const text = encodeURIComponent(sanitizeMessage(message));
  const num = sanitizePhone(phone);
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
  
  if (isMobile) {
    // Try app first, fallback to wa.me with increased timeout
    window.location.href = `whatsapp://send?phone=${num}&text=${text}`;
    setTimeout(() => {
      window.location.href = `https://wa.me/${num}?text=${text}`;
    }, 1500);
  } else {
    // Desktop: Always use web.whatsapp.com for better reliability
    const web = `https://web.whatsapp.com/send?phone=${num}&text=${text}`;
    const win = window.open(web, '_blank', 'noopener,noreferrer');
    if (!win) window.location.href = web;
  }
}

// Simplified telephone link
function openTel(phone = "1876XXXXXXX", where = 'cta') {
  try { track('call_click', { where }); } catch (_) {}
  window.location.href = `tel:+${sanitizePhone(phone)}`;
}

/*********************************
 * UI PRIMITIVES
 *********************************/
// Lightweight SEO head manager (title/description/keywords + LocalBusiness JSON‑LD)
function HeadMeta({ title, description, keywords }) {
  useEffect(() => {
    document.title = title;
    const ensure = (sel, attr, val) => {
      let el = document.querySelector(sel);
      if (!el) { el = document.createElement('meta'); if (sel.includes('name=')) { el.setAttribute('name', sel.match(/name=\"(.+?)\"/)[1]); } if (sel.includes('property=')) { el.setAttribute('property', sel.match(/property=\"(.+?)\"/)[1]); } document.head.appendChild(el); }
      el.setAttribute(attr, val);
    };
    // Basic metas
    ensure('meta[name="description"]', 'content', description);
    ensure('meta[name="keywords"]', 'content', keywords);
    // Open Graph / Twitter
    ensure('meta[property="og:title"]', 'content', title);
    ensure('meta[property="og:description"]', 'content', description);
    ensure('meta[property="og:type"]', 'content', 'website');
    ensure('meta[property="og:url"]', 'content', window.location.href);
    ensure('meta[property="og:image"]', 'content', HERO_SRC);
    ensure('meta[name="twitter:card"]', 'content', 'summary_large_image');
    ensure('meta[name="twitter:title"]', 'content', title);
    ensure('meta[name="twitter:description"]', 'content', description);
    ensure('meta[name="twitter:image"]', 'content', HERO_SRC);
    // Canonical
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) { link = document.createElement('link'); link.setAttribute('rel','canonical'); document.head.appendChild(link); }
    link.setAttribute('href', window.location.href);
    // JSON‑LD for LocalBusiness + FAQ
    const ld = {
      '@context': 'https://schema.org', '@type': 'LocalBusiness',
      name: 'Golden Vacation & Travel Limited',
      areaServed: ['Jamaica','Caribbean','USA','Canada','UK'],
      address: { '@type': 'PostalAddress', addressLocality: 'Kingston', addressCountry: 'JM' },
      telephone: '+1 876 210 6242', email: 'goldentravellers@outlook.com',
      knowsAbout: [
        'Jamaica hotels','Montego Bay hotels','Ocho Rios hotels','Negril hotels',
        'Sandals Resorts','Beaches Resorts','Hyatt Zilara/Ziva','Iberostar','RIU',
        'Moon Palace Jamaica','Secrets Resorts','Breathless','Excellence Resorts',
        'Half Moon','Couples Resorts','Bahia Principe','S Hotel Jamaica','H10 Ocean Eden Bay'
      ]
    };
    let script = document.getElementById('gv-jsonld');
    if (!script) { script = document.createElement('script'); script.id='gv-jsonld'; script.type='application/ld+json'; document.head.appendChild(script); }
    script.textContent = JSON.stringify(ld);
    
    // FAQ Schema
    const faqSchema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'What hotels do you book in Jamaica?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'We book all major Jamaica hotels including Sandals, Beaches, Hyatt Zilara/Ziva, Iberostar, RIU, Moon Palace, Secrets, Half Moon, Couples, and more.'
          }
        },
        {
          '@type': 'Question',
          name: 'How do I book with Golden Vacation & Travel?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'You can book via WhatsApp, phone, or email. Our WhatsApp booking is the fastest - just fill the form and send your details.'
          }
        },
        {
          '@type': 'Question',
          name: 'Are you IATA accredited?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes, Golden Vacation & Travel Limited is IATA accredited, ensuring professional standards and reliable service.'
          }
        }
      ]
    };
    let faqScript = document.getElementById('gv-faq-jsonld');
    if (!faqScript) { faqScript = document.createElement('script'); faqScript.id='gv-faq-jsonld'; faqScript.type='application/ld+json'; document.head.appendChild(faqScript); }
    faqScript.textContent = JSON.stringify(faqSchema);
  }, [title, description, keywords]);
  return null; // render nothing
}

// Analytics (Plausible) + event helper
function Analytics() {
  useEffect(() => {
    if (document.getElementById('plausible-script')) return;
    const s = document.createElement('script');
    s.id = 'plausible-script';
    s.defer = true;
    s.setAttribute('data-domain', window.location.hostname);
    s.src = 'https://plausible.io/js/script.tagged-events.js';
    document.head.appendChild(s);
  }, []);
  return null; // render nothing
}

function track(name, props = {}) {
  try {
    if (window && typeof window.plausible === 'function') {
      window.plausible(name, { props });
    }
  } catch (_) {}
}

// Utils: copy to clipboard (with fallback)
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    alert('Copied to clipboard');
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); alert('Copied to clipboard'); } catch (_) {}
    document.body.removeChild(ta);
  }
}

function LinkFallback({ label, url }) {
  return (
    <div className="text-xs text-slate-600 mt-1">
      If the button is blocked here, use: <a href={url} target="_blank" rel="noopener noreferrer" className="underline text-[#0057D9]">{label}</a>
      <button onClick={() => copyToClipboard(url)} className="ml-2 underline text-[#0057D9]">Copy</button>
    </div>
  );
}

const Container = ({ children, className = "" }) => (
  <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>
);

const Button = ({ as: Tag = "button", className = "", children, ...props }) => (
  <Tag
    className={`inline-flex items-center justify-center rounded-2xl px-5 py-3 font-semibold shadow-lg hover:shadow-xl transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0057D9] ${className}`}
    {...props}
  >
    {children}
  </Tag>
);

const SectionTitle = ({ eyebrow, title, subtitle }) => (
  <div className="text-center space-y-3">
    {eyebrow && (
      <div className="text-xs tracking-[0.2em] uppercase text-[#0047B5]/90">{eyebrow}</div>
    )}
    <h2 className="text-3xl md:text-4xl font-bold text-slate-900">{title}</h2>
    {subtitle && <p className="text-slate-600 max-w-2xl mx-auto">{subtitle}</p>}
  </div>
);

const Badge = ({ children }) => (
  <span className="inline-flex items-center gap-2 rounded-full border border-[#BFD6FF] bg-[#FFF7CC] px-3 py-1 text-xs font-medium text-[#0047B5]">
    {children}
  </span>
);

// Resilient image that tries multiple sources with loading state
const SmartImg = ({ sources = [], alt = "", className = "", ...imgProps }) => {
  const [idx, setIdx] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const src = sources[idx] || PLACEHOLDER_IMG;
  const loadingProp = imgProps.loading ?? 'lazy';
  
  return (
    <div className="relative">
      {loading && (
        <div className="absolute inset-0 bg-slate-100 animate-pulse rounded-inherit" />
      )}
      <img
        src={src}
        alt={alt}
        className={className}
        loading={loadingProp}
        decoding="async"
        onLoad={() => setLoading(false)}
        onError={() => {
          if (idx < sources.length - 1) {
            setIdx((i) => i + 1);
          } else {
            setLoading(false);
          }
        }}
        {...imgProps}
      />
    </div>
  );
};

/*********************************
 * MAIN APP
 *********************************/
// Error Boundary for production resilience
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  
  componentDidCatch(error, errorInfo) {
    console.error('App error:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-white">
          <div className="text-center max-w-md">
            <div className="text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold mb-4 text-slate-900">Something went wrong</h1>
            <p className="text-slate-600 mb-6">We're sorry for the inconvenience. Please try refreshing the page.</p>
            <Button onClick={() => window.location.reload()} className="bg-[#0057D9] text-white">
              Reload Page
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function GoldenVacaysSiteInner() {
  // Simple path+hash router (supports /privacy, /terms, or hash fallbacks)
  const getRoute = () => {
    if (typeof window === 'undefined') return 'home';
    const h = (window.location.hash || '').replace('#','');
    const p = window.location.pathname || '/';
    if (p === '/privacy' || h === 'privacy') return 'privacy';
    if (p === '/terms' || h === 'terms') return 'terms';
    return 'home';
  };
  const [route, setRoute] = useState(() => getRoute());
  useEffect(() => {
    const onChange = () => setRoute(getRoute());
    window.addEventListener('popstate', onChange);
    window.addEventListener('hashchange', onChange);
    return () => { window.removeEventListener('popstate', onChange); window.removeEventListener('hashchange', onChange); };
  }, []);
  const navigate = (to) => {
    if (typeof window === 'undefined') return;
    if (to.startsWith('/')) {
      window.history.pushState({}, '', to);
      setRoute(getRoute());
      try { window.dispatchEvent(new PopStateEvent('popstate')); } catch (_) {}
    } else {
      window.location.hash = to;
    }
  };

  // Render legal pages when #privacy or #terms
  if (route === 'privacy') {
    return (
      <>
        <HeadMeta
          title="Privacy Policy — Golden Vacation & Travel"
          description="How Golden Vacation & Travel collects, uses, and protects your information."
          keywords="privacy, data protection, GDPR, Jamaica travel agency"
        />
        <LegalLayout>
          <PrivacyPage />
        </LegalLayout>
      </>
    );
  }
  if (route === 'terms') {
    return (
      <>
        <HeadMeta
          title="Terms & Conditions — Golden Vacation & Travel"
          description="Booking terms, payments, cancellations, and responsibilities for Golden Vacation & Travel."
          keywords="terms, conditions, booking policy, cancellations"
        />
        <LegalLayout>
          <TermsPage />
        </LegalLayout>
      </>
    );
  }
  const [menuOpen, setMenuOpen] = useState(false);

  // Replace with your real WhatsApp number (digits only, e.g., 1876XXXXXXXX)
  const waNumber = "18762106242";

  const quickQuoteMessage = useMemo(
    () =>
      `Hi Golden Vacation & Travel! I'd like a quote.\n\nName: \nDestination: \nCheck-in: \nCheck-out: \nGuests: \nNotes:`,
    []
  );

  // Editable reviews
  const REVIEWS = [
    {
      quote:
        "It was memorable and I do thank you & your team for putting everything together! 🎉",
      name: "Azul Beach Resort",
      meta: "Couples' getaway • Ocean view",
    },
    {
      quote:
        "Good afternoon—time well spent, thanks again for your good work! 🥰😍",
      name: "Dreams Rose Hall",
      meta: "Family‑friendly • Relaxing & romantic",
    },
    {
      quote:
        "Thank you for being my trusted agency. Next year we're doing it again!",
      name: "Iberostar Selection Suites",
      meta: "Repeat guest • Montego Bay",
    }
  ];

  return (
    <>
      <HeadMeta
        title="Golden Vacation & Travel — Jamaica Hotels, Sandals, Hyatt Zilara, Iberostar, RIU & More"
        description="IATA‑accredited Jamaican travel agency. WhatsApp‑first bookings for Jamaica hotels & packages — Sandals, Beaches, Hyatt Zilara/Ziva, Iberostar, RIU, Moon Palace, Secrets, Half Moon, Couples & more."
        keywords="Jamaica hotels, Montego Bay hotels, Ocho Rios hotels, Negril resorts, Sandals Jamaica, Beaches Negril, Hyatt Zilara Rose Hall, Iberostar Rose Hall, RIU Ocho Rios, Moon Palace Jamaica, Secrets St. James, Breathless Montego Bay, Excellence Oyster Bay, Half Moon, Couples Swept Away, Bahia Principe, S Hotel, Ocean Eden Bay"
      />
      <Analytics />
      <div className="min-h-screen font-sans text-slate-800 bg-white">
        {/* NAVBAR */}
        <header className="sticky top-0 z-40 backdrop-blur bg-white/70 border-b border-[#D9E7FF]/60">
          <Container className="flex items-center justify-between h-16">
            {/* Brand */}
            <a href="#home" className="flex items-center gap-3 group">
              <div className="h-9 w-9 rounded-2xl bg-gradient-to-tr from-[#FFC300] via-[#1E90FF] to-[#00B2FF] grid place-items-center text-white font-black">G</div>
              <div className="leading-tight">
                <div className="font-extrabold tracking-tight text-slate-900">Golden Vacation & Travel</div>
                <div className="text-[10px] uppercase tracking-wider text-[#0047B5]/80">IATA Accredited</div>
              </div>
            </a>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-8">
              <a href="#home" className="hover:text-[#0057D9]">Home</a>
              <a href="#about" className="hover:text-[#0057D9]">About</a>
              <a href="#booking" className="hover:text-[#0057D9]">WhatsApp Booking</a>
              <a href="#reviews" className="hover:text-[#0057D9]">Reviews</a>
              <a href="#contact" className="hover:text-[#0057D9]">Contact</a>
            </nav>

            {/* CTA (desktop) */}
            <div className="hidden md:flex items-center gap-2">
              <Button
                as="a"
                href={"https://wa.me/"+waNumber+"?text="+encodeURIComponent("Hi Golden Vacation & Travel! I'd like to chat about a trip.")}
                onClick={(e) => { e.preventDefault(); openWhatsApp("Hi Golden Vacation & Travel! I'd like to chat about a trip.", waNumber, 'chat_cta'); }}
                target="_blank"
                rel="noreferrer"
                aria-label="Chat with us on WhatsApp"
                className="bg-[#0057D9] text-white"
              >
                Chat on WhatsApp
              </Button>
              <Button 
                as="a" 
                href={`tel:+${waNumber}`} 
                onClick={(e) => { e.preventDefault(); openTel(waNumber, 'cta'); }} 
                aria-label="Call Golden Vacation & Travel"
                className="bg-white border border-[#BFD6FF] text-[#0057D9]"
              >
                Call us
              </Button>
            </div>

            {/* Mobile menu button */}
            <button
              aria-label="Toggle navigation menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#BFD6FF] text-[#0057D9]"
            >
              {menuOpen ? <span className="text-xl">✕</span> : <span className="text-xl">☰</span>}
            </button>
          </Container>

          {/* Mobile Nav Drawer */}
          {menuOpen && (
            <div className="md:hidden border-t border-[#D9E7FF] bg-white">
              <Container className="py-3 flex flex-col gap-3">
                {[
                  { href: "#home", label: "Home" },
                  { href: "#about", label: "About" },
                  { href: "#booking", label: "WhatsApp Booking" },
                  { href: "#reviews", label: "Reviews" },
                  { href: "#contact", label: "Contact" },
                ].map((i) => (
                  <a
                    key={i.label}
                    href={i.href}
                    onClick={() => setMenuOpen(false)}
                    className="py-2 text-slate-700 hover:text-[#0057D9]"
                  >
                    {i.label}
                  </a>
                ))}
                <Button
                  as="a"
                  href={"https://wa.me/"+waNumber+"?text="+encodeURIComponent("Hi Golden Vacation & Travel! I'd like to chat about a trip.")}
                  onClick={(e) => { e.preventDefault(); openWhatsApp("Hi Golden Vacation & Travel! I'd like to chat about a trip.", waNumber, 'chat_cta'); }}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Chat with us on WhatsApp"
                  className="bg-[#0057D9] text-white mt-2"
                >
                  Chat on WhatsApp
                </Button>
              </Container>
            </div>
          )}
        </header>

        {/* HERO */}
        <section id="home" className="relative overflow-hidden">
          <div
            className="absolute inset-0 -z-10"
            aria-hidden="true"
            style={{
              background:
                "radial-gradient(1200px 600px at 20% -10%, rgba(0,87,217,0.16), transparent 60%), radial-gradient(900px 500px at 100% 0%, rgba(255,195,0,0.22), transparent 55%), linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
            }}
          />
          <Container className="py-20 md:py-28 grid md:grid-cols-2 gap-10 items-center">
            <div className="space-y-6">
              <Badge><span className="text-xs">Trusted by 1,000+ Caribbean travelers</span></Badge>
              <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-slate-900">
                Caribbean & International escapes, crafted by <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FFC300] via-[#1E90FF] to-[#00B2FF]">Golden Vacation & Travel</span>
              </h1>
              <p className="text-lg text-slate-700 max-w-xl">
                Jamaican, IATA-accredited travel professionals. We design seamless stays, premium flights, and unforgettable moments, so you can simply arrive and exhale.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  as="a" 
                  href={"https://wa.me/"+waNumber+"?text="+encodeURIComponent(quickQuoteMessage)} 
                  onClick={(e) => { e.preventDefault(); openWhatsApp(quickQuoteMessage, waNumber, 'hero_quote'); }} 
                  target="_blank" 
                  rel="noreferrer" 
                  aria-label="Get a quote via WhatsApp"
                  className="bg-[#0057D9] text-white"
                >
                  Get a WhatsApp Quote
                </Button>
                <Button as="a" href="#about" aria-label="Learn why to choose us" className="bg-white border border-[#BFD6FF] text-[#0057D9]">Why Choose Us</Button>
              </div>
              <LinkFallback label="Open WhatsApp" url={"https://wa.me/"+waNumber+"?text="+encodeURIComponent(quickQuoteMessage)} />
              <div className="flex flex-wrap gap-2 pt-2">
                <Badge>✓ IATA Accredited</Badge>
                <Badge>✓ Secure Payments</Badge>
                <Badge>✓ Wide range of hotels</Badge>
                <Badge>✓ Customer First</Badge>
              </div>
            </div>

            <div className="relative">
              <div className="aspect-[4/3] rounded-3xl shadow-2xl overflow-hidden ring-1 ring-[#D9E7FF]">
                <SmartImg
                  loading="eager" fetchPriority="high"
                  sources={[
                    HERO_SRC,
                    // local (preview) backups if available
                    "/mnt/data/39ac928b-9ed6-46c7-806b-c502ee560861.png",
                    "/mnt/data/f19ad132-5c9c-4b41-8afd-f5ad75f3f576.png",
                    ...JAMAICA_IMAGES,
                    NEUTRAL_SHORELINE_URL,
                    PLACEHOLDER_IMG,
                  ]}
                  alt={ALT_HERO}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="absolute -bottom-6 -left-4 bg-white/80 backdrop-blur rounded-2xl shadow-xl p-4 border-[#D9E7FF]">
                <div className="text-xs text-slate-600 mb-1">Featured Destinations</div>
                <div className="font-semibold">Montego Bay • Ocho Rios • Panama City • Punta Cana</div>
              </div>
            </div>
          </Container>
        </section>

        {/* ABOUT */}
        <section id="about" className="py-20 border-t border-[#D9E7FF]">
          <Container>
            <SectionTitle eyebrow="ABOUT GOLDEN VACATION & TRAVEL" title="Caribbean expertise. Global standards." subtitle="We blend local insight with international best practices to deliver worry‑free luxury escapes." />

            <div className="mt-12 grid md:grid-cols-3 gap-6">
              {[
                { title: "IATA Accredited", text: "Your bookings are handled with professional standards, airline credibility, and robust supplier partnerships.", icon: "✈️" },
                { title: "Concierge‑Level Care", text: "From airport to hotel to excursions, we curate details (anniversaries, upgrades, transfers) so you can relax.", icon: "🤝" },
                { title: "Easy Reservations for Hotels & Packages", text: "Book hotel rooms or bundled packages quickly via WhatsApp. Minimal forms, instant updates, and clear confirmations.", icon: "🏨" },
              ].map((c) => (
                <div key={c.title} className="rounded-2xl border border-[#D9E7FF] bg-white p-6 shadow-sm">
                  <div className="text-3xl">{c.icon}</div>
                  <h3 className="mt-4 text-xl font-semibold text-slate-900">{c.title}</h3>
                  <p className="mt-2 text-slate-600">{c.text}</p>
                </div>
              ))}
            </div>
          </Container>
        </section>

        {/* WHATSAPP BOOKING FORM */}
        <section id="booking" className="py-20 bg-gradient-to-b from-[#FFF9E6] to-white">
          <Container>
            <SectionTitle eyebrow="BOOK IN MINUTES" title="Start your WhatsApp booking" subtitle="Tell us the basics. Our team will reply with tailored options within minutes during business hours." />
            <WhatsAppForm waNumber={waNumber} />
          </Container>
        </section>

        {/* REVIEWS */}
        <section id="reviews" className="py-20">
          <Container>
            <SectionTitle eyebrow="REVIEWS" title="Loved by our

            }
            
