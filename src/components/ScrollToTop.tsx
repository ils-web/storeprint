import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

export const ScrollToTop: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.pageYOffset > 250 || document.documentElement.scrollTop > 250) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', toggleVisibility, { passive: true });
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  if (!isVisible) return null;

  return (
    <button
      onClick={scrollToTop}
      aria-label="חזרה לראש הדף"
      title="חזרה לראש הדף"
      className="fixed bottom-6 left-6 z-40 bg-gradient-to-tr from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white p-3.5 sm:p-4 rounded-2xl shadow-xl shadow-sky-600/30 flex items-center justify-center transition-all duration-300 transform active:scale-90 hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-sky-400 cursor-pointer animate-fadeIn"
    >
      <ArrowUp className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
      <span className="sr-only">חזרה למעלה</span>
    </button>
  );
};
