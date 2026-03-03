/**
 * Fishbone Render - Draws the entire Ishikawa diagram as pure SVG.
 *
 * Usage:
 *   renderFishbone(containerEl, {
 *       title: "Problem statement",
 *       categories: {
 *           People: [{text:"cause1"}, ...],
 *           Process: [...], Environment: [...],
 *           Technology: [...], Tools: [...], Program: [...]
 *       }
 *   });
 */
(function () {
    'use strict';

    var TOP_CATS = ['People', 'Process', 'Environment'];
    var BOT_CATS = ['Technology', 'Tools', 'Program'];

    // Layout constants (SVG viewBox units)
    var VB_W         = 1100;
    var SPINE_LEFT   = 200;
    var SPINE_RIGHT  = 880;
    var HEAD_LEFT    = 895;
    var HEAD_WIDTH   = 180;
    var HEAD_PAD     = 12;

    var ROW_H        = 42;
    var MIN_HALF     = 180;
    var EDGE_PAD     = 45;
    var CAUSE_BOX_W  = 155;
    var CAUSE_BOX_H  = 40;
    var ARROW_SIZE   = 5;

    var COLORS = {
        spine:       '#000000',
        rib:         '#000000',
        connector:   '#555',
        label:       '#000000',
        causeText:   '#333333',
        causeBg:     '#ffffff',
        causeBorder: '#E0E0E0',
        headBg:      '#ffffff',
        headBorder:  '#E11937',
        topVoted:    '#E11937',
        topVotedBg:  '#E11937',
        topVotedText:'#ffffff'
    };

    function renderFishbone(container, data) {
        if (!container || !data) return;

        var cats  = data.categories || {};
        var title = data.title || '';
        var showVotes = data.showVotes || false;

        // Count max causes per side
        var maxTop = 0, maxBot = 0;
        TOP_CATS.forEach(function (c) { var n = (cats[c]||[]).length; if (n > maxTop) maxTop = n; });
        BOT_CATS.forEach(function (c) { var n = (cats[c]||[]).length; if (n > maxBot) maxBot = n; });

        var topHalf  = Math.max(MIN_HALF, maxTop * ROW_H + EDGE_PAD + 35);
        var botHalf  = Math.max(MIN_HALF, maxBot * ROW_H + EDGE_PAD + 35);
        var totalH   = topHalf + botHalf;
        var spineY   = topHalf;

        // Max votes for highlight
        var maxVotes = 0;
        if (showVotes) {
            [TOP_CATS, BOT_CATS].forEach(function (arr) {
                arr.forEach(function (c) {
                    (cats[c]||[]).forEach(function (it) {
                        if ((it.votes||0) > maxVotes) maxVotes = it.votes;
                    });
                });
            });
        }

        // 3 ribs evenly spaced along the spine
        var ribSpan   = SPINE_RIGHT - SPINE_LEFT;
        var ribBaseXs = [
            SPINE_LEFT + ribSpan * 0.2,
            SPINE_LEFT + ribSpan * 0.5,
            SPINE_LEFT + ribSpan * 0.8
        ];

        var s = [];
        s.push('<svg xmlns="http://www.w3.org/2000/svg" ');
        s.push('viewBox="0 0 ' + VB_W + ' ' + totalH + '" ');
        s.push('preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;display:block;">');

        // Defs
        s.push('<defs>');
        s.push('<marker id="sp-arr" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">');
        s.push('<polygon points="0 0,10 3.5,0 7" fill="' + COLORS.spine + '"/></marker>');
        s.push('<style>');
        s.push('.fb-lbl{font:bold 14px Inter,system-ui,sans-serif;fill:' + COLORS.label + ';letter-spacing:.5px}');
        s.push('.fb-head{font:600 13px Inter,system-ui,sans-serif;fill:' + COLORS.spine + '}');
        s.push('.fb-badge{font:bold 10px Inter,system-ui,sans-serif;fill:#fff}');
        s.push('</style></defs>');

        // Spine
        s.push('<line x1="' + SPINE_LEFT + '" y1="' + spineY + '" x2="' + SPINE_RIGHT + '" y2="' + spineY + '" stroke="' + COLORS.spine + '" stroke-width="2.5" marker-end="url(#sp-arr)"/>');

        // Fish head
        var hLines = wrapText(title, 22);
        var hH = Math.max(70, hLines.length * 17 + HEAD_PAD * 2 + 10);
        var hTop = spineY - hH / 2;
        s.push('<rect x="' + HEAD_LEFT + '" y="' + hTop + '" width="' + HEAD_WIDTH + '" height="' + hH + '" rx="4" fill="' + COLORS.headBg + '" stroke="' + COLORS.headBorder + '" stroke-width="1.5"/>');
        var hTxtY = hTop + HEAD_PAD + 15;
        hLines.forEach(function (ln, i) {
            s.push('<text x="' + (HEAD_LEFT + HEAD_WIDTH / 2) + '" y="' + (hTxtY + i * 17) + '" text-anchor="middle" class="fb-head">' + esc(ln) + '</text>');
        });

        // Top categories
        TOP_CATS.forEach(function (catName, idx) {
            var baseX = ribBaseXs[idx];
            var tipX  = baseX - 70;
            var tipY  = EDGE_PAD;

            s.push('<line x1="' + tipX + '" y1="' + tipY + '" x2="' + baseX + '" y2="' + spineY + '" stroke="' + COLORS.rib + '" stroke-width="1.5"/>');
            s.push('<text x="' + tipX + '" y="' + (tipY - 10) + '" text-anchor="middle" class="fb-lbl">' + esc(catName.toUpperCase()) + '</text>');

            drawCauses(s, cats[catName] || [], baseX, tipX, tipY, spineY, showVotes, maxVotes);
        });

        // Bottom categories
        BOT_CATS.forEach(function (catName, idx) {
            var baseX = ribBaseXs[idx];
            var tipX  = baseX - 70;
            var tipY  = totalH - EDGE_PAD;

            s.push('<line x1="' + tipX + '" y1="' + tipY + '" x2="' + baseX + '" y2="' + spineY + '" stroke="' + COLORS.rib + '" stroke-width="1.5"/>');
            s.push('<text x="' + tipX + '" y="' + (tipY + 22) + '" text-anchor="middle" class="fb-lbl">' + esc(catName.toUpperCase()) + '</text>');

            drawCauses(s, cats[catName] || [], baseX, tipX, tipY, spineY, showVotes, maxVotes);
        });

        s.push('</svg>');
        container.innerHTML = s.join('');
    }

    function drawCauses(s, items, baseX, tipX, tipY, spineY, showVotes, maxVotes) {
        if (!items.length) return;
        var n = items.length;

        for (var i = 0; i < n; i++) {
            var item = items[i];
            // t=0 near spine, t=1 near tip. Place closest to spine first.
            var t = (i + 0.5) / (n + 0.2);

            // Point on the rib at parameter t (from spine toward tip)
            var ribX = baseX + t * (tipX - baseX);
            var ribY = spineY + t * (tipY - spineY);

            // Cause box to the LEFT of the contact point
            var boxRight = ribX - 8;
            var boxLeft  = boxRight - CAUSE_BOX_W;
            // Clamp so box never goes off-screen
            if (boxLeft < 5) { boxLeft = 5; boxRight = boxLeft + CAUSE_BOX_W; }
            var boxTop = ribY - CAUSE_BOX_H / 2;

            var isTop  = showVotes && maxVotes > 0 && (item.votes||0) === maxVotes && item.votes > 0;
            var bgCol  = isTop ? COLORS.topVotedBg : COLORS.causeBg;
            var bdrCol = isTop ? COLORS.topVoted : COLORS.causeBorder;
            var bdrW   = isTop ? '2' : '1';
            var txtCol = isTop ? COLORS.topVotedText : COLORS.causeText;

            // Box background
            s.push('<rect x="' + boxLeft + '" y="' + boxTop + '" width="' + CAUSE_BOX_W + '" height="' + CAUSE_BOX_H + '" rx="4" fill="' + bgCol + '" stroke="' + bdrCol + '" stroke-width="' + bdrW + '"/>');

            // Text using foreignObject for word-wrap
            s.push('<foreignObject x="' + (boxLeft + 4) + '" y="' + (boxTop + 2) + '" width="' + (CAUSE_BOX_W - 8) + '" height="' + (CAUSE_BOX_H - 4) + '">');
            s.push('<div xmlns="http://www.w3.org/1999/xhtml" style="font:600 11px Inter,system-ui,sans-serif;color:' + txtCol + ';text-align:center;line-height:1.25;overflow:hidden;height:100%;display:flex;align-items:center;justify-content:center;word-break:break-word;">');
            s.push(esc(item.text || ''));
            s.push('</div></foreignObject>');

            // Connector: horizontal line from box right edge to rib contact
            s.push('<line x1="' + boxRight + '" y1="' + ribY + '" x2="' + (ribX - 2) + '" y2="' + ribY + '" stroke="' + COLORS.connector + '" stroke-width="1.5"/>');

            // Arrow tip pointing at the rib
            s.push('<polygon points="' + ribX + ',' + ribY + ' ' + (ribX - ARROW_SIZE - 1) + ',' + (ribY - ARROW_SIZE * 0.6) + ' ' + (ribX - ARROW_SIZE - 1) + ',' + (ribY + ARROW_SIZE * 0.6) + '" fill="' + COLORS.connector + '"/>');

        }
    }

    function wrapText(txt, max) {
        if (!txt) return [''];
        var words = txt.split(/\s+/), lines = [], cur = '';
        words.forEach(function (w) {
            if (cur.length + w.length + 1 > max && cur) { lines.push(cur); cur = w; }
            else { cur = cur ? cur + ' ' + w : w; }
        });
        if (cur) lines.push(cur);
        return lines;
    }

    function esc(str) {
        return (str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    window.renderFishbone = renderFishbone;
})();