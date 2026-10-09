// Your links, in one place.
// Paste a URL between the quotes and every matching button on the site and the resume appears.
// Leave one empty ('') and its buttons stay hidden, so the site never shows "coming soon".
window.SITE_LINKS = {
  linkedin: '',                                // e.g. 'https://www.linkedin.com/in/your-name/'
  github: 'https://github.com/Burthcer',
  email: 'mailto:dev.bhamaria@gmail.com'
};

document.querySelectorAll('[data-link]').forEach(a => {
  const url = window.SITE_LINKS[a.dataset.link];
  if (url) a.href = url; else a.remove();
});
