// import { useState } from 'react';
// import { useTranslation } from 'react-i18next';
// import { useNavigate } from 'react-router-dom';
// import {
//   Star,
//   Play,
//   GraduationCap,
//   Menu,
//   X,
//   Users,
//   BookOpen,
//   ClipboardCheck,
// } from 'lucide-react';
// import { cn } from '@/shared/lib/utils/cn';
// import { useDirection } from '@/shared/hooks/useDirection';

// const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

// function toLocaleDigits(value: number | string, isRtl: boolean): string {
//   const str = String(value);
//   if (!isRtl) return str;
//   return str.replace(/[0-9]/g, (d) => ARABIC_DIGITS[Number(d)]);
// }

// /* ── Nav links ── */
// const navLinks = [
//   { key: 'Home', id: 'hero' },
//   { key: 'Courses', id: 'courses' },
//   { key: 'AI Tutor', id: 'ai-tutor' },
//   { key: 'Practice Exams', id: 'exams' },
//   { key: 'Reviews', id: 'reviews' },
//   { key: 'Contact', id: 'contact' },
// ] as const;

// /* ── Background chemical decorations ── */
// function ChemicalBackground() {
//   return (
//     <div
//       aria-hidden
//       className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
//     >
//       {/* Molecular cluster */}
//       <svg
//         className="absolute top-8 left-[6%] h-36 w-36 text-purple-400 opacity-[0.04]"
//         viewBox="0 0 100 100"
//         fill="none"
//         stroke="currentColor"
//         strokeWidth="1.2"
//       >
//         <circle cx="50" cy="50" r="6" />
//         <circle cx="50" cy="28" r="6" />
//         <circle cx="50" cy="72" r="6" />
//         <circle cx="72" cy="50" r="6" />
//         <circle cx="28" cy="50" r="6" />
//         <line x1="50" y1="34" x2="50" y2="44" />
//         <line x1="50" y1="56" x2="50" y2="66" />
//         <line x1="56" y1="50" x2="66" y2="50" />
//         <line x1="34" y1="50" x2="44" y2="50" />
//       </svg>

//       {/* Hexagon structure */}
//       <svg
//         className="absolute top-4 right-[10%] h-40 w-40 text-purple-300 opacity-[0.04]"
//         viewBox="0 0 100 100"
//         fill="none"
//         stroke="currentColor"
//         strokeWidth="1.2"
//       >
//         <polygon points="50,8 82,27 82,63 50,82 18,63 18,27" />
//         <circle cx="50" cy="44" r="14" />
//       </svg>

//       {/* Electron orbital */}
//       <svg
//         className="absolute top-24 left-[20%] h-24 w-24 text-cyan-400 opacity-[0.03]"
//         viewBox="0 0 100 100"
//         fill="none"
//         stroke="currentColor"
//         strokeWidth="1"
//       >
//         <ellipse cx="50" cy="40" rx="22" ry="8" transform="rotate(-25 50 40)" />
//         <ellipse cx="50" cy="40" rx="22" ry="8" transform="rotate(25 50 40)" />
//         <ellipse cx="50" cy="40" rx="22" ry="8" transform="rotate(90 50 40)" />
//         <circle cx="50" cy="40" r="3" fill="currentColor" />
//       </svg>

//       {/* Chemical formula labels */}
//       <svg
//         className="absolute top-28 right-[18%] h-16 w-20 text-cyan-300 opacity-[0.04]"
//         viewBox="0 0 80 40"
//         fill="none"
//       >
//         <text
//           x="0"
//           y="28"
//           fill="currentColor"
//           fontSize="20"
//           fontFamily="serif"
//           fontWeight="600"
//         >
//           H₂SO₄
//         </text>
//       </svg>

//       <svg
//         className="absolute top-5 left-[38%] h-14 w-20 text-purple-300 opacity-[0.03]"
//         viewBox="0 0 80 40"
//         fill="none"
//       >
//         <text
//           x="0"
//           y="28"
//           fill="currentColor"
//           fontSize="16"
//           fontFamily="serif"
//           fontWeight="600"
//         >
//           C₆H₁₂O₆
//         </text>
//       </svg>
//     </div>
//   );
// }

// /* ── Navigation Bar ── */
// function Navbar() {
//   const { t, i18n } = useTranslation('landing');
//   const navigate = useNavigate();
//   const [menuOpen, setMenuOpen] = useState(false);
//   const [active, setActive] = useState('hero');

//   const langLabel = i18n.language === 'ar' ? 'English' : 'العربية';

//   const handleNav = (id: string) => {
//     setActive(id);
//     setMenuOpen(false);
//     document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
//   };

