const form = document.querySelector('#login-form');
const message = document.querySelector('#message');
const token = document.querySelector('#token');
const submit = document.querySelector('.connect');

document.querySelector('#reveal').addEventListener('click', () => {
  token.type = token.type === 'password' ? 'text' : 'password';
});

window.mediator.loadCredentials().then((saved) => {
  if (!saved) return;
  document.querySelector('#owner').value = saved.owner;
  document.querySelector('#repo').value = saved.repo;
  token.value = saved.token;
  document.querySelector('#remember').checked = true;
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.textContent = '';
  submit.disabled = true;
  submit.querySelector('span').textContent = 'Securing connection…';
  try {
    const result = await window.mediator.connect({
      owner: document.querySelector('#owner').value,
      repo: document.querySelector('#repo').value,
      token: token.value,
      remember: document.querySelector('#remember').checked
    });
    message.style.color = '#78eeb0';
    message.textContent = `${result.restored ? 'Workspace restored from' : 'Bridge initialized in'} ${result.repository}.`;
    submit.querySelector('span').textContent = 'Workspace connected';
  } catch (error) {
    message.style.color = '#ff9f9f';
    message.textContent = error.message || 'Could not connect to this repository.';
    submit.disabled = false;
    submit.querySelector('span').textContent = 'Connect workspace';
  }
});
