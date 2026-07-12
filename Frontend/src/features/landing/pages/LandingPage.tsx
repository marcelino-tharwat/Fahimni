import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { FaFacebookF, FaInstagram, FaWhatsapp } from 'react-icons/fa';
import {
  Menu,
  X,
  GraduationCap,
  BookOpen,
  FileText,
  FileDown,
  ClipboardCheck,
  Bot,
  Star,
  Play,
  Users,
  Lock,
  PlayCircle,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  MessageCircle,
  Mail,
  Phone,
} from 'lucide-react';
import { useMediaQuery } from '@/shared/hooks/useMediaQuery';
import { useDirection } from '@/shared/hooks/useDirection';
import { cn } from '@/shared/lib/utils/cn';
import { useAppSelector } from '@/shared/store/hooks';
import { dashboardPathByRole, normalizeRole } from '@/features/auth/store/authSlice';

/**
 * Landing CTAs must be auth-aware: a logged-in visitor who returns to the landing
 * page should be sent to their dashboard, not back to /auth (which felt like being
 * asked to log in again). Anonymous visitors still go to /auth.
 */
function useLandingCta() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);
  const target =
    isAuthenticated && user ? dashboardPathByRole[normalizeRole(user.role)] : '/auth';
  return { isAuthenticated, ctaPath: target, goCta: () => navigate(target) };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/** Render numbers with Arabic-Indic digits when the UI is RTL (Arabic). */
function toLocaleDigits(value: number | string, isRtl: boolean): string {
  const str = String(value);
  if (!isRtl) return str;
  return str.replace(/[0-9]/g, (d) => ARABIC_DIGITS[Number(d)]);
}

