/**
 * Fishbone Align - Shifts each cause-row horizontally so the
 * connector arrow tip touches its diagonal rib line.
 *
 * Runs AFTER fishbone_scale.js.
 */
(function () {
    'use strict';

    function svgToScreen(svg, x, y) {
        var pt = svg.createSVGPoint();
        pt.x = x;
        pt.y = y;
        var ctm = svg.getScreenCTM();
        if (!ctm) return null;
        return pt.matrixTransform(ctm);
    }

    function alignFishbone() {
        var diagram = document.querySelector('.fishbone-diagram');
        if (!diagram) return;
        var svg = diagram.querySelector('.fishbone-svg');
        if (!svg || !svg.getScreenCTM()) return;

        var lines = svg.querySelectorAll('line');
        var topRibs = [], bottomRibs = [];

        for (var i = 0; i < lines.length; i++) {
            var el = lines[i];
            var sy1 = parseFloat(el.getAttribute('y1'));
            var sy2 = parseFloat(el.getAttribute('y2'));
            if (Math.abs(sy1 - sy2) < 1) continue; // spine

            var p1 = svgToScreen(svg, parseFloat(el.getAttribute('x1')), sy1);
            var p2 = svgToScreen(svg, parseFloat(el.getAttribute('x2')), sy2);
            if (!p1 || !p2) continue;

            var rib = { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
            (sy1 < sy2 ? topRibs : bottomRibs).push(rib);
        }

        topRibs.sort(function (a, b) { return a.x2 - b.x2; });
        bottomRibs.sort(function (a, b) { return a.x2 - b.x2; });

        place('.category-group.top', topRibs);
        place('.category-group.bottom', bottomRibs);

        function place(sel, ribs) {
            var groups = diagram.querySelectorAll(sel);
            for (var g = 0; g < groups.length && g < ribs.length; g++) {
                shiftRows(groups[g], ribs[g]);
            }
        }
    }

    function shiftRows(group, rib) {
        var rows = group.querySelectorAll('.cause-row');
        if (!rows.length) return;

        // Reset
        for (var i = 0; i < rows.length; i++) rows[i].style.transform = '';
        void group.offsetHeight;

        for (var r = 0; r < rows.length; r++) {
            var row = rows[r];
            var conn = row.querySelector('.connector-line');
            if (!conn) continue;

            var midY = row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2;
            var dy = rib.y2 - rib.y1;
            if (Math.abs(dy) < 0.5) continue;

            var t = Math.max(0, Math.min(1, (midY - rib.y1) / dy));
            var targetX = rib.x1 + t * (rib.x2 - rib.x1);
            var tipX = conn.getBoundingClientRect().right;

            row.style.transform = 'translateX(' + Math.round(targetX - tipX) + 'px)';
        }
    }

    function init() {
        [100, 350, 800].forEach(function (d) { setTimeout(alignFishbone, d); });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    window.addEventListener('resize', (function () {
        var t;
        return function () { clearTimeout(t); t = setTimeout(alignFishbone, 200); };
    })());

    document.addEventListener('fishbone-scaled', function () {
        setTimeout(alignFishbone, 100);
    });

    window.alignFishbone = alignFishbone;
})();
