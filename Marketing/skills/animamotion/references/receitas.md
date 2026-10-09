# Receitas de animação (JavaScript puro)

## 1. Tokens de movimento

```css
:root {
  --dur-fast: 160ms;
  --dur-base: 400ms;
  --dur-slow: 700ms;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in: cubic-bezier(0.7, 0, 0.84, 0);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
}
```

```js
const MOV = {
  fast: 160, base: 400, slow: 700,
  out: "cubic-bezier(0.16, 1, 0.3, 1)",
  inOut: "cubic-bezier(0.65, 0, 0.35, 1)",
};
const reduzMovimento = matchMedia("(prefers-reduced-motion: reduce)").matches;
```

## 2. Reveal ao rolar (IntersectionObserver + WAAPI)

```js
function revelar(seletor = "[data-reveal]") {
  const els = document.querySelectorAll(seletor);
  const io = new IntersectionObserver((entradas) => {
    for (const e of entradas) {
      if (!e.isIntersecting) continue;
      const el = e.target;
      const atraso = Number(el.dataset.delay || 0);
      el.animate(
        reduzMovimento
          ? [{ opacity: 0 }, { opacity: 1 }]
          : [{ opacity: 0, transform: "translateY(24px)" },
             { opacity: 1, transform: "translateY(0)" }],
        { duration: MOV.base, delay: atraso, easing: MOV.out, fill: "both" }
      );
      io.unobserve(el);
    }
  }, { threshold: 0.2, rootMargin: "0px 0px -8% 0px" });
  els.forEach((el) => { el.style.opacity = 0; io.observe(el); });
}
```

Estado inicial oculto só com JS ativo: `document.documentElement.classList.add("js")` e `.js [data-reveal]{opacity:0}`.

## 3. Stagger em lista/grade de produtos

```js
document.querySelectorAll("[data-stagger]").forEach((grupo) => {
  [...grupo.children].slice(0, 8).forEach((filho, i) => {
    filho.dataset.reveal = "";
    filho.dataset.delay = i * 70;
  });
});
revelar();
```

## 4. Contador animado (ex.: "550 pares/dia", "+25%")

```js
function contar(el, ate, ms = 1400) {
  if (reduzMovimento) { el.textContent = ate.toLocaleString("pt-BR"); return; }
  const t0 = performance.now();
  const easeOut = (t) => 1 - Math.pow(1 - t, 4);
  (function frame(agora) {
    const p = Math.min((agora - t0) / ms, 1);
    el.textContent = Math.round(ate * easeOut(p)).toLocaleString("pt-BR");
    if (p < 1) requestAnimationFrame(frame);
  })(t0);
}
```

Dispare dentro de um IntersectionObserver para contar só quando visível.

## 5. Hero com entrada em sequência

```js
async function hero() {
  const passos = [
    [".hero__marca", { y: 16 }],
    [".hero__titulo", { y: 24 }],
    [".hero__sub", { y: 24 }],
    [".hero__cta", { y: 16 }],
  ];
  for (const [sel, { y }] of passos) {
    const el = document.querySelector(sel);
    if (!el) continue;
    el.animate(
      [{ opacity: 0, transform: `translateY(${y}px)` }, { opacity: 1, transform: "none" }],
      { duration: MOV.slow, easing: MOV.out, fill: "both",
        delay: passos.findIndex((p) => p[0] === sel) * 120 }
    );
  }
}
```

## 6. Transição entre estados/páginas (View Transitions com fallback)

```js
function transicao(atualizarDOM) {
  if (!document.startViewTransition || reduzMovimento) return atualizarDOM();
  document.startViewTransition(atualizarDOM);
}
```

```css
::view-transition-old(root), ::view-transition-new(root) {
  animation-duration: 450ms;
  animation-timing-function: var(--ease-in-out);
}
```

Para o mesmo produto "voar" da lista para o detalhe, dê o mesmo `view-transition-name` único ao card e à imagem de destino.

## 7. Modal / painel

```js
async function abrir(modal) {
  modal.hidden = false;
  modal.animate([{ opacity: 0 }, { opacity: 1 }], { duration: MOV.fast, fill: "both" });
  modal.firstElementChild.animate(
    [{ transform: "translateY(16px) scale(.98)", opacity: 0 }, { transform: "none", opacity: 1 }],
    { duration: MOV.base, easing: MOV.out, fill: "both" }
  );
}
async function fechar(modal) {
  const a = modal.animate([{ opacity: 1 }, { opacity: 0 }], { duration: MOV.fast, easing: "ease-in" });
  await a.finished;
  modal.hidden = true;
}
```

Lembrar de: foco preso no modal, fechar com `Esc`, devolver o foco ao botão de origem.

## 8. Hover de card de produto (só CSS)

```css
.card { transition: transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out); }
@media (hover: hover) {
  .card:hover { transform: translateY(-4px); }
}
```

Sombra: anime a opacidade de um pseudo-elemento com a sombra já aplicada, em vez da `box-shadow`.

## 9. Parallax leve (só quando não houver redução de movimento)

```js
if (!reduzMovimento) {
  const alvo = document.querySelector("[data-parallax]");
  let ticking = false;
  addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      alvo.style.transform = `translate3d(0, ${scrollY * 0.12}px, 0)`;
      ticking = false;
    });
  }, { passive: true });
}
```

## 10. Reduced motion global (rede de segurança)

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

## 11. GSAP (só quando necessário)

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
```

```js
gsap.registerPlugin(ScrollTrigger);
gsap.from(".card", {
  y: 24, opacity: 0, duration: 0.5, ease: "power3.out", stagger: 0.07,
  scrollTrigger: { trigger: ".grade", start: "top 80%", once: true },
});
```

Envolva em `gsap.matchMedia()` com a condição `(prefers-reduced-motion: no-preference)`.

## Checklist de entrega

- [ ] Só `transform`/`opacity` animados
- [ ] Easing e durações a partir dos tokens
- [ ] `prefers-reduced-motion` tratado
- [ ] Conteúdo visível sem JS
- [ ] Testado em largura de celular
- [ ] Observers desconectados após uso
- [ ] Bibliotecas com versão fixa
- [ ] Cores/logo conforme `grupo-prado-idv`
