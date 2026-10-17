document.addEventListener('DOMContentLoaded', () => {
  const faqButtons = document.querySelectorAll('.faq-item button');
  faqButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const item = button.parentElement;
      item.classList.toggle('active');
    });
  });

  const menuButton = document.querySelector('.menu-button');
  const navLinks = document.querySelector('.nav-links');
  if (menuButton && navLinks) {
    menuButton.addEventListener('click', () => {
      navLinks.classList.toggle('mobile-open');
      navLinks.style.display = navLinks.classList.contains('mobile-open') ? 'flex' : '';
    });
  }
});
