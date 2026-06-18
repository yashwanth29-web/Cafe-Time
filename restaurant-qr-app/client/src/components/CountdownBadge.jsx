import React, { useState, useEffect } from 'react';

const CountdownBadge = ({ initialSeconds = 5, onTrigger, label = "Refreshing in" }) => {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          if (onTrigger) {
            onTrigger();
          }
          return initialSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [initialSeconds, onTrigger]);

  return (
    <span className="px-3 py-1 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 text-xs font-semibold rounded-full border border-amber-200 dark:border-amber-900 transition-colors">
      {label} {seconds}s
    </span>
  );
};

export default React.memo(CountdownBadge);
