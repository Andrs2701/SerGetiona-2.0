(function () {
  "use strict";

  /* ---------- aparecer al hacer scroll ---------- */
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in-view'); });
  }

  /* ---------- carrusel de fondo del hero ---------- */
  var slideIndex = -1;
  function nextSlide() {
    var slides = document.querySelectorAll('.bg-slide');
    if (!slides.length) { return; }
    slideIndex = (slideIndex + 1) % slides.length;
    slides.forEach(function (s, i) { s.classList.toggle('is-active', i === slideIndex); });
  }
  nextSlide();
  setInterval(nextSlide, 5000);

  /* ---------- reproductor de YouTube (nuestra canción) ---------- */
  var YT_VIDEO_ID = 'Ggs5GVU5YtY';
  var ytPlayer = null;
  var ytReady = false;
  var isPlaying = false;

  var ytTag = document.createElement('script');
  ytTag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(ytTag);

  window.onYouTubeIframeAPIReady = function () {
    ytPlayer = new YT.Player('yt-player', {
      width: '1',
      height: '1',
      videoId: YT_VIDEO_ID,
      playerVars: {
        autoplay: 0,
        controls: 0,
        loop: 1,
        playlist: YT_VIDEO_ID,
        playsinline: 1,
        disablekb: 1,
        fs: 0,
        modestbranding: 1
      },
      events: {
        onReady: function () {
          ytReady = true;
          if (isPlaying) { ytPlayer.playVideo(); }
        }
      }
    });
  };

  var playBtn = document.getElementById('play-btn');
  var playBtnIcon = playBtn.querySelector('.play-btn__icon');
  var playBtnLabel = playBtn.querySelector('span:last-child');
  var musicPill = document.getElementById('music-pill');
  var musicLabel = musicPill.querySelector('.music-pill__label');

  function paintPlaying(playing) {
    if (playing) {
      playBtn.classList.add('is-playing');
      playBtnLabel.textContent = 'Toca para pausar la canción';
      playBtnIcon.textContent = '❚❚';
      musicPill.classList.remove('is-hidden', 'is-paused');
      musicLabel.textContent = 'sonando…';
    } else {
      playBtn.classList.remove('is-playing');
      playBtnLabel.textContent = 'Toca para reproducir nuestra canción';
      playBtnIcon.textContent = '▶';
      musicPill.classList.add('is-paused');
      musicLabel.textContent = 'en pausa';
    }
  }

  function toggleMusic() {
    isPlaying = !isPlaying;
    paintPlaying(isPlaying);
    if (ytReady && ytPlayer) {
      if (isPlaying) { ytPlayer.playVideo(); } else { ytPlayer.pauseVideo(); }
    }
  }

  playBtn.addEventListener('click', toggleMusic);
  musicPill.addEventListener('click', toggleMusic);

  /* ---------- corazones al tocar el final ---------- */
  var confettiBtn = document.getElementById('confetti-btn');
  var symbols = ['🧵', '❤️', '🩷', '✨'];

  confettiBtn.addEventListener('click', function () {
    var rect = confettiBtn.getBoundingClientRect();
    for (var i = 0; i < 14; i++) {
      var span = document.createElement('span');
      span.className = 'floating-heart';
      span.textContent = symbols[Math.floor(Math.random() * symbols.length)];
      span.style.left = (rect.left + rect.width / 2 + (Math.random() * 160 - 80)) + 'px';
      span.style.top = rect.top + 'px';
      span.style.animationDelay = (Math.random() * 0.3) + 's';
      document.body.appendChild(span);
      (function (el) { setTimeout(function () { el.remove(); }, 2600); })(span);
    }
  });

})();