//   return (
//     <>
//       <nav className="absolute top-0 left-0 z-50 flex w-full items-center justify-between px-6 py-5 md:px-12 md:py-6">
//         {/* Logo */}
//         <a
//           href="#hero"
//           onClick={(e) => {
//             e.preventDefault();
//             setActive('hero');
//             window.scrollTo({ top: 0, behavior: 'smooth' });
//           }}
//           className="font-cairo flex items-center gap-2 text-lg font-bold text-white transition-opacity hover:opacity-80 md:text-xl"
//         >
//           <GraduationCap aria-hidden className="h-6 w-6 text-cyan-500" />
//           {t('brand')}
//         </a>

//         {/* Desktop nav links */}
//         <div className="hidden items-center gap-8 md:flex">
//           {navLinks.map((link) => (
//             <button
//               key={link.key}
//               type="button"
//               onClick={() => handleNav(link.id)}
//               className={cn(
//                 'font-cairo text-sm font-medium transition-all duration-200',
//                 active === link.id
//                   ? 'text-white underline decoration-cyan-500 decoration-2 underline-offset-4'
//                   : 'text-gray-400 hover:text-white',
//               )}
//             >
//               {link.key}
//             </button>
//           ))}
//         </div>

//         {/* Right-side actions */}
//         <div className="flex items-center gap-3">
//           <button
//             type="button"
//             onClick={() =>
//               i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar')
//             }
//             className="font-cairo rounded-full border border-white/20 px-4 py-1.5 text-xs font-medium text-white/80 transition-all duration-200 hover:border-white/40 hover:text-white md:text-sm"
//           >
//             {langLabel} <span className="ml-1">🌐</span>
//           </button>

//           <button
//             type="button"
//             onClick={() => navigate('/auth')}
//             className="rounded-btn font-cairo text-navy-900 bg-white px-5 py-2 text-xs font-semibold transition-all duration-200 hover:bg-gray-100 md:text-sm"
//           >
//             Login
//           </button>

//           <button
//             type="button"
//             onClick={() => navigate('/auth')}
//             className="rounded-btn font-cairo text-navy-900 bg-cyan-500 px-5 py-2 text-xs font-semibold transition-all duration-200 hover:bg-cyan-400 md:text-sm"
//           >
//             {t('nav.subscribe')}
//           </button>

//           <button
//             type="button"
//             onClick={() => setMenuOpen((o) => !o)}
//             aria-label="Menu"
//             aria-expanded={menuOpen}
//             className="rounded-btn p-2 text-white transition-colors hover:bg-white/10 md:hidden"
//           >
//             {menuOpen ? <X size={22} /> : <Menu size={22} />}
//           </button>
//         </div>
//       </nav>

//       {/* Mobile dropdown */}
//       {menuOpen && (
//         <div className="bg-navy-900/80 absolute top-full left-0 z-50 w-full px-6 py-4 backdrop-blur-md md:hidden">
//           <div className="flex flex-col gap-2">
//             {navLinks.map((link) => (
//               <button
//                 key={link.key}
//                 type="button"
//                 onClick={() => handleNav(link.id)}
//                 className={cn(
//                   'rounded-btn font-cairo w-full px-3 py-2 text-start text-sm font-medium transition-colors hover:bg-white/10',
//                   active === link.id
//                     ? 'text-cyan-400'
//                     : 'text-white/80 hover:text-white',
//                 )}
//               >
//                 {link.key}
//               </button>
//             ))}
//           </div>
//         </div>
//       )}
//     </>
//   );
// }

// /* ── Stat Card ── */
// interface StatCardProps {
//   icon: React.ComponentType<{ className?: string }>;
//   value: string;
//   label: string;
//   iconColor: string;
//   delay: string;
// }

// function StatCard({
//   icon: Icon,
//   value,
//   label,
//   iconColor,
//   delay,
// }: StatCardProps) {
//   return (
//     <div
//       className={cn(
//         'group flex cursor-default items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.08] sm:px-5',
//         delay,
//       )}
//     >
//       <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 transition-all duration-300 group-hover:bg-white/15">
//         <Icon
//           className={cn(
//             'h-5 w-5 transition-transform duration-300 group-hover:scale-110',
//             iconColor,
//           )}
//         />
//       </div>
//       <div>
//         <p className="font-cairo text-xl leading-tight font-bold text-white transition-colors duration-300 group-hover:text-cyan-400">
//           {value}
//         </p>
//         <p className="font-cairo mt-0.5 text-xs leading-tight text-gray-400">
//           {label}
//         </p>
//       </div>
//     </div>
//   );
// }

// /* ── Hero Section (exported) ── */
// export function HeroSection() {
//   const { t } = useTranslation('landing');
//   const navigate = useNavigate();
//   const isRtl = useDirection() === 'rtl';

//   const stats = [
//     {
//       Icon: Users,
//       value: '147+',
//       label: 'Active Students',
//       color: 'text-purple-400',
//     },
//     {
//       Icon: BookOpen,
//       value: '6',
//       label: 'Complete Chapters',
//       color: 'text-blue-400',
//     },
//     {
//       Icon: ClipboardCheck,
//       value: '12',
//       label: 'Quizzes',
//       color: 'text-cyan-400',
//     },
//     {
//       Icon: Star,
//       value: '4.9',
//       label: 'Student Rating',
//       color: 'text-yellow-400',
//     },
//   ];

