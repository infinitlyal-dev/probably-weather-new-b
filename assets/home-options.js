// DESIGN BRANCH ONLY — the proposed Home directions (launch eval step 4, 2026-09-24).
// Loaded by app.js only when the URL carries ?home=a|b|c. Everything here is scoped to
// body.home-a / .home-b / .home-c, so today's Home is untouched without the parameter.
//
//   a  Tidy       — today's layout, with the things that make it feel off fixed
//   b  More meme  — the photograph takes the screen; the data folds into two rows
//   c  Paper      — the joke stays on the photograph; the data sits on a warm printed card
//
// Every direction keeps Al's rulings: the joke on the photograph in white over a scrim
// (14 Aug), the number stepped back (14 Aug), the photograph to the top with the header
// on it (17 Aug), no six-hour strip on Home (8 Aug), the source-agreement line and the one
// stats pill with the yellow Hourly button beside it (7 Aug), Home ad-free.

// How much of the photograph a caption may cover before it steps down in size, and the
// smallest it may step down to (Caveat below ~19 px stops reading as handwriting).
const CAP = { a: 0.42, b: 0.46, c: 0.42 };
const MIN_PX = 19;

export function initHomeOption(v) {
  document.body.classList.add('home-option', `home-${v}`);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'assets/home-options.css';
  document.head.appendChild(link);

  // A long line steps down, 1 px at a time, until the TEXT (not the scrim's runway
  // above it) covers no more than CAP of the photograph — the isiZulu longest line ran
  // five lines and covered half the picture.
  const fit = () => {
    const cap = document.getElementById('headline');
    const photo = document.getElementById('heroPhoto');
    if (!cap) return;
    cap.style.fontSize = '';          // cleared first, so a wide window never keeps a phone size
    if (!photo || !matchMedia('(max-width: 768px)').matches) return;
    const limit = photo.getBoundingClientRect().height * CAP[v];
    const textH = () => cap.getBoundingClientRect().height - parseFloat(getComputedStyle(cap).paddingTop || '0');
    let px = parseFloat(getComputedStyle(cap).fontSize);
    for (let guard = 0; guard < 40 && textH() > limit && px > MIN_PX; guard++) {
      px -= 1;
      cap.style.fontSize = `${px}px`;
    }
  };
  const again = () => requestAnimationFrame(fit);
  const watch = new MutationObserver(again);
  const start = () => {
    const cap = document.getElementById('headline');
    if (cap) watch.observe(cap, { childList: true, characterData: true, subtree: true });
    again();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
  addEventListener('resize', again);
  link.addEventListener('load', again);
}
