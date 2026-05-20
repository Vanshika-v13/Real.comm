export const applyTheme = (theme) => {
  if (typeof window === 'undefined') return;

  const root = document.documentElement;
  

  let activeTheme = theme === 'light' ? 'light' : 'dark';

  if (activeTheme === 'light') {
    root.classList.replace('dark', 'light');
    if (!root.classList.contains('light')) root.classList.add('light');
    root.style.colorScheme = 'light';
  } else {
    root.classList.replace('light', 'dark');
    if (!root.classList.contains('dark')) root.classList.add('dark');
    root.style.colorScheme = 'dark';
  }
};
