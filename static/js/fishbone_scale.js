/**
 * Fishbone Scale - Grows the diagram vertically when categories
 * have many causes.  All horizontal positioning is handled by CSS
 * percentages that match the SVG viewBox (900×480).
 *
 * This script only adjusts the SVG viewBox height + rib Y coords
 * and keeps the CSS aspect-ratio in sync.
 */
(function () {
    'use strict';

    var ROW_HEIGHT = 36;   // px per cause row
    var MIN_HALF  = 180;   // minimum half-height in viewBox units
    var EDGE_PAD  = 50;    // padding from edge to rib tip

    function scaleFishbone() {
        var diagram = document.querySelector('.fishbone-diagram');
        if (!diagram) return;
        var svg = diagram.querySelector('.fishbone-svg');
        if (!svg) return;

        // Count max causes per side
        var maxTop = 0, maxBottom = 0;
        diagram.querySelectorAll('.category-group.top').forEach(function (g) {
            var c = g.querySelectorAll('.cause-row').length;
            if (c > maxTop) maxTop = c;
        });
        diagram.querySelectorAll('.category-group.bottom').forEach(function (g) {
            var c = g.querySelectorAll('.cause-row').length;
            if (c > maxBottom) maxBottom = c;
        });

        var topHalf    = Math.max(MIN_HALF, maxTop * ROW_HEIGHT + EDGE_PAD);
        var bottomHalf = Math.max(MIN_HALF, maxBottom * ROW_HEIGHT + EDGE_PAD);
        var totalH     = topHalf + bottomHalf;
        var spineY     = topHalf;

        // Update SVG viewBox (width stays 900)
        svg.setAttribute('viewBox', '0 0 900 ' + totalH);

        // Move SVG lines to match new height
        svg.querySelectorAll('line').forEach(function (ln) {
            if (!ln.hasAttribute('data-oy1')) {
                ln.setAttribute('data-oy1', ln.getAttribute('y1'));
                ln.setAttribute('data-oy2', ln.getAttribute('y2'));
            }
            var oy1 = parseFloat(ln.getAttribute('data-oy1'));
            var oy2 = parseFloat(ln.getAttribute('data-oy2'));

            if (Math.abs(oy1 - oy2) < 1) {
                // Spine — stays horizontal at new centre
                ln.setAttribute('y1', spineY);
                ln.setAttribute('y2', spineY);
            } else if (oy1 < oy2) {
                // Top rib
                ln.setAttribute('y1', EDGE_PAD);
                ln.setAttribute('y2', spineY);
            } else {
                // Bottom rib
                ln.setAttribute('y1', totalH - EDGE_PAD);
                ln.setAttribute('y2', spineY);
            }
        });

        // Keep CSS aspect-ratio in sync so the percentage positions still work
        diagram.style.aspectRatio = '900 / ' + totalH;
    }

    function init() {
        scaleFishbone();
        setTimeout(scaleFishbone, 100);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    var tid;
    window.addEventListener('resize', function () {
        clearTimeout(tid);
        tid = setTimeout(function () {
            scaleFishbone();
            document.dispatchEvent(new Event('fishbone-scaled'));
        }, 200);
    });

    window.scaleFishbone = scaleFishbone;
})();