//   const delays = ['', '', '', ''];

//   return (
//     <section className="bg-hero-gradient relative h-dvh overflow-hidden">
//       <style>{`
//         @keyframes float {
//           0%, 100% { transform: translateY(0); }
//           50% { transform: translateY(-12px); }
//         }
//         .anim-float { animation: float 4s ease-in-out infinite; }
//       `}</style>

//       <ChemicalBackground />
//       <Navbar />

//       {/* Main content */}
//       <div className="relative z-10 mx-auto flex h-full max-w-7xl flex-col px-6">
//         <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 lg:flex-row lg:gap-12">
//           {/* Left column — Text & CTAs */}
//           <div className="flex w-full flex-col items-center text-center lg:w-1/2 lg:items-start lg:text-start">
//             <div className="font-cairo mb-5 inline-flex items-center rounded-full bg-teal-500/10 px-3 py-1 text-xs font-semibold text-teal-400">
//               Grade 12
//             </div>

//             <h1 className="font-cairo mb-4 text-3xl leading-tight font-extrabold md:text-5xl lg:text-6xl">
//               <span className="text-white">Mr. Ahmed's </span>
//               <br />
//               <span className="text-cyan-500">Chemistry</span>
//               <span className="text-white"> Academy</span>
//             </h1>

//             <p className="font-cairo mb-6 max-w-lg text-sm leading-relaxed text-gray-400 md:text-base">
//               Master Chemistry for your national exams with interactive lessons,
//               quizzes and AI tutoring.
//             </p>

//             <div className="mb-8 flex items-center gap-2">
//               <div className="flex gap-0.5">
//                 {Array.from({ length: 5 }).map((_, i) => (
//                   <Star
//                     key={i}
//                     className="h-4 w-4 fill-yellow-400 text-yellow-400"
//                   />
//                 ))}
//               </div>
//               <span className="font-cairo text-sm font-bold text-yellow-400">
//                 4.9
//               </span>
//               <span className="font-cairo text-sm text-gray-500">
//                 (120+ Reviews)
//               </span>
//             </div>

//             <div className="flex flex-wrap gap-4">
//               <button
//                 type="button"
//                 onClick={() => navigate('/auth')}
//                 className="rounded-btn font-cairo text-navy-900 bg-cyan-500 px-7 py-3 text-sm font-bold shadow-[0_0_20px_rgba(0,201,219,0.3)] transition-all duration-200 hover:scale-105 hover:bg-cyan-400 hover:shadow-[0_0_30px_rgba(0,201,219,0.5)]"
//               >
//                 Start Learning Now
//               </button>
//               <button
//                 type="button"
//                 onClick={() => navigate('/auth')}
//                 className="rounded-btn font-cairo flex items-center gap-2 border border-white/20 bg-white/5 px-7 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:border-white/40 hover:bg-white/10"
//               >
//                 <Play className="h-4 w-4" />
//                 Watch Free Lesson
//               </button>
//             </div>
//           </div>

//           {/* Right column — Instructor Image */}
//           <div className="flex w-full items-center justify-center lg:w-1/2">
//             <div className="relative max-h-[50vh] w-full lg:max-h-[60vh]">
//               <img
//                 src="/images/hero.png"
//                 alt="Mr. Ahmed Mohamed"
//                 className="h-full w-full object-contain object-bottom drop-shadow-[0_0_60px_rgba(139,92,246,0.2)]"
//                 style={{
//                   maskImage:
//                     'linear-gradient(to bottom, black 60%, transparent 100%), radial-gradient(ellipse 70% 85% at 70% 35%, black 55%, transparent 80%)',
//                   WebkitMaskImage:
//                     'linear-gradient(to bottom, black 60%, transparent 100%), radial-gradient(ellipse 70% 85% at 70% 35%, black 55%, transparent 80%)',
//                   maskComposite: 'intersect',
//                   WebkitMaskComposite: 'intersect',
//                 }}
//               />
//               <div
//                 aria-hidden
//                 className="pointer-events-none absolute -bottom-4 left-1/2 h-28 w-3/4 -translate-x-1/2 rounded-full bg-purple-500/10 blur-3xl"
//               />
//             </div>
//           </div>
//         </div>

//         {/* Stats cards */}
//         <div className="w-full shrink-0 pb-6">
//           <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
//             {stats.map((stat, index) => (
//               <StatCard
//                 key={stat.label}
//                 icon={stat.Icon}
//                 value={toLocaleDigits(stat.value, isRtl)}
//                 label={stat.label}
//                 iconColor={stat.color}
//                 delay={delays[index] || ''}
//               />
//             ))}
//           </div>
//         </div>
//       </div>
//     </section>
//   );
// }
