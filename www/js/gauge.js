// ---------------------------------------------------------------------------
// Renders a semicircular instrument-dial gauge for a -100..+100 score.
// Pure SVG, no dependencies, sized via viewBox so it scales in CSS.
// ---------------------------------------------------------------------------

var Gauge = (function () {

  var CX = 60, CY = 62, R = 48;
  var SVG_NS = 'http://www.w3.org/2000/svg';

  function polar(cx, cy, r, angleDeg) {
    var rad = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
  }

  function arcPath(startAngle, endAngle, r) {
    var p1 = polar(CX, CY, r, startAngle);
    var p2 = polar(CX, CY, r, endAngle);
    var largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
    return 'M ' + p1.x.toFixed(2) + ' ' + p1.y.toFixed(2) +
      ' A ' + r + ' ' + r + ' 0 ' + largeArc + ' 0 ' + p2.x.toFixed(2) + ' ' + p2.y.toFixed(2);
  }

  // score -100..100 -> angle 180..0 (left to right along the top semicircle)
  function scoreToAngle(score) {
    var pct = (score + 100) / 200;
    return 180 - pct * 180;
  }

  function buildSVG(score) {
    var angle = scoreToAngle(score);
    var needleTip = polar(CX, CY, R - 8, angle);

    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 120 70');
    svg.setAttribute('class', 'gauge-svg');

    var segments = [
      { from: 180, to: 116, cls: 'gauge-seg-bearish' },
      { from: 116, to: 64, cls: 'gauge-seg-neutral' },
      { from: 64, to: 0, cls: 'gauge-seg-bullish' }
    ];

    var markup = '';
    segments.forEach(function (seg) {
      markup += '<path d="' + arcPath(seg.from, seg.to, R) + '" class="' + seg.cls + '"></path>';
    });

    // Tick marks at -100, -60, -20, 20, 60, 100
    [-100, -60, -20, 20, 60, 100].forEach(function (t) {
      var a = scoreToAngle(t);
      var outer = polar(CX, CY, R + 5, a);
      var inner = polar(CX, CY, R - 3, a);
      markup += '<line x1="' + inner.x.toFixed(2) + '" y1="' + inner.y.toFixed(2) +
        '" x2="' + outer.x.toFixed(2) + '" y2="' + outer.y.toFixed(2) + '" class="gauge-tick"></line>';
    });

    // Needle
    markup += '<line x1="' + CX + '" y1="' + CY + '" x2="' + needleTip.x.toFixed(2) + '" y2="' + needleTip.y.toFixed(2) +
      '" class="gauge-needle"></line>';
    markup += '<circle cx="' + CX + '" cy="' + CY + '" r="4.5" class="gauge-pivot"></circle>';

    svg.innerHTML = markup;
    return svg;
  }

  function render(container, score) {
    container.innerHTML = '';
    container.appendChild(buildSVG(score));
  }

  return { render: render };
})();
