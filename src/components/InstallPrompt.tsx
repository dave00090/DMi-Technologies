import React, { useState, useEffect } from 'react';

export const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Check if already installed
    window.addEventListener('appinstalled', () => {
      setDeferredPrompt(null);
      setIsVisible(false);
      console.log('PWA was installed');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
    
    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 md:bottom-4 md:left-auto md:right-4 md:w-80 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-2xl border border-indigo-500/20 z-[9999] animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-2xl">📱</span>
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-gray-900 dark:text-white">Download DMi Technologies POS</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Install this app on your phone or PC for a faster, offline experience.
          </p>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleInstall}
              className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20"
            >
              Install Now
            </button>
            <button
              onClick={() => setIsVisible(false)}
              className="px-4 py-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors text-sm"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
