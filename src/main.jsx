import { operator, loadOperator } from "./operator";
import DemoStudio, { DemoGuide } from "./DemoStudio";
import { WindowAvailability } from "./ScheduleBoard";
import CoreyChat from "./CoreyChat.jsx";
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  Package,
  MapPin,
  Clock3,
  ShieldCheck,
  Sparkles,
  X,
  Send,
  Check,
  ShoppingBag,
  Flower2,
  KeyRound,
  CalendarDays,
  Zap,
  Menu,
  Mail,
  CheckCircle2,
} from "lucide-react";
import "./styles.css";
import { api, money } from "./api";
import DeliveryHub, { RecipientTracking } from "./DeliveryHub";
import CourierWorkspace from "./CourierWorkspace";

const services = [
  {
    name: "Expedited",
    icon: Zap,
    title: "A little more urgent?",
    copy: "Priority pickup. A direct trip to their door.",
    note: "Subject to courier availability",
  },
  {
    name: "Same-day",
    icon: Clock3,
    title: "There before the day ends.",
    copy: "For the things that just can’t wait until tomorrow.",
    note: "Within daily service hours",
  },
  {
    name: "Scheduled",
    icon: CalendarDays,
    title: "On your schedule.",
    copy: "Choose a 2–3 hour delivery window that fits your day.",
    note: "Plan ahead, breathe easier",
  },
];
const empty = {
  name: "",
  email: "",
  phone: "",
  pickup: "",
  dropoff: "",
  recipient: "",
  recipientEmail: "",
  item: "Everyday package",
  weight: "",
  service: "Same-day",
  date: "",
  window: "10 a.m.–1 p.m.",
  unattended: false,
};
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
function Logo({ small = false }) {
  return (
    <span className={"logo " + (small ? "logo-small" : "")}>
      <span className="logo-mark">
        <Package size={24} />
        <i />
      </span>
      <span>
        {operator.brand.shortName}
        <small>{operator.brand.descriptor}</small>
      </span>
    </span>
  );
}
function CoreyAvatar() {
  return (
    <span className="corey-avatar">
      <span className="cap" />
      <span className="eyes">••</span>
      <span className="smile" />
    </span>
  );
}
function CityScene() {
  return (
    <div
      className="scene"
      aria-label={`Illustration of a ${operator.brand.shortName} delivery van`}
      role="img"
    >
      <svg viewBox="0 0 600 470" aria-hidden="true">
        <defs>
          <pattern
            id="windows"
            width="23"
            height="23"
            patternUnits="userSpaceOnUse"
          >
            <rect width="8" height="12" x="7" y="6" fill="#bfcef4" />
          </pattern>
        </defs>
        <circle cx="336" cy="233" r="186" fill="#e4ecff" />
        <circle cx="438" cy="97" r="29" fill="#f2d379" />
        <path
          d="M47 346Q192 286 276 330T572 296"
          fill="none"
          stroke="#d1dcf6"
          strokeWidth="44"
        />
        <path
          d="M47 346Q192 286 276 330T572 296"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeDasharray="13 12"
        />
        <path
          d="M142 301V170h65v131M224 301V132h80v169M323 301V95h47v206M388 301V151h72v150M474 301V202h39v99"
          fill="#d0dcf8"
        />
        <path d="M236 132l29-39 27 39M331 95l15-30 16 30" fill="#b0c3ef" />
        <path
          d="M152 298V180h45v118M234 298V143h60v155M333 298V111h27v187M398 298V163h52v135"
          fill="url(#windows)"
        />
        <path
          d="M101 313V253M88 276l13-23 14 23"
          stroke="#799fa2"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <ellipse cx="101" cy="244" rx="23" ry="37" fill="#92b7a5" />
        <path d="M526 304v-58" stroke="#769e8c" strokeWidth="6" />
        <ellipse cx="526" cy="238" rx="20" ry="31" fill="#a9c7b5" />
        <ellipse
          cx="325"
          cy="383"
          rx="159"
          ry="16"
          fill="#163d9e"
          opacity=".12"
        />
        <path d="M173 353V269q0-15 15-15h173v103H173" fill="var(--blue)" />
        <path d="M361 280h52l45 48v29h-97" fill="var(--blue)" />
        <path d="M375 290h32l30 33h-62z" fill="#dce9ff" />
        <path d="M172 348h291v17H172z" fill="#142348" />
        <rect x="439" y="337" width="16" height="8" rx="2" fill="#f3d374" />
        <circle cx="224" cy="364" r="26" fill="#172b51" />
        <circle cx="224" cy="364" r="12" fill="#dbe4f5" />
        <circle cx="405" cy="364" r="26" fill="#172b51" />
        <circle cx="405" cy="364" r="12" fill="#dbe4f5" />
        <text
          x="195"
          y="301"
          fill="white"
          fontSize="23"
          fontFamily="Arial,sans-serif"
          fontWeight="700"
        >
          {operator.brand.shortName}
        </text>
        <text
          x="196"
          y="321"
          fill="#e3c162"
          fontSize="10"
          fontFamily="Arial,sans-serif"
          letterSpacing="4"
        >
          {operator.brand.descriptor}
        </text>
        <path d="M130 386h33v-36h-33z" fill="#d8b677" />
        <path d="M140 350h11v12h-11z" fill="#f0d293" />
        <path d="M70 181q-11-24 5-34t28 6q7 15-17 39z" fill="var(--blue)" />
        <circle cx="84" cy="160" r="5" fill="white" />
        <path
          d="M88 195q-2 44 43 41"
          stroke="var(--gold)"
          strokeWidth="3"
          strokeDasharray="5 7"
          fill="none"
        />
        <path
          d="M475 110l5 9 10 2-7 7 1 10-9-5-9 5 2-10-8-7 11-2z"
          fill="var(--gold)"
        />
      </svg>
      <div className="scene-label">
        <span className="round-icon">
          <MapPin size={18} />
        </span>
        <div>
          Your neighborhood. Our route.
          <small>{operator.coverage.headline}</small>
        </div>
      </div>
      <div className="scene-proof">
        <ShieldCheck size={18} />
        <span>
          A little extra care.
          <br />
          <strong>Every single delivery.</strong>
        </span>
      </div>
    </div>
  );
}
function App() {
  const [page, setPage] = useState(
      new URLSearchParams(window.location.search).has("track")
        ? "tracking"
        : new URLSearchParams(window.location.search).has("demo")
          ? "demo"
          : "home",
    ),
    [step, setStep] = useState(0),
    [data, setData] = useState(empty),
    [chat, setChat] = useState(false),
    [error, setError] = useState(""),
    [verified, setVerified] = useState(false),
    [inbox, setInbox] = useState(false),
    [done, setDone] = useState(false),
    [menu, setMenu] = useState(false);
  const [user, setUser] = useState(null),
    [quote, setQuote] = useState(null),
    [booking, setBooking] = useState(null),
    [verification, setVerification] = useState(null),
    [busy, setBusy] = useState(false),
    [accepted, setAccepted] = useState(false),
    [paymentOutcome, setPaymentOutcome] = useState("approve");
  const [activeDemo, setActiveDemo] = useState(null);
  const navigateDemo = (destination) => {
    setPage(destination);
    setChat(false);
    setMenu(false);
    window.scrollTo(0, 0);
  };
  const acceptDemoUser = (u) => {
    setUser(u);
    setVerified(true);
    setData((d) => ({
      ...d,
      name: u.name,
      email: u.email,
      phone: u.phone,
      pickup: u.pickup,
    }));
  };
  const previousPage = useRef(page);
  useEffect(() => {
    if (previousPage.current !== page)
      document.getElementById("main")?.focus({ preventScroll: true });
    previousPage.current = page;
  }, [page]);
  const bookingKey = useRef(crypto.randomUUID());
  const lastFocus = useRef(null),
    inboxRef = useRef(null);
  const update = (key, value) => {
    setData((d) => ({ ...d, [key]: value }));
    setQuote(null);
    setAccepted(false);
    if (key === "email")
      setVerified(user?.email === value.trim().toLowerCase());
  };
  const start = (service) => {
    if (service) update("service", service);
    setPage("booking");
    setDone(false);
    if (done) {
      setStep(user ? 1 : 0);
      setData({
        ...empty,
        name: user?.name || "",
        email: user?.email || "",
        phone: user?.phone || "",
        pickup: user?.pickup || "",
        ...(service ? { service } : {}),
      });
      setQuote(null);
      setBooking(null);
      setAccepted(false);
      bookingKey.current = crypto.randomUUID();
    }
    setMenu(false);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const goHome = () => {
    window.history.replaceState({}, "", window.location.pathname);
    setPage("home");
    setMenu(false);
    window.scrollTo(0, 0);
  };
  useEffect(() => {
    api("/me")
      .then(({ user }) => {
        setUser(user);
        setVerified(true);
        setData((d) => ({
          ...d,
          name: user.name,
          email: user.email,
          phone: user.phone,
          pickup: user.pickup,
        }));
      })
      .catch((e) => {
        if (e.status !== 401) setError(e.message);
      });
  }, []);
  async function requestVerification() {
    setBusy(true);
    setError("");
    try {
      await api("/auth/request", { method: "POST", body: data });
      setVerification(await api("/auth/inbox"));
      setInbox(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function verifyAccount() {
    setBusy(true);
    try {
      const { user } = await api("/auth/verify", {
        method: "POST",
        body: { token: verification.token },
      });
      setUser(user);
      setVerified(true);
      setInbox(false);
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function getQuote() {
    setBusy(true);
    setError("");
    try {
      const q = await api("/quotes", { method: "POST", body: data });
      setQuote(q);
      setAccepted(false);
      bookingKey.current = crypto.randomUUID();
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function confirmBooking() {
    if (!quote || !accepted) return;
    setBusy(true);
    setError("");
    try {
      const { booking } = await api("/bookings", {
        method: "POST",
        headers: { "Idempotency-Key": bookingKey.current },
        body: { quoteId: quote.id, accepted, paymentOutcome },
      });
      setBooking(booking);
      setDone(true);
      window.scrollTo(0, 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    try {
      await api("/logout", { method: "POST", body: {} });
      setUser(null);
      setActiveDemo(null);
      setVerified(false);
      setData(empty);
      setQuote(null);
      setBooking(null);
      setDone(false);
      setStep(0);
      setPage("home");
    } catch (e) {
      setError(e.message);
    }
  }
  const openChat = () => {
    lastFocus.current = document.activeElement;
    setChat(true);
    setError("");
  };
  useEffect(() => {
    if (!inbox) return;
    const previous = document.activeElement;
    const handler = (e) => {
      if (e.key === "Escape") {
        setInbox(false);
        return;
      }
      if (e.key === "Tab") {
        const items = inboxRef.current?.querySelectorAll("button");
        if (!items?.length) return;
        const first = items[0],
          last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, [inbox]);
  const next = async (e) => {
    e.preventDefault();
    setError("");
    if (step === 0 && !verified) {
      setError(
        "Open the demo inbox and verify your preview account to continue.",
      );
      return;
    }
    if (step === 2 && (Number(data.weight) <= 0 || Number(data.weight) > 50)) {
      setError("Each package must weigh between 0 and 50 pounds, excluding 0.");
      return;
    }
    if (step === 3 && !(await getQuote())) return;
    setStep((s) => Math.min(s + 1, 4));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const field = (key, label, type = "text", placeholder = "") => (
    <label className="field">
      {label}
      <input
        type={type}
        name={key}
        value={data[key]}
        onChange={(e) => {
          update(key, e.target.value);
          if (key === "email") setVerified(false);
        }}
        required
        placeholder={placeholder}
        {...(key === "phone"
          ? {
              pattern: "[0-9+\\(\\) .\\-]{10,}",
              title: "Enter your phone number with area code",
            }
          : {})}
      />
    </label>
  );
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      {operator.hostedDemo && (
        <aside className="hosted-notice">
          Use sample data only. Your temporary workspace is separate from other
          visitors. No real emails, payments or AI requests. Tracking links stay
          within this browser.
        </aside>
      )}
      <div className="preview-strip">
        PORTFOLIO PREVIEW <span>Meet your next everyday delivery.</span>
        <span className="preview-right">
          {operator.hostedDemo
            ? "Public demo · workspace lasts 2 hours"
            : "Local demo · no real deliveries or payments"}
        </span>
      </div>
      <header>
        <div className="nav-wrap">
          <button
            className="brand-button"
            aria-label={`${operator.brand.shortName} home`}
            onClick={goHome}
          >
            <Logo />
          </button>
          <nav className={menu ? "nav-open" : ""} aria-label="Main navigation">
            <a
              href="#how-it-works"
              onClick={() => {
                setPage("home");
                setMenu(false);
              }}
            >
              How it works
            </a>
            <a
              href="#services"
              onClick={() => {
                setPage("home");
                setMenu(false);
              }}
            >
              Our services
            </a>
            <a
              href="#coverage"
              onClick={() => {
                setPage("home");
                setMenu(false);
              }}
            >
              Where we go
            </a>
          </nav>
          <div className="nav-actions">
            <button
              className="text-button"
              onClick={() => {
                if (user) {
                  setPage("deliveries");
                  setMenu(false);
                } else {
                  start();
                  setStep(0);
                }
              }}
            >
              {user ? "My deliveries" : "My account"}
            </button>
            <button className="button compact" onClick={() => start()}>
              Book a delivery <ArrowUpRight size={17} />
            </button>
            <button
              className="icon-button mobile-menu"
              aria-label="Toggle menu"
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              <Menu />
            </button>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        {activeDemo && user && page !== "tracking" && (
          <DemoGuide
            run={activeDemo}
            onNavigate={navigateDemo}
            onExit={() => setActiveDemo(null)}
          />
        )}
        {page === "demo" ? (
          <DemoStudio
            user={user}
            onUser={acceptDemoUser}
            onRun={(r) => {
              setActiveDemo(r);
              window.scrollTo(0, 0);
            }}
            onNavigate={navigateDemo}
            onReset={() => setActiveDemo(null)}
          />
        ) : page === "courier" ? (
          <CourierWorkspace onBack={goHome} />
        ) : page === "tracking" ? (
          <RecipientTracking
            token={new URLSearchParams(window.location.search).get("track")}
            onBack={goHome}
          />
        ) : ["deliveries", "dispatch"].includes(page) ? (
          <DeliveryHub
            key={page}
            mode={page}
            onBack={goHome}
            onBook={() => {
              setData({
                ...empty,
                name: user?.name || "",
                email: user?.email || "",
                phone: user?.phone || "",
                pickup: user?.pickup || "",
              });
              setQuote(null);
              setBooking(null);
              setAccepted(false);
              setDone(false);
              setStep(user ? 1 : 0);
              setPage("booking");
              bookingKey.current = crypto.randomUUID();
              window.scrollTo(0, 0);
            }}
          />
        ) : page === "home" ? (
          <>
            <section className="hero container">
              <div className="hero-copy">
                <div className="eyebrow">
                  <span />
                  LOCAL ROOTS. EVERYDAY ROUTES.
                </div>
                <h1>
                  From your door
                  <br />
                  to <span className="gold-underline">theirs.</span>
                </h1>
                <p>
                  Forgotten keys. Fresh groceries. A gift just because.
                  <br className="desktop-break" /> Whatever your day calls for,
                  we’ll take it from here.
                </p>
                <div className="hero-actions">
                  <button className="button" onClick={() => start()}>
                    Let’s get it delivered <ArrowUpRight size={19} />
                  </button>
                  <button className="button secondary" onClick={openChat}>
                    <Sparkles size={18} /> Book with Corey
                  </button>
                </div>
                <div className="hero-assurance">
                  <span>
                    <Check size={15} /> Personal & small business
                  </span>
                  <span>
                    <Check size={15} /> Door-to-door care
                  </span>
                </div>
              </div>
              <CityScene />
            </section>
            <div className="container demo-entry">
              <span>Take the portfolio for a spin.</span>
              <button
                className="text-button"
                onClick={() => navigateDemo("demo")}
              >
                Explore the guided demo <ArrowRight size={16} />
              </button>
            </div>
            <div className="promise-bar">
              <div className="container promises">
                <span>
                  <MapPin />
                  {operator.coverage.headline}
                </span>
                <span>
                  <Clock3 />
                  Every day, 8 a.m.–8 p.m. ET
                </span>
                <span>
                  <Package />
                  Up to 50 lbs per package
                </span>
                <span>
                  <ShieldCheck />
                  Signature or PIN by default
                </span>
              </div>
            </div>
            <section id="services" className="container section">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">A DELIVERY FOR EVERY KIND OF DAY</p>
                  <h2>Your timing. Our next stop.</h2>
                </div>
                <p>
                  Need it now or a little later?
                  <br />
                  There’s {operator.brand.shortName} for that.
                </p>
              </div>
              <div className="service-grid">
                {services.map(({ name, icon: Icon, title, copy, note }, i) => (
                  <button
                    className={"service-card service-" + i}
                    key={name}
                    onClick={() => start(name)}
                  >
                    <div className="card-top">
                      <span className="service-icon">
                        <Icon size={24} />
                      </span>
                      <span className="service-name">{name}</span>
                      <ArrowUpRight size={21} />
                    </div>
                    <h3>{title}</h3>
                    <p>{copy}</p>
                    <span className="service-note">
                      {note}
                      <ArrowRight size={16} />
                    </span>
                  </button>
                ))}
              </div>
            </section>
            <section className="container everyday">
              <div>
                <p className="eyebrow">BIG HELP. EVERYDAY THINGS.</p>
                <h2>
                  A few things
                  <br />
                  we can take off your hands.
                </h2>
                <p>For your home, your people, or your small business.</p>
              </div>
              <div className="item-grid">
                {[
                  [
                    ShoppingBag,
                    "Ready-to-go groceries",
                    "Prepaid and confirmed ready",
                  ],
                  [
                    Flower2,
                    "Flowers & thoughtful gifts",
                    "A little care goes a long way",
                  ],
                  [
                    KeyRound,
                    "The things you forgot",
                    "Keys, documents, everyday essentials",
                  ],
                  [
                    Package,
                    "Small-business packages",
                    "From your workspace to their doorstep",
                  ],
                ].map(([Icon, title, desc]) => (
                  <div className="item" key={title}>
                    <span>
                      <Icon size={25} />
                    </span>
                    <h3>{title}</h3>
                    <p>{desc}</p>
                  </div>
                ))}
              </div>
              <p className="fine-print">
                No shopping or prepared restaurant meals. Groceries require
                store readiness proof.
              </p>
            </section>
            <section
              id="how-it-works"
              className="container section steps-section"
            >
              <div className="section-heading">
                <div>
                  <p className="eyebrow">LESS RUNNING AROUND</p>
                  <h2>Three steps. One less errand.</h2>
                </div>
              </div>
              <div className="how-grid">
                {[
                  [
                    "Tell us what’s going",
                    "Choose your stops, your package, and your timing. Corey can walk you through it.",
                  ],
                  [
                    "Leave the route to us",
                    `Your approved ${operator.brand.shortName} courier collects your package right at your door.`,
                  ],
                  [
                    "Know when it gets there",
                    "Follow delivery progress and receive confirmation when your package arrives.",
                  ],
                ].map(([title, desc], i) => (
                  <div key={title}>
                    <span className="step-number">0{i + 1}</span>
                    <h3>{title}</h3>
                    <p>{desc}</p>
                  </div>
                ))}
              </div>
            </section>
            <section id="coverage" className="coverage">
              <div className="container coverage-inner">
                <div>
                  <p className="eyebrow">
                    LOCAL KNOW-HOW. A LITTLE MORE REACH.
                  </p>
                  <h2>
                    {operator.coverage.primaryCity}, we’ve got
                    <br />
                    places to be.
                  </h2>
                  <p>
                    From the heart of the city to the neighborhoods
                    <br className="desktop-break" /> you call home. Let’s
                    connect the dots.
                  </p>
                  <button
                    className="button white-button"
                    onClick={() => start()}
                  >
                    Plan your delivery <ArrowUpRight size={18} />
                  </button>
                </div>
                <div className="coverage-cities">
                  <span className="city atlanta">
                    <MapPin size={20} /> {operator.coverage.primaryCity}
                  </span>
                  {operator.coverage.zones
                    .map((zone) => zone[0])
                    .filter((city) => city !== operator.coverage.primaryCity)
                    .map((city) => (
                      <span className="city" key={city}>
                        {city}
                        <ArrowUpRight size={15} />
                      </span>
                    ))}
                  <small>
                    Exact address eligibility is confirmed when booking.
                    <br />
                    This preview does not validate service coverage.
                  </small>
                </div>
              </div>
            </section>
            <section className="container corey-banner">
              <CoreyAvatar />
              <div>
                <p className="eyebrow">MEET YOUR DELIVERY SIDEKICK</p>
                <h2>A little help from Corey.</h2>
                <p>
                  From “can you deliver this?” to “all set.” Start with a
                  conversation.
                </p>
              </div>
              <button className="button" onClick={openChat}>
                Say hello to Corey <Sparkles size={18} />
              </button>
            </section>
          </>
        ) : (
          <section className="container booking-page">
            <button className="back-link" onClick={goHome}>
              <ArrowLeft size={16} /> Back to home
            </button>
            {done ? (
              <div className="success-panel">
                <span className="success-icon">
                  <CheckCircle2 size={38} />
                </span>
                <p className="eyebrow">DEMO BOOKING SAVED · {booking?.id}</p>
                <h1>
                  Your delivery,
                  <br />
                  all mapped out.
                </h1>
                <p>
                  Your demo booking is saved to the backend. No real courier has
                  been dispatched and no money has moved.
                </p>
                <div className="summary-line">
                  <span>{data.service}</span>
                  <strong>{data.item}</strong>
                </div>
                <p>
                  {data.item === "Groceries"
                    ? "Open My deliveries to upload your store pickup confirmation. Demo dispatch reviews it before a courier can be assigned."
                    : "Your simulated payment is authorized. Dispatch can assign an available demo courier, and confirmation messages are saved in your demo inbox."}
                </p>
                <button
                  className="button"
                  onClick={() => {
                    setPage("deliveries");
                  }}
                >
                  View my deliveries <ArrowRight size={17} />
                </button>
              </div>
            ) : (
              <>
                <div className="booking-heading">
                  <p className="eyebrow">ONE LESS THING ON YOUR LIST</p>
                  <h1>Let’s get it there.</h1>
                  <p>A few details, and we’ll take it from here.</p>
                </div>
                <div className="booking-layout">
                  <div className="booking-main">
                    <ol className="progress">
                      {["Account", "Route", "Package", "Timing", "Review"].map(
                        (name, i) => (
                          <li
                            key={name}
                            className={
                              step === i ? "active" : step > i ? "complete" : ""
                            }
                          >
                            <span>
                              {step > i ? <Check size={14} /> : i + 1}
                            </span>
                            {name}
                          </li>
                        ),
                      )}
                    </ol>
                    <form onSubmit={next}>
                      {step === 0 && (
                        <>
                          <h2>Your account, made simple.</h2>
                          <p className="muted">
                            An account keeps your delivery details in one place.
                          </p>
                          <div className="fields">
                            {field("name", "Full name", "text", "Alex Morgan")}
                            {field(
                              "email",
                              "Email address",
                              "email",
                              "you@example.com",
                            )}
                            {field(
                              "phone",
                              "Phone number",
                              "tel",
                              "(404) 555-0123",
                            )}
                            {field(
                              "pickup",
                              "Default pickup address",
                              "text",
                              "Street, city, ZIP code",
                            )}
                          </div>
                          <div className="verification">
                            <Mail size={21} />
                            <div>
                              <strong>
                                {verified
                                  ? "Demo account signed in"
                                  : "Passwordless email verification"}
                              </strong>
                              <p>
                                {verified
                                  ? "Session saved on the server; email ownership is simulated."
                                  : "Open the demo inbox to register or sign in without a password."}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="text-button"
                              disabled={busy}
                              onClick={requestVerification}
                            >
                              Demo inbox <ArrowUpRight size={15} />
                            </button>
                          </div>
                        </>
                      )}
                      {step === 1 && (
                        <>
                          <h2>From your door to theirs.</h2>
                          <p className="muted">
                            One pickup. One destination.{" "}
                            {operator.coverage.headline}.
                          </p>
                          <div className="fields">
                            {field(
                              "pickup",
                              "Pickup address",
                              "text",
                              "Street, city, ZIP code",
                            )}
                            {field(
                              "dropoff",
                              "Delivery address",
                              "text",
                              "Street, city, ZIP code",
                            )}
                            {field(
                              "recipient",
                              "Recipient’s name",
                              "text",
                              "Who’s receiving it?",
                            )}
                            {field(
                              "recipientEmail",
                              "Recipient’s email",
                              "email",
                              "For their tracking link",
                            )}
                          </div>
                          <p className="info-note">
                            <MapPin size={18} /> Demo coverage uses city names.
                            Include a supported city in both addresses:{" "}
                            {operator.coverage.zones
                              .map((zone) => zone[0])
                              .join(", ")}
                            . Real geocoding is not connected.
                          </p>
                        </>
                      )}
                      {step === 2 && (
                        <>
                          <h2>What are we carrying?</h2>
                          <p className="muted">
                            Each package must fit in a car or SUV and be
                            manageable by one courier.
                          </p>
                          <label className="field">
                            Package type
                            <select
                              value={data.item}
                              onChange={(e) => update("item", e.target.value)}
                            >
                              {[
                                "Everyday package",
                                "Flowers or gifts",
                                "Documents or keys",
                                "Small-business order",
                                "Groceries",
                              ].map((v) => (
                                <option key={v}>{v}</option>
                              ))}
                            </select>
                          </label>
                          <label className="field">
                            Package weight in pounds
                            <input
                              name="weight"
                              type="number"
                              min="0.1"
                              max="50"
                              step="0.1"
                              required
                              value={data.weight}
                              onChange={(e) => update("weight", e.target.value)}
                              placeholder="Up to 50 lbs"
                            />
                          </label>
                          {data.item === "Groceries" && (
                            <div className="grocery-note">
                              <strong>
                                Prepaid. Packed. Ready to pick up.
                              </strong>
                              <p>
                                Upload the store’s dated “Ready for pickup”
                                screen. Preparing orders are not eligible for
                                dispatch.
                              </p>
                              <small>
                                After booking, upload the confirmation in My
                                deliveries. You can try a fictional ready or
                                preparing screen. Dispatch stays blocked until a
                                reviewer approves current evidence.
                              </small>
                            </div>
                          )}
                          <label className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={data.unattended}
                              onChange={(e) =>
                                update("unattended", e.target.checked)
                              }
                            />
                            <span>
                              <strong>Allow unattended delivery</strong>
                              <small>
                                Optional for all packages. A delivery photo is
                                required. Otherwise, signature or recipient PIN
                                is required.
                              </small>
                            </span>
                          </label>
                        </>
                      )}
                      {step === 3 && (
                        <>
                          <h2>When should it arrive?</h2>
                          <p className="muted">
                            We deliver every day, 8 a.m.–8 p.m. Eastern.
                          </p>
                          <div className="timing-options">
                            {services.map(({ name, icon: Icon, copy }) => (
                              <label
                                key={name}
                                className={
                                  data.service === name
                                    ? "timing-option selected"
                                    : "timing-option"
                                }
                              >
                                <input
                                  type="radio"
                                  name="service"
                                  checked={data.service === name}
                                  onChange={() => update("service", name)}
                                />
                                <Icon size={23} />
                                <span>
                                  <strong>{name}</strong>
                                  <small>{copy}</small>
                                </span>
                              </label>
                            ))}
                          </div>
                          {data.service === "Scheduled" && (
                            <div className="fields">
                              <label className="field">
                                Delivery date
                                <input
                                  type="date"
                                  min={today()}
                                  required
                                  value={data.date}
                                  onChange={(e) =>
                                    update("date", e.target.value)
                                  }
                                />
                              </label>
                              <label className="field">
                                Delivery window · Eastern
                                <select
                                  value={data.window}
                                  onChange={(e) =>
                                    update("window", e.target.value)
                                  }
                                >
                                  {[
                                    "8–10 a.m.",
                                    "10 a.m.–1 p.m.",
                                    "1–4 p.m.",
                                    "4–6 p.m.",
                                    "6–8 p.m.",
                                  ].map((v) => (
                                    <option key={v}>{v}</option>
                                  ))}
                                </select>
                              </label>
                            </div>
                          )}
                          {data.service === "Scheduled" && (
                            <WindowAvailability
                              date={data.date}
                              selected={data.window}
                            />
                          )}
                          <p className="info-note">
                            <Clock3 size={18} /> Demo quotes use illustrative
                            city-center routes. Scheduled windows reserve sample
                            courier capacity and return time. Same-day and
                            expedited requests enter the dispatch queue;
                            assignment checks shifts and scheduled commitments.
                            No live arrival estimates.
                          </p>
                        </>
                      )}
                      {step === 4 && (
                        <>
                          <h2>A quick look before it goes.</h2>
                          <p className="muted">
                            Confirm a saved demo booking. No real delivery or
                            payment will take place.
                          </p>
                          <div className="review-route">
                            <MapPin />
                            <div>
                              <small>PICKUP</small>
                              <strong>{data.pickup}</strong>
                              <small>
                                DELIVERY TO {data.recipient.toUpperCase()}
                              </small>
                              <strong>{data.dropoff}</strong>
                            </div>
                          </div>
                          <dl className="review-details">
                            <div>
                              <dt>Package</dt>
                              <dd>
                                {data.item} · {data.weight} lbs
                              </dd>
                            </div>
                            <div>
                              <dt>Service</dt>
                              <dd>
                                {data.service}
                                {data.service === "Scheduled" &&
                                  ` · ${data.date} · ${data.window} ET`}
                              </dd>
                            </div>
                            <div>
                              <dt>Handoff</dt>
                              <dd>
                                {data.unattended
                                  ? "Unattended authorized · photo required"
                                  : "Signature or recipient PIN required"}
                              </dd>
                            </div>
                            <div>
                              <dt>Tracking email</dt>
                              <dd>{data.recipientEmail}</dd>
                            </div>
                          </dl>
                          {data.item === "Groceries" && (
                            <p className="grocery-note">
                              Readiness review pending. Upload confirmation in
                              My deliveries after booking; dispatch remains
                              blocked until approval.
                            </p>
                          )}
                          {quote?.schedule && (
                            <p className="info-note">
                              Scheduled capacity will be reserved at
                              confirmation, including{" "}
                              {quote.schedule.returnReserveMinutes} minutes for
                              a possible return. Window: {quote.schedule.date} ·{" "}
                              {quote.schedule.window} Eastern.
                            </p>
                          )}
                          <div className="quote-card">
                            <div className="quote-heading">
                              <strong>Your demo quote</strong>
                              <span>Illustrative rates</span>
                            </div>
                            {quote ? (
                              <>
                                <dl>
                                  {[
                                    ["Base pickup", quote.price.base],
                                    ["Demo distance", quote.price.distance],
                                    ["Demo travel time", quote.price.time],
                                    ["Expedited", quote.price.expedited],
                                  ].map(([label, amount]) => (
                                    <div key={label}>
                                      <dt>{label}</dt>
                                      <dd>{money(amount)}</dd>
                                    </div>
                                  ))}
                                  <div className="quote-total">
                                    <dt>Total authorization</dt>
                                    <dd>{money(quote.price.total)}</dd>
                                  </div>
                                  <div>
                                    <dt>Potential return fee</dt>
                                    <dd>{money(quote.price.returnTotal)}</dd>
                                  </div>
                                </dl>
                                <p>
                                  {quote.price.note} Quote expires at{" "}
                                  {new Date(quote.expires).toLocaleTimeString()}
                                  . No approved commercial rates.
                                </p>
                              </>
                            ) : (
                              <p>Request a fresh quote before confirming.</p>
                            )}
                            <button
                              type="button"
                              className="text-button"
                              disabled={busy}
                              onClick={getQuote}
                            >
                              Refresh quote <ArrowRight size={14} />
                            </button>
                          </div>
                          <label className="field">
                            Demo payment outcome
                            <select
                              value={paymentOutcome}
                              onChange={(e) =>
                                setPaymentOutcome(e.target.value)
                              }
                            >
                              <option value="approve">
                                Approve simulated authorization
                              </option>
                              <option value="decline">
                                Decline simulated authorization
                              </option>
                            </select>
                          </label>
                          <label className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={accepted}
                              onChange={(e) => setAccepted(e.target.checked)}
                            />
                            <span>
                              <strong>
                                I accept this demo quote and the return policy.
                              </strong>
                              <small>
                                Authorization at booking; capture at pickup. A
                                customer-caused return adds the disclosed return
                                fee. No money moves.
                              </small>
                            </span>
                          </label>
                          <details>
                            <summary>Cancellation and return policy</summary>
                            <p>
                              Before pickup, cancellation is free unless your
                              assigned courier is heading to pickup and within 2
                              driving miles. Then only the base pickup fee
                              applies. After pickup, the original charge remains
                              and an applicable return adds distance and time,
                              without another pickup fee or expedited surcharge.
                            </p>
                            <p>
                              If nobody answers for a required handoff, there is
                              no mandatory wait. The courier may contact you for
                              unattended permission. Otherwise, same-day return
                              is the default. Company-caused returns have no
                              additional return charge.
                            </p>
                          </details>
                        </>
                      )}
                      {error && (
                        <p role="alert" className="error">
                          {error}
                        </p>
                      )}
                      <div className="form-actions">
                        {step > 0 ? (
                          <button
                            type="button"
                            className="back-link"
                            onClick={() => {
                              setStep(step - 1);
                              setError("");
                            }}
                          >
                            <ArrowLeft size={16} /> Back
                          </button>
                        ) : (
                          <span />
                        )}
                        {step < 4 ? (
                          <button
                            className="button"
                            type="submit"
                            disabled={busy}
                          >
                            Continue <ArrowRight size={17} />
                          </button>
                        ) : (
                          <button
                            className="button"
                            type="button"
                            disabled={busy || !quote || !accepted}
                            onClick={confirmBooking}
                          >
                            {busy ? "Saving…" : "Confirm demo booking"}{" "}
                            <ArrowRight size={17} />
                          </button>
                        )}
                      </div>
                    </form>
                  </div>
                  <aside className="booking-aside">
                    <CoreyAvatar />
                    <h3>A little help along the way?</h3>
                    <p>
                      I’m Corey, your delivery sidekick. We can work through the
                      details together.
                    </p>
                    <button className="button secondary" onClick={openChat}>
                      Chat with Corey <Sparkles size={17} />
                    </button>
                    <hr />
                    <div className="aside-point">
                      <ShieldCheck />
                      <span>
                        Your handoff, your choice
                        <small>Signature or PIN by default.</small>
                      </span>
                    </div>
                    <div className="aside-point">
                      <Package />
                      <span>
                        Small packages. Big care.
                        <small>Up to 50 lbs per package.</small>
                      </span>
                    </div>
                    <div className="aside-point">
                      <Mail />
                      <span>
                        Keep everyone in the loop
                        <small>Tracking updates by email.</small>
                      </span>
                    </div>
                    <p className="prototype-note">
                      Bookings persist on the backend. Email, payments, routes,
                      and tracking are simulated. Corey is a scripted demo
                      assistant. Please use sample details.
                    </p>
                  </aside>
                </div>
              </>
            )}
          </section>
        )}
      </main>
      <footer className="container">
        <Logo small />
        <span>From your door to theirs.</span>
        <div className="footer-tools">
          <button className="text-button" onClick={() => navigateDemo("demo")}>
            Guided demo
          </button>
          <button
            className="text-button"
            onClick={() => {
              setPage("courier");
              setChat(false);
              window.scrollTo(0, 0);
            }}
          >
            Demo courier
          </button>
          <button
            className="text-button"
            onClick={() => {
              setPage("dispatch");
              window.scrollTo(0, 0);
            }}
          >
            Demo dispatch
          </button>
          {user && (
            <>
              <button
                className="text-button"
                onClick={() => setPage("deliveries")}
              >
                My deliveries
              </button>
              <button className="text-button" onClick={signOut}>
                Sign out
              </button>
            </>
          )}
        </div>
        <small>{operator.brand.name} · Fictional portfolio project</small>
      </footer>
      {!chat && !["courier", "demo"].includes(page) && (
        <button className="floating-corey" onClick={openChat}>
          <Sparkles size={19} /> Ask Corey <span />
        </button>
      )}
      <CoreyChat
        open={chat}
        data={data}
        user={user}
        onClose={() => {
          setChat(false);
          lastFocus.current?.focus();
        }}
        onForm={() => {
          start();
          setChat(false);
        }}
        onDraft={(draft) => {
          setData((d) => ({ ...d, ...draft }));
          setQuote(null);
          setAccepted(false);
        }}
        onUser={(u) => {
          setUser(u);
          setVerified(true);
        }}
      />
      {inbox && (
        <div className="modal-overlay">
          <section
            ref={inboxRef}
            className="inbox-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="inbox-title"
          >
            <button
              autoFocus
              className="icon-button modal-close"
              aria-label="Close inbox"
              onClick={() => setInbox(false)}
            >
              <X />
            </button>
            <Mail size={30} />
            <p className="eyebrow">DEMO INBOX</p>
            <h2 id="inbox-title">Your next stop: verified.</h2>
            <p>To: {data.email}</p>
            <p>
              Hi {data.name.split(" ")[0]}, confirm your email to continue your
              {operator.brand.shortName} delivery.
            </p>
            <button className="button" disabled={busy} onClick={verifyAccount}>
              {busy ? "Verifying…" : "Simulate email verification"}{" "}
              <Check size={17} />
            </button>
            <small>
              No email was sent. This demo link creates a persisted account
              session but does not prove ownership of a real mailbox.
            </small>
          </section>
        </div>
      )}
    </>
  );
}
const root = createRoot(document.getElementById("root"));
root.render(
  <main className="container">
    <p role="status">Loading courier service…</p>
  </main>,
);
loadOperator()
  .then(() => root.render(<App />))
  .catch(() => {
    root.render(
      <main className="container">
        <h1>Service unavailable</h1>
        <p role="alert">
          Company settings could not be loaded. Make sure the backend is
          running, then try again.
        </p>
        <button
          className="button primary"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
      </main>,
    );
  });
