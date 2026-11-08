/* Поведение страницы: открыто ли сейчас, сердце на прокрутке, меню с вкладками, появление блоков, отзывы, форма, панель на телефоне. */
(function () {
  var TEL = '<a href="tel:+79770475528">+7 (977) 047-55-28</a> или напишите в <a href="https://wa.me/79770475528" target="_blank" rel="noopener">WhatsApp</a>';
  var FORM_ENDPOINT = ''; /* {{адрес приёма заявок}} */
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(id) { return document.getElementById(id); }
  var hero = $('hero'), bar = $('bar'), contacts = $('contacts');

  /* Время в Омске (UTC+6), салон открыт каждый день 9:00–21:00 */
  var now = $('now'), h = new Date(Date.now() + 6 * 3600000).getUTCHours(), open = h >= 9 && h < 21;
  now.textContent = open ? 'Сейчас открыто' : (h < 9 ? 'Откроемся в 9:00' : 'Завтра с 9:00');
  now.classList.toggle('off', !open);
  now.hidden = false;

  /* Меню: вкладки */
  var tabs = document.querySelectorAll('.tab'), groups = document.querySelectorAll('.mgrp');
  function show(k) {
    tabs.forEach(function (t) { var on = t.dataset.k === k; t.classList.toggle('on', on); t.setAttribute('aria-selected', on); });
    groups.forEach(function (g) { g.classList.toggle('on', g.dataset.k === k); });
  }
  tabs.forEach(function (t) { t.addEventListener('click', function () { show(t.dataset.k); }); });
  show('b');

  function update() {
    var H = innerHeight, hr = hero.getBoundingClientRect(), cr = contacts.getBoundingClientRect();
    if (window.HT) { HT.live(hr.bottom > 0); HT.scroll(-hr.top / Math.max(1, hr.height)); }
    bar.classList.toggle('on', hr.bottom < H * .3 && cr.top > H * .6);
  }
  var ticking = false;
  addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; update(); }); } }, { passive: true });
  addEventListener('resize', update);
  update();

  if (!reduce && 'IntersectionObserver' in window) {
    var rise = document.querySelectorAll('.sec h2,.sec .sub,.menu,.menu-f,.fl-f,.fq,.pull,.terms li,.strip figure,.ex,.score,.rev-g:not(.rev-more) .rev,.maplink,.form');
    rise.forEach(function (el) { el.classList.add('rise'); });
    var seen = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); seen.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    rise.forEach(function (el) { seen.observe(el); });
  }

  var more = $('revMore'), btn = $('revBtn');
  btn.addEventListener('click', function () {
    var o = more.classList.toggle('open');
    btn.setAttribute('aria-expanded', o);
    btn.textContent = o ? 'Свернуть отзывы' : 'Показать ещё отзывы';
  });

  var form = $('form'), msg = $('formMsg');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var ph = form.elements.phone, ok = ph.value.replace(/\D/g, '').length >= 10;
    ph.classList.toggle('invalid', !ok);
    if (!ok) { msg.textContent = 'Укажите телефон, чтобы мы могли связаться.'; ph.focus(); return; }
    if (!FORM_ENDPOINT) { msg.innerHTML = 'Заявки с сайта пока не подключены, поэтому ваш номер не отправлен. Позвоните: ' + TEL; return; }
    fetch(FORM_ENDPOINT, { method: 'POST', body: new FormData(form) })
      .then(function (r) { if (!r.ok) throw 0; msg.textContent = 'Заявка принята, свяжемся с вами.'; form.reset(); })
      .catch(function () { msg.innerHTML = 'Заявка не отправилась. Позвоните: ' + TEL; });
  });
})();
