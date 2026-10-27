/**
 * EasyEarn file note: Handles the help page behavior and related user interactions.
 */
// help page scripts
document.addEventListener('DOMContentLoaded', () => {
  const openBtn = document.querySelector('.open-floating-chat');
  if (openBtn) {
    // Connects this element event to the handler that should run next.
    openBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const chatWindow = document.getElementById('chatbot-window');
      if (chatWindow) {
        chatWindow.classList.remove('hidden');
      }
    });
  }
});
