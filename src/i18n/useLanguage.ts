import { useState, useEffect } from 'react';
import type { Lang } from './translations';

// Countries where Spanish is an official language
const SPANISH_COUNTRIES = new Set([
  'AR','BO','CL','CO','CR','CU','DO','EC','SV','GT','HN',
  'MX','NI','PA','PY','PE','PR','ES','UY','VE','GQ',
]);

const STORAGE_KEY = 'ebookpro_lang';

function detectFromBrowser(): Lang {
  const nav = navigator.language || (navigator as any).userLanguage || '';
  return nav.startsWith('es') ? 'es' : 'pt';
}

export function useLanguage(): { lang: Lang; setLang: (l: Lang) => void } {
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (stored === 'pt' || stored === 'es') return stored;
    // Instant browser-language fallback while we wait for IP
    return detectFromBrowser();
  });

  useEffect(() => {
    // If already persisted by a previous choice, no need to hit the IP API
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'pt' || stored === 'es') return;

    // Detect via IP (free, no API key needed, ~1 req/s limit is fine)
    fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then((data: { country_code?: string }) => {
        const detected: Lang = SPANISH_COUNTRIES.has(data.country_code || '') ? 'es' : 'pt';
        localStorage.setItem(STORAGE_KEY, detected);
        setLangState(detected);
      })
      .catch(() => {
        // Network error — keep browser-language detection, persist it
        const fallback = detectFromBrowser();
        localStorage.setItem(STORAGE_KEY, fallback);
        setLangState(fallback);
      });
  }, []);

  const setLang = (l: Lang) => {
    localStorage.setItem(STORAGE_KEY, l);
    setLangState(l);
  };

  return { lang, setLang };
}