function scrollToSection(id: string): void {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function LandingPage() {
  const isDesktop = useMediaQuery('(min-width: 768px)');

  return (
    <div className="bg-background flex flex-col scroll-smooth">
      <LandingNavbar />
      <HeroSection />
      <ChaptersSection />
      <FeaturesSection />
      <HowItWorksSection />
      <TestimonialsSection isDesktop={isDesktop} />
      <FAQSection />
      <CTASection isDesktop={isDesktop} />
      <LandingFooter />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Navbar                                                              */
/* ------------------------------------------------------------------ */

const navLinks = [
  { key: 'home', id: 'hero' },
  { key: 'courses', id: 'chapters' },
  { key: 'aiAssistant', id: 'features' },
  { key: 'reviews', id: 'testimonials' },
  { key: 'support', id: 'faq' },
] as const;

/**
 * Navbar-local language toggle. The shared <LanguageSwitcher> is reused by the
 * dashboard Topbar, so we keep this dark-navbar styling local instead of
 * editing the shared component. Behaviour mirrors it: i18next is the single
 * source of truth; the label shows the language clicking switches TO.
 */
function NavLanguageToggle({ className }: { className?: string }) {
  const { i18n } = useTranslation();
  const label = i18n.language === 'ar' ? 'English' : 'العربية';

  return (
    <button
      type="button"
      onClick={() => i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar')}
      className={cn(
        'font-cairo hover:text-navy-900 rounded-md px-3 py-1.5 text-sm font-medium text-white transition-all duration-200 hover:bg-cyan-500',
        className,
      )}
    >
      {label}
    </button>
  );
}

function LandingNavbar() {
  const { t } = useTranslation('landing');
  const { isAuthenticated, goCta } = useLandingCta();
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState('hero');

  const handleNav = (id: string) => {
    setActive(id);
    setMenuOpen(false);
    scrollToSection(id);
  };

  return (
    <header className="bg-navy-900 sticky top-0 z-50 border-b">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
        {/* Right (RTL): hamburger + logo */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={t('nav.home')}
            aria-expanded={menuOpen}
            className="rounded-btn hover:bg-navy-700 p-2 text-white transition-colors md:hidden"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <a
            href="#hero"
            onClick={(e) => {
              e.preventDefault();
              setActive('hero');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="font-cairo flex cursor-pointer items-center gap-2 text-lg font-bold text-white transition-opacity hover:opacity-80 md:text-xl"
          >
            <GraduationCap aria-hidden className="h-6 w-6 text-cyan-500" />
            {t('brand')}
          </a>
        </div>

        {/* Center (desktop): nav links */}
        <div className="hidden items-center gap-7 md:flex">
          {navLinks.map((link) => (
            <button
              key={link.key}
              type="button"
              onClick={() => handleNav(link.id)}
              className={cn(
                'font-cairo text-sm font-medium transition-colors',
                active === link.id
                  ? 'text-cyan-500'
                  : 'text-white hover:text-cyan-500',
              )}
            >
              {t(`nav.${link.key}`)}
            </button>
          ))}
        </div>

        {/* Left (RTL): language + login + subscribe */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex">
            <NavLanguageToggle />
          </div>
          <button
            type="button"
            onClick={goCta}
            className="rounded-btn font-cairo text-navy-800 bg-cyan-500 px-6 py-2 text-sm font-semibold transition-colors hover:bg-cyan-400"
          >
            {isAuthenticated ? t('nav.dashboard') : t('nav.subscribe')}
          </button>
        </div>
      </nav>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="border-navy-700 bg-navy-900 border-t px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <button
                key={link.key}
                type="button"
                onClick={() => handleNav(link.id)}
                className="rounded-btn font-cairo hover:bg-navy-700 px-2 py-2 text-start text-sm font-medium text-white transition-colors hover:text-cyan-500"
              >
                {t(`nav.${link.key}`)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                goCta();
              }}
              className="rounded-btn font-cairo hover:bg-navy-700 px-2 py-2 text-start text-sm font-medium text-white/80 transition-colors hover:text-white"
            >
              {isAuthenticated ? t('nav.dashboard') : t('nav.login')}
            </button>
            <div className="pt-2">
              <NavLanguageToggle className="self-start" />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

function HeroSection() {
  const { t } = useTranslation('landing');
  const isRtl = useDirection() === 'rtl';
  const { goCta: goRegister } = useLandingCta();

  const heroStats = [
    {
      Icon: Users,
      color: 'text-cyan-400',
      value: '147+',
      label: t('hero.stats.activeStudents'),
    },
    {
      Icon: BookOpen,
      color: 'text-purple-400',
      value: '6',
      label: t('hero.stats.chaptersCount'),
    },
    {
      Icon: FileText,
      color: 'text-cyan-400',
      value: '12',
      label: t('hero.stats.contentCount'),
    },
    {
      Icon: Star,
      color: 'text-yellow-400',
      value: '4.9',
      label: t('hero.stats.rating'),
    },
  ];

  return (
    <section
      id="hero"
      className="bg-navy-950 relative min-h-[calc(100dvh-64px)] lg:h-[calc(100dvh-64px)] lg:overflow-hidden"
    >
      {/* Keyframe animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes glowPulse {
          0%, 100% { opacity: 0.1; transform: translateX(-50%) scale(1); }
          50% { opacity: 0.2; transform: translateX(-50%) scale(1.1); }
        }
        .anim-float { animation: float 4s ease-in-out infinite; }
        .anim-fade-up { animation: fadeInUp 0.8s ease-out both; }
        .anim-scale-in { animation: scaleIn 0.9s ease-out both; }
        .anim-glow { animation: glowPulse 3s ease-in-out infinite; }
        .anim-d1 { animation-delay: 0.1s; }
        .anim-d2 { animation-delay: 0.2s; }
        .anim-d3 { animation-delay: 0.3s; }
        .anim-d4 { animation-delay: 0.4s; }
        .anim-d5 { animation-delay: 0.5s; }
        .anim-d6 { animation-delay: 0.6s; }
        .anim-d7 { animation-delay: 0.7s; }
      `}</style>

      {/* Decorative blurred shapes */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      >
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-cyan-500 opacity-5 blur-3xl" />
        <div className="absolute top-1/3 -left-24 h-80 w-80 rounded-full bg-purple-500 opacity-5 blur-3xl" />
        <div className="absolute right-1/4 bottom-0 h-64 w-64 rounded-full bg-cyan-500 opacity-5 blur-3xl" />
      </div>

      {/* ── Flex container fills hero height ── */}
      <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col px-6">
        {/* Main content — fills available space */}
        <div className="flex min-h-0 flex-1 flex-col-reverse items-center justify-center gap-6 lg:flex-row lg:gap-8">
          {/* Text column */}
          <div className="w-full text-center lg:w-1/2 lg:text-start">
            <h1 className="anim-fade-up font-cairo leading-tight">
              <span className="block text-xl font-medium text-white lg:text-4xl">
                {t('hero.headlineLine1')}
              </span>
              <span className="mb-4 block text-xl leading-tight font-extrabold text-cyan-500 lg:text-4xl">
                {t('hero.headlineLine2')}
              </span>
            </h1>

            <p className="anim-fade-up anim-d2 font-cairo text-navy-300 mx-auto mb-3 max-w-lg text-sm leading-relaxed lg:mx-0 lg:text-base">
              {t('hero.subtext')}
            </p>

            {/* Star rating */}
            <div className="anim-fade-up anim-d3 mb-4 flex items-center justify-center gap-1.5 lg:justify-start">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className="h-4 w-4 fill-yellow-400 text-yellow-400"
                />
              ))}
              <span className="font-cairo text-sm font-bold text-white">
                {toLocaleDigits('4.9', isRtl)}
              </span>
              <span className="font-cairo text-navy-400 text-sm">
                {t('hero.ratingCount')}
              </span>
            </div>

            {/* CTAs */}
            <div className="anim-fade-up anim-d4 flex w-full flex-col flex-wrap gap-3 sm:w-auto sm:flex-row sm:justify-center lg:justify-start">
              <button
                type="button"
                onClick={goRegister}
                className="rounded-btn font-cairo text-navy-900 shadow-glow bg-cyan-500 px-6 py-3 text-sm font-semibold transition-all duration-200 hover:scale-105 hover:bg-cyan-400 hover:shadow-lg"
              >
                {t('hero.ctaPrimary')}
              </button>
              <button
                type="button"
                onClick={goRegister}
                className="rounded-btn font-cairo flex items-center justify-center gap-2 border border-white/25 bg-transparent px-6 py-3 text-sm text-white transition-all duration-200 hover:scale-105 hover:border-white/50"
              >
                <Play className="h-4 w-4" />
                {t('hero.ctaSecondary')}
              </button>
            </div>
          </div>

          {/* Teacher image — scales with viewport, lighten blend + soft mask */}
          <div className="flex w-full items-center justify-center lg:w-1/2">
            <div className="anim-scale-in anim-d2 relative mx-auto max-h-[30vh] w-full max-w-[280px] lg:max-h-[55vh] lg:max-w-none">
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-6 z-0 rounded-full"
                style={{
                  background:
                    'radial-gradient(ellipse at 35% 60%, #7c71ed 0%, transparent 70%)',
                  filter: 'blur(100px)',
                }}
              />
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-6 z-0 rounded-full"
                style={{
                  background:
                    'radial-gradient(ellipse at 60% 35%, rgba(124, 58, 237, 0.22) 0%, transparent 70%)',
                  filter: 'blur(100px)',
                }}
              />

              <img
                src="/images/hero.png"
                alt={t('hero.photoAlt')}
                className="anim-float relative z-10 h-full w-full object-contain object-center lg:object-bottom"
                style={{
                  maskImage:
                    'radial-gradient(ellipse 95% 90% at 50% 50%, black 45%, transparent 85%), linear-gradient(to bottom, black 70%, transparent 100%)',
                  WebkitMaskImage:
                    'radial-gradient(ellipse 95% 90% at 50% 50%, black 45%, transparent 85%), linear-gradient(to bottom, black 70%, transparent 100%)',
                  maskComposite: 'intersect',
                  WebkitMaskComposite: 'source-in',
                  // mixBlendMode: 'lighten',
                }}
              />
            </div>
          </div>
        </div>

        {/* ── Stats — pushed to bottom ── */}
        <div className="w-full shrink-0 py-4 lg:pb-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {heroStats.map((stat, index) => (
              <div
                key={stat.label}
                className={cn(
                  'anim-fade-up group border-navy-600/25 bg-navy-800/80 hover:bg-navy-700/60 flex cursor-default items-center gap-3 rounded-2xl border px-3 py-3 transition-all duration-300 hover:-translate-y-1 lg:px-5 lg:py-4',
                  index === 0 && 'anim-d4',
                  index === 1 && 'anim-d5',
                  index === 2 && 'anim-d6',
                  index === 3 && 'anim-d7',
                )}
              >
                <div className="bg-navy-700/50 group-hover:bg-navy-600/50 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-300 lg:h-11 lg:w-11">
                  <stat.Icon
                    className={cn(
                      'h-5 w-5 transition-transform duration-300 group-hover:scale-110',
                      stat.color,
                    )}
                  />
                </div>
                <div className="text-start">
                  <p className="font-cairo text-base leading-tight font-bold text-white transition-colors duration-300 group-hover:text-cyan-400 lg:text-xl">
                    {toLocaleDigits(stat.value, isRtl)}
                  </p>
                  <p className="font-cairo text-navy-400 mt-0.5 text-[11px] leading-tight sm:text-xs">
                    {stat.label}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Chapters                                                            */
/* ------------------------------------------------------------------ */

interface ExploreChapter {
  id: number;
  titleAr: string;
  titleEn: string;
  image: string;
  lessons: number;
  quizzes: number;
  price: number;
  status: 'available' | 'enrolled' | 'locked';
  badge: { ar: string; en: string };
}

const exploreChapters: ExploreChapter[] = [
  {
    id: 1,
    titleAr: 'الكيمياء',
    titleEn: 'Chemistry',
    image: '/images/img1.png',
    lessons: 8,
    quizzes: 3,
    price: 150,
    status: 'available',
    badge: { ar: 'الفصل ١', en: 'Chapter 1' },
  },
  {
    id: 2,
    titleAr: 'الفيزياء',
    titleEn: 'Physics',
    image: '/images/WhatsApp Image 2026-07-12 at 4.31.37 PM.jpeg',
    lessons: 10,
    quizzes: 4,
    price: 150,
    status: 'enrolled',
    badge: { ar: 'الفصل ٢', en: 'Chapter 2' },
  },
  {
    id: 3,
    titleAr: 'الاحياء',
    titleEn: 'Biology',
    image: '/images/2151007461.jpg',
    lessons: 6,
    quizzes: 2,
    price: 200,
    status: 'locked',
    badge: { ar: 'الفصل ٣', en: 'Chapter 3' },
  },
];

const cardDelays = ['anim-d1', 'anim-d2', 'anim-d3'];

function ChaptersSection() {
  const { t } = useTranslation('landing');
  const { goCta } = useLandingCta();
  const isRtl = useDirection() === 'rtl';

  return (
    <section id="chapters" className="bg-navy-50 scroll-mt-16 px-6 py-20">
      <div className="mx-auto max-w-5xl">
        {/* Section title — centered */}
        <div className="mb-12 text-center">
          <h2 className="font-cairo text-navy-800 text-2xl font-bold">
            {t('chapters.title')}
          </h2>
          <p className="font-cairo mt-2 text-base text-gray-600">
            {t('chapters.subtitle')}
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {exploreChapters.map((chapter, index) => {
            const title = isRtl ? chapter.titleAr : chapter.titleEn;
            const locked = chapter.status === 'locked';

            return (
              <div
                key={chapter.id}
                className={cn(
                  'anim-fade-up',
                  cardDelays[index],
                  'group rounded-card shadow-card hover:shadow-elevated mx-auto w-full max-w-[300px] overflow-hidden bg-white transition-all duration-300 hover:-translate-y-2 hover:scale-[1.02]',
                )}
              >
                {/* Thumbnail */}
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={chapter.image}
                    alt={title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="from-navy-900/60 absolute inset-0 bg-gradient-to-t to-transparent" />

                  {/* Stage badge — start-aligned (RTL-aware) */}
                  {/* <span className="rounded-badge bg-navy-700/80 font-cairo absolute start-3 top-3 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
                    {isRtl ? chapter.badge.ar : chapter.badge.en}
                  </span> */}

                  {/* {locked && (
                    <div className="bg-navy-900/50 absolute inset-0 flex items-center justify-center backdrop-blur-[2px]">
                      <Lock className="h-8 w-8 text-white/60" />
                    </div>
                  )} */}
                </div>

                {/* Content */}
                <div className={cn('p-5')}>
                  <h3 className="font-cairo text-navy-800 mb-3 line-clamp-1 text-base font-bold">
                    {title}
                  </h3>

                  {/* <div className="font-cairo mb-4 flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <PlayCircle className="h-3.5 w-3.5" />
                      {toLocaleDigits(chapter.lessons, isRtl)}{' '}
                      {t('chapters.lessons')}
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" />
                      {toLocaleDigits(chapter.quizzes, isRtl)}{' '}
                      {t('chapters.quizzes')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="font-cairo text-navy-800 text-lg font-bold">
                      {toLocaleDigits(chapter.price, isRtl)}{' '}
                      {t('chapters.price')}
                    </span>

                    {chapter.status === 'available' && (
                      <button
                        type="button"
                        onClick={goCta}
                        className="rounded-btn font-cairo text-navy-900 bg-cyan-500 px-4 py-2 text-sm font-semibold transition-all duration-200 hover:scale-105 hover:bg-cyan-400"
                      >
                        {t('chapters.enrollNow')}
                      </button>
                    )}

                    {chapter.status === 'enrolled' && (
                      <span className="rounded-badge font-cairo bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-700">
                        {t('chapters.enrolled')}
                      </span>
                    )}

                    {locked && (
                      <span className="rounded-badge bg-navy-100 font-cairo text-navy-500 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold">
                        <Lock className="h-3 w-3" />
                        {t('chapters.comingSoon')}
                      </span>
                    )}
                  </div> */}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Features                                                            */
/* ------------------------------------------------------------------ */

const featureItems = [
  {
    Icon: PlayCircle,
    titleKey: 'features.videoTitle',
    descKey: 'features.videoDesc',
    iconColor: 'text-pink-500',
    iconBg: 'bg-pink-50',
  },
  {
    Icon: FileDown,
    titleKey: 'features.pdfTitle',
    descKey: 'features.pdfDesc',
    iconColor: 'text-cyan-500',
    iconBg: 'bg-cyan-50',
  },
  {
    Icon: ClipboardCheck,
    titleKey: 'features.quizTitle',
    descKey: 'features.quizDesc',
    iconColor: 'text-purple-500',
    iconBg: 'bg-purple-50',
  },
  {
    Icon: Bot,
    titleKey: 'features.aiTitle',
    descKey: 'features.aiDesc',
    iconColor: 'text-cyan-500',
    iconBg: 'bg-cyan-50',
  },
] as const;

const featureDelays = ['anim-d1', 'anim-d2', 'anim-d3', 'anim-d4'];

function FeaturesSection() {
  const { t } = useTranslation('landing');

  return (
    <section id="features" className="scroll-mt-16 bg-white px-6 py-20">
      <div className="mx-auto max-w-5xl">
        {/* Section title — centered */}
        <div className="mb-14 text-center">
          <h2 className="font-cairo text-navy-800 mb-3 text-2xl font-bold">
            {t('features.title')}
          </h2>
          <p className="font-cairo text-base text-gray-600">
            {t('features.subtitle')}
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {featureItems.map((feature, index) => (
            <div
              key={feature.titleKey}
              className={cn(
                'anim-fade-up',
                featureDelays[index],
                'group rounded-card bg-navy-50 cursor-default border border-gray-100 p-6 text-center transition-all duration-300',
                'hover:shadow-card hover:-translate-y-1 hover:border-cyan-300',
              )}
            >
              <div
                className={cn(
                  'mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110',
                  feature.iconBg,
                )}
              >
                <feature.Icon className={cn('h-7 w-7', feature.iconColor)} />
              </div>
              <h3 className="font-cairo text-navy-800 mb-2 text-base font-bold">
                {t(feature.titleKey)}
              </h3>
              <p className="font-cairo text-sm leading-relaxed text-gray-500">
                {t(feature.descKey)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* How it works                                                        */
/* ------------------------------------------------------------------ */

const howItWorksSteps = [
  {
    num: 1,
    titleKey: 'howItWorks.step1Title',
    descKey: 'howItWorks.step1Desc',
  },
  {
    num: 2,
    titleKey: 'howItWorks.step2Title',
    descKey: 'howItWorks.step2Desc',
  },
  {
    num: 3,
    titleKey: 'howItWorks.step3Title',
    descKey: 'howItWorks.step3Desc',
  },
  {
    num: 4,
    titleKey: 'howItWorks.step4Title',
    descKey: 'howItWorks.step4Desc',
  },
];

const stepDelays = ['anim-d1', 'anim-d2', 'anim-d3', 'anim-d4'];

function HowItWorksSection() {
  const { t } = useTranslation('landing');
  const isRtl = useDirection() === 'rtl';

  return (
    <section className="bg-navy-50 scroll-mt-16 px-6 py-20">
      <div className="mx-auto max-w-4xl">
        {/* Section title — centered */}
        <div className="mb-14 text-center">
          <h2 className="font-cairo text-navy-800 text-2xl font-bold">
            {t('howItWorks.title')}
          </h2>
        </div>

        <div className="relative">
          {/* Connecting dashed line — desktop only, behind the circles */}
          <div
            aria-hidden
            className="absolute top-6 hidden h-0 md:block"
            style={{
              left: '12.5%',
              right: '12.5%',
              width: '75%',
              borderTop: '2px dashed',
              borderColor: '#99EFF5',
            }}
          />

          {/* Steps grid */}
          <div className="grid grid-cols-1 gap-10 md:grid-cols-4 md:gap-6">
            {howItWorksSteps.map((step, index) => (
              <div
                key={step.num}
                className={cn(
                  'anim-fade-up relative text-center',
                  stepDelays[index],
                )}
              >
                {/* Numbered circle */}
                <div className="font-cairo text-navy-900 relative z-10 mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500 text-lg font-bold shadow-[0_0_20px_rgba(0,201,219,0.3)] transition-all duration-300 hover:scale-110 hover:shadow-[0_0_30px_rgba(0,201,219,0.5)]">
                  {toLocaleDigits(step.num, isRtl)}
                </div>

                {/* Mobile connecting line — between steps, not after the last */}
                {index < howItWorksSteps.length - 1 && (
                  <div
                    aria-hidden
                    className="mx-auto mb-5 h-8 w-0 border-r-2 border-dashed border-cyan-200 md:hidden"
                  />
                )}

                {/* Title */}
                <h3 className="font-cairo text-navy-800 mb-2 text-base font-semibold">
                  {t(step.titleKey)}
                </h3>

                {/* Description */}
                <p className="font-cairo mx-auto max-w-[180px] text-sm leading-relaxed text-gray-500">
                  {t(step.descKey)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Testimonials                                                        */
/* ------------------------------------------------------------------ */

interface Testimonial {
  id: number;
  nameAr: string;
  nameEn: string;
  gradeAr: string;
  gradeEn: string;
  quoteAr: string;
  quoteEn: string;
  rating: number;
  initials: { ar: string; en: string };
}

const testimonialsData: Testimonial[] = [
  {
    id: 1,
    nameAr: 'سارة إبراهيم',
    nameEn: 'Sara Ibrahim',
    gradeAr: 'طالبة — الصف الثاني الثانوي',
    gradeEn: 'Grade 11 Student',
    quoteAr:
      'الشرح واضح ومنظم جداً والاختبارات بتساعدني أحدد نقاط ضعفي. الـ AI Tutor بيساعدني في أي وقت محتاجه!',
    quoteEn:
      'The lessons are excellent and easy to understand. I improved from 60% to 92%!',
    rating: 5,
    initials: { ar: 'سا', en: 'SI' },
  },
  {
    id: 2,
    nameAr: 'أحمد ياسر',
    nameEn: 'Ahmed Yasser',
    gradeAr: 'طالب — الصف الثالث الثانوي',
    gradeEn: 'Grade 12 Student',
    quoteAr:
      'أحسن بلاتفورم للكيمياء. الأستاذ أحمد شرحه ممتاز والملخصات وفرت عليا وقت كتير في المراجعة.',
    quoteEn:
      'Mr. Ahmed explains everything in a way that is very simple and amazing. Best chemistry platform!',
    rating: 5,
    initials: { ar: 'أح', en: 'AY' },
  },
  {
    id: 3,
    nameAr: 'نورهان محمد',
    nameEn: 'Nourhan Mohamed',
    gradeAr: 'طالبة — الصف الأول الثانوي',
    gradeEn: 'Grade 10 Student',
    quoteAr:
      'كنت بخاف من الكيمياء بس الشرح المنظم والتدريبات خلوني واثقة في نفسي قبل الامتحان.',
    quoteEn:
      'I used to be scared of Chemistry but the organized lessons gave me confidence before the exam.',
    rating: 5,
    initials: { ar: 'نو', en: 'NM' },
  },
  {
    id: 4,
    nameAr: 'يوسف خالد',
    nameEn: 'Youssef Khaled',
    gradeAr: 'طالب — الصف الثالث الثانوي',
    gradeEn: 'Grade 12 Student',
    quoteAr:
      'الاختبارات الذكية ساعدتني أعرف نقاط ضعفي وأركز عليها. درجاتي اتحسنت بشكل كبير.',
    quoteEn:
      'The smart quizzes helped me identify my weak points and focus on them. My grades improved significantly.',
    rating: 5,
    initials: { ar: 'يو', en: 'YK' },
  },
  {
    id: 5,
    nameAr: 'مريم علي',
    nameEn: 'Mariam Ali',
    gradeAr: 'طالبة — الصف الثاني الثانوي',
    gradeEn: 'Grade 11 Student',
    quoteAr:
      'ملخصات الـ PDF وفرت عليا وقت كتير. بدل ما أكتب ملاحظات، كل حاجة جاهزة ومنظمة.',
    quoteEn:
      'The PDF summaries saved me so much time. Instead of writing notes, everything is ready and organized.',
    rating: 4,
    initials: { ar: 'مر', en: 'MA' },
  },
  {
    id: 6,
    nameAr: 'عمر حسن',
    nameEn: 'Omar Hassan',
    gradeAr: 'طالب — الصف الأول الثانوي',
    gradeEn: 'Grade 10 Student',
    quoteAr:
      'أول مرة أحب الكيمياء! الفيديوهات ممتعة والمساعد الذكي بيجاوب على أي سؤال في ثواني.',
    quoteEn:
      'First time I actually enjoy Chemistry! The videos are fun and the AI tutor answers any question in seconds.',
    rating: 5,
    initials: { ar: 'عم', en: 'OH' },
  },
  {
    id: 7,
    nameAr: 'فاطمة محمود',
    nameEn: 'Fatma Mahmoud',
    gradeAr: 'طالبة — الصف الثالث الثانوي',
    gradeEn: 'Grade 12 Student',
    quoteAr:
      'التدريبات بعد كل درس خلتني أتأكد إني فاهمة صح، والمساعد الذكي بيشرحلي أي نقطة مش واضحة في ثواني.',
    quoteEn:
      'The quizzes after each lesson made sure I really understood, and the AI tutor explains anything unclear in seconds.',
    rating: 5,
    initials: { ar: 'فا', en: 'FM' },
  },
  {
    id: 8,
    nameAr: 'كريم سامح',
    nameEn: 'Karim Sameh',
    gradeAr: 'طالب — الصف الثاني الثانوي',
    gradeEn: 'Grade 11 Student',
    quoteAr:
      'ملخصات الـ PDF منظمة جداً وبحملها على الموبايل وبذاكر منها في أي وقت. وفرت عليا فلوس الدروس الخصوصية.',
    quoteEn:
      'The PDF notes are super organized — I download them on my phone and study anytime. Saved me the cost of private tutoring.',
    rating: 4,
    initials: { ar: 'كر', en: 'KS' },
  },
  {
    id: 9,
    nameAr: 'هنا طارق',
    nameEn: 'Hana Tarek',
    gradeAr: 'طالبة — الصف الأول الثانوي',
    gradeEn: 'Grade 10 Student',
    quoteAr:
      'الفيديوهات قصيرة ومركزة ومفيش وقت بيضيع. أقدر أرجع للدرس أكتر من مرة لحد ما الفكرة تثبت في دماغي.',
    quoteEn:
      'The videos are short and focused with no wasted time. I can rewatch a lesson as many times as I need until it clicks.',
    rating: 4,
    initials: { ar: 'هن', en: 'HT' },
  },
  {
    id: 10,
    nameAr: 'محمود عبد الله',
    nameEn: 'Mahmoud Abdullah',
    gradeAr: 'طالب — الصف الثالث الثانوي',
    gradeEn: 'Grade 12 Student',
    quoteAr:
      'المساعد الذكي غيّر طريقة مذاكرتي بالكامل. بسأله أي سؤال في المنهج وبيجاوبني فوراً زي ما يكون معايا مدرس ٢٤ ساعة.',
    quoteEn:
      'The AI tutor completely changed how I study. I ask it anything in the curriculum and it answers instantly — like having a teacher 24/7.',
    rating: 5,
    initials: { ar: 'مح', en: 'MA' },
  },
];

function TestimonialsSection({ isDesktop }: { isDesktop: boolean }) {
  const { t } = useTranslation('landing');
  const isRtl = useDirection() === 'rtl';

  const visibleCards = isDesktop ? 2 : 1;
  const totalPages = Math.ceil(testimonialsData.length / visibleCards);

  const [currentPage, setCurrentPage] = useState(0);
  const pausedRef = useRef(false);

  // Clamp during render so a breakpoint change (visibleCards shrinks totalPages)
  // can never leave us pointing past the last page.
  const safePage = Math.min(currentPage, totalPages - 1);

  const goNext = () => setCurrentPage((prev) => (prev + 1) % totalPages);
  const goPrev = () =>
    setCurrentPage((prev) => (prev - 1 + totalPages) % totalPages);

  // Autoplay: advance one page every 4s unless paused (hover). Restarts when
  // totalPages changes (desktop/mobile breakpoint).
  useEffect(() => {
    const interval = setInterval(() => {
      if (!pausedRef.current) {
        setCurrentPage((prev) => (prev + 1) % totalPages);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [totalPages]);

  // Each page shifts the track by one full viewport (100%).
  const offset = safePage * 100;

  return (
    <section id="testimonials" className="scroll-mt-16 bg-white px-6 py-20">
      <div className="bg-navy-50 mx-auto max-w-5xl px-4 py-10 md:px-8 md:py-16 lg:px-15 lg:py-15">
        {/* Title */}
        <h2 className="anim-fade-up font-cairo text-navy-800 mb-12 text-center text-2xl font-bold">
          {t('testimonials.title')}
        </h2>

        {/* Carousel wrapper */}
        <div
          className="anim-fade-up anim-d2 relative"
          onMouseEnter={() => {
            pausedRef.current = true;
          }}
          onMouseLeave={() => {
            pausedRef.current = false;
          }}
        >
          {/* Prev arrow (right side in RTL) */}
          <button
            type="button"
            onClick={goPrev}
            aria-label={t('testimonials.prev', 'Previous')}
            className="text-navy-600 shadow-card absolute -start-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white transition-all hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-600 md:-start-12"
          >
            <ChevronRight className={cn('h-5 w-5', !isRtl && 'rotate-180')} />
          </button>

          {/* Next arrow (left side in RTL) */}
          <button
            type="button"
            onClick={goNext}
            aria-label={t('testimonials.next', 'Next')}
            className="text-navy-600 shadow-card absolute -end-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white transition-all hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-600 md:-end-12"
          >
            <ChevronLeft className={cn('h-5 w-5', !isRtl && 'rotate-180')} />
          </button>

          {/* Cards slider */}
          <div className="overflow-hidden rounded-xl">
            <div
              className="flex transition-transform duration-500 ease-in-out"
              style={{ transform: `translateX(${isRtl ? offset : -offset}%)` }}
            >
              {testimonialsData.map((item) => (
                <div
                  key={item.id}
                  className="shrink-0 px-3"
                  style={{ width: `${100 / visibleCards}%` }}
                >
                  {/* Testimonial card */}
                  <div className="rounded-card hover:shadow-card flex h-full flex-col border border-gray-100 bg-white p-6 transition-all duration-300 hover:border-cyan-200">
                    {/* Quote mark */}
                    <div className="mb-3 font-serif text-4xl leading-none text-cyan-500/20">
                      ❝
                    </div>

                    {/* Quote text */}
                    <p className="font-cairo text-navy-700 mb-6 flex-1 text-sm leading-relaxed">
                      {isRtl ? item.quoteAr : item.quoteEn}
                    </p>

                    {/* Divider + author */}
                    <div className="border-t border-gray-100 pt-4">
                      <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div className="bg-navy-100 font-cairo text-navy-600 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold">
                          {isRtl ? item.initials.ar : item.initials.en}
                        </div>

                        {/* Name + grade + stars */}
                        <div className="flex-1">
                          <p className="font-cairo text-navy-800 text-sm font-semibold">
                            {isRtl ? item.nameAr : item.nameEn}
                          </p>
                          <p className="font-cairo text-[11px] text-gray-400">
                            {isRtl ? item.gradeAr : item.gradeEn}
                          </p>
                          <div className="mt-1 flex gap-0.5">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={cn(
                                  'h-3 w-3',
                                  i < item.rating
                                    ? 'fill-yellow-400 text-yellow-400'
                                    : 'fill-gray-200 text-gray-200',
                                )}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dots indicator */}
          <div className="mt-8 flex items-center justify-center gap-2">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrentPage(i)}
                aria-label={`${i + 1}`}
                aria-current={i === safePage}
                className={cn(
                  'h-2 rounded-full transition-all duration-300',
                  i === safePage
                    ? 'w-6 bg-cyan-500'
                    : 'bg-navy-200 hover:bg-navy-300 w-2',
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* FAQ                                                                 */
/* ------------------------------------------------------------------ */

interface FaqItem {
  q: string;
  a: string;
}

function FAQSection() {
  const { t } = useTranslation('landing');
  const items = t('faq.items', { returnObjects: true }) as FaqItem[];
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="bg-navy-50 scroll-mt-16 px-4 py-16 md:py-20">
      <div className="mx-auto max-w-[800px]">
        {/* Title */}
        <h2 className="font-cairo text-navy-800 mb-12 text-center text-2xl font-bold">
          {t('faq.title')}
        </h2>

        <div className="space-y-3">
          {items.map((item, idx) => {
            const open = openIndex === idx;
            return (
              <div
                key={idx}
                className={cn(
                  'group rounded-card border bg-white transition-all duration-300',
                  open
                    ? 'shadow-card border-cyan-300'
                    : 'hover:shadow-card border-gray-100 hover:scale-[1.02] hover:border-cyan-200',
                )}
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(open ? null : idx)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-4 p-5 text-start"
                >
                  <span
                    className={cn(
                      'font-cairo text-base font-bold transition-colors duration-200',
                      open
                        ? 'text-cyan-600'
                        : 'text-navy-800 group-hover:text-cyan-600',
                    )}
                  >
                    {item.q}
                  </span>
                  <div
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-300',
                      open
                        ? 'rotate-180 bg-cyan-500 text-white'
                        : 'bg-navy-50 text-navy-400 group-hover:bg-cyan-50 group-hover:text-cyan-500',
                    )}
                  >
                    <ChevronDown size={18} />
                  </div>
                </button>

                {/* Answer — animated open/close */}
                <div
                  className={cn(
                    'grid transition-all duration-300 ease-in-out',
                    open
                      ? 'grid-rows-[1fr] opacity-100'
                      : 'grid-rows-[0fr] opacity-0',
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="border-t border-gray-100 px-5 pt-3 pb-5">
                      <p className="font-cairo text-sm leading-relaxed text-gray-600">
                        {item.a}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Final CTA                                                           */
/* ------------------------------------------------------------------ */

function CTASection({ isDesktop }: { isDesktop: boolean }) {
  const { t } = useTranslation('landing');
  const { goCta } = useLandingCta();

  return (
    <section className="bg-cta-gradient relative overflow-hidden px-4 py-16 md:py-20">
      {/* Decorative shapes */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-cyan-500 opacity-5 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-purple-500 opacity-5 blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center text-center">
        <h2 className="font-cairo text-2xl font-bold text-white md:text-3xl">
          {t('cta.title')}
        </h2>
        <p className="font-cairo text-navy-300 mt-3 text-base">
          {t('cta.subtitle')}
        </p>
        <button
          type="button"
          onClick={goCta}
          className={cn(
            'rounded-btn font-cairo text-navy-900 shadow-glow mt-8 bg-cyan-500 px-10 py-4 text-lg font-bold transition-all duration-300 hover:scale-105 hover:bg-cyan-400 hover:shadow-[0_0_30px_rgba(0,201,219,0.4)]',
            !isDesktop && 'w-full',
          )}
        >
          {t('cta.btn')}
        </button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Footer                                                              */
/* ------------------------------------------------------------------ */
function LandingFooter() {
  const { t } = useTranslation('landing');
  const curriculumLinks = t('footer.curriculumLinks', {
    returnObjects: true,
  }) as string[];

  return (
    <footer className="bg-navy-950 px-4 py-12">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-8 text-center md:flex-row md:justify-between md:text-start">
          {/* Brand */}
          <div className="md:max-w-xs">
            <span className="font-cairo text-xl font-bold text-cyan-500">
              {t('brand')}
            </span>
            <p className="font-cairo text-navy-300 mt-2 text-sm">
              {t('footer.academyName')}
            </p>
            <p className="font-cairo text-navy-400 mt-1 text-xs">
              {t('footer.platformDesc')}
            </p>
            {/* Social icons */}
            <div className="mt-4 flex justify-center gap-3 md:justify-start">
              <a
                href="#"
                aria-label="Facebook"
                className="bg-navy-800 text-navy-300 hover:text-navy-900 flex h-9 w-9 items-center justify-center rounded-full transition-all duration-300 hover:bg-cyan-500"
              >
                <FaFacebookF size={14} />
              </a>
              <a
                href="#"
                aria-label="Instagram"
                className="bg-navy-800 text-navy-300 hover:text-navy-900 flex h-9 w-9 items-center justify-center rounded-full transition-all duration-300 hover:bg-cyan-500"
              >
                <FaInstagram size={14} />
              </a>
              <a
                href="#"
                aria-label="WhatsApp"
                className="bg-navy-800 text-navy-300 hover:text-navy-900 flex h-9 w-9 items-center justify-center rounded-full transition-all duration-300 hover:bg-cyan-500"
              >
                <FaWhatsapp size={14} />
              </a>
            </div>
          </div>

          {/* Curriculum */}
          <div>
            <h4 className="font-cairo mb-3 text-sm font-bold text-white">
              {t('footer.curriculum')}
            </h4>
            <ul className="flex flex-col gap-2.5">
              {curriculumLinks.map((link) => (
                <li key={link}>
                  <a
                    href="#chapters"
                    className="font-cairo text-navy-400 text-sm transition-colors duration-200 hover:text-cyan-400"
                  >
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Important links */}
          <div>
            <h4 className="font-cairo mb-3 text-sm font-bold text-white">
              {t('footer.importantLinks')}
            </h4>
            <ul className="flex flex-col gap-2.5">
              <li>
                <a
                  href="#faq"
                  className="font-cairo text-navy-400 text-sm transition-colors duration-200 hover:text-cyan-400"
                >
                  {t('footer.faqLink')}
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="font-cairo text-navy-400 text-sm transition-colors duration-200 hover:text-cyan-400"
                >
                  {t('footer.contactUs')}
                </a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-cairo mb-3 text-sm font-bold text-white">
              {t('footer.contactUs')}
            </h4>
            <ul className="flex flex-col gap-2.5">
              <li className="flex items-center justify-center gap-2 md:justify-start">
                <Mail size={14} className="text-cyan-500" />
                <span className="font-cairo text-navy-400 text-sm">
                  info@fahimni.com
                </span>
              </li>
              <li className="flex items-center justify-center gap-2 md:justify-start">
                <Phone size={14} className="text-cyan-500" />
                <span className="font-cairo text-navy-400 text-sm">
                  01012345678
                </span>
              </li>
              <li className="flex items-center justify-center gap-2 md:justify-start">
                <MessageCircle size={14} className="text-cyan-500" />
                <a
                  href="#"
                  className="font-cairo text-navy-400 text-sm transition-colors duration-200 hover:text-cyan-400"
                >
                  {t('footer.whatsapp')}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-navy-800 mt-10 border-t pt-6 text-center">
          <p className="font-cairo text-navy-500 text-xs">
            {t('footer.copyright')}
          </p>
        </div>
      </div>
    </footer>
  );
}
