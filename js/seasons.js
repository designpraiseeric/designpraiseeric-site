/* DesignPraise seasons — greetings for the Christian year and Nigerian public days.
 *
 * One source for everything: build.py injects it into the ScriptUI core (ExtendScript, ES3),
 * copies it into every CEP panel (dp/dp-seasons.js) and into the website (/seasons.js).
 * Keep it ES3: no let/const, arrow functions, forEach, JSON or trailing commas.
 *
 * Which days: the evangelical feasts the Second Helvetic Confession (ch. 24) commends —
 * the Lord's nativity, passion, resurrection, ascension and the sending of the Spirit —
 * plus Advent, Reformation Day, the turn of the year and Nigerian civic days. Saints' days are left out.
 * Scripture is the King James Version (public domain).
 *
 * DPSeasons.get(date?) -> null or { id, kind, title, line, ref, verse, accent, from, to }
 *   kind: "feast" | "solemn" | "season" | "civic"   (solemn days never say "Happy")
 */
var DPSeasons = (function () {
    var DAY = 86400000;

    function ymd(y, m, d) { return new Date(y, m - 1, d, 12, 0, 0); }   // noon, so DST never shifts the day
    function add(dt, n) { return new Date(dt.getTime() + n * DAY); }
    function same(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
    function within(dt, a, b) { var t = ymd(dt.getFullYear(), dt.getMonth() + 1, dt.getDate()).getTime(); return t >= a.getTime() && t <= b.getTime(); }

    // Western Easter (Anonymous Gregorian algorithm).
    function easter(y) {
        var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
        var f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
        var i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
        var month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
        return ymd(y, month, day);
    }
    // nth Sunday of a month (n = 1..5)
    function nthSunday(y, m, n) { var first = ymd(y, m, 1); return add(first, (7 - first.getDay()) % 7 + (n - 1) * 7); }
    // Advent Sunday: the fourth Sunday before Christmas Day.
    function adventSunday(y) { var xmas = ymd(y, 12, 25); var back = xmas.getDay() === 0 ? 7 : xmas.getDay(); return add(xmas, -back - 21); }

    // Islamic (tabular) calendar -> local Date. Moon sighting in Nigeria can move the real day by one,
    // so the Eid greetings below run from the day before to the day after.
    function hijri(y, m, d) {
        var jd = d + Math.ceil(29.5 * (m - 1)) + (y - 1) * 354 + Math.floor((3 + 11 * y) / 30) + 1948438.5;
        var t = new Date((jd - 2440587.5) * DAY);
        return ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
    }
    // Every date in Gregorian year gy that is month/day in the Hijri calendar (usually one; about every 33 years, two).
    function hijriIn(gy, m, d) {
        var hy = Math.floor((gy - 622) * 33 / 32), out = [];
        for (var k = hy - 1; k <= hy + 2; k++) { var dt = hijri(k, m, d); if (dt.getFullYear() === gy) out.push(dt); }
        return out;
    }

    var NG_GREEN = "#03ee63", AMBER = "#ffa800", LILAC = "#a57bff", AQUA = "#03eed8", MUTE = "";

    // Colours for each day: [main, second, third]. The main colour is the accent everywhere (gem, text, tints).
    // Church days follow the liturgical colours (violet, white and gold, red, black); civic days use Nigeria's green.
    var COLORS = {
        advent:      ["#7c4dff", "#ffc44d", "#2f9e64"],   // violet, candle flame, wreath
        christmas:   ["#ffb400", "#d6283f", "#1f9d6b"],   // gold, red, evergreen
        watchnight:  ["#ffd35a", "#27306e", "#a57bff"],   // lamp gold, midnight
        newyear:     ["#03d9c5", "#ffa800", "#7c4dff"],   // dawn aqua, sun
        epiphany:    ["#ffc93c", "#3a4fd0", "#a57bff"],   // star gold, night blue
        mothering:   ["#f06595", "#ffc2d6", "#40c057"],   // rose, blossom, stem
        palmsunday:  ["#2fb344", "#a9e34b", "#c92a2a"],   // palm greens, passion red
        goodfriday:  ["#9b2335", "#3b3546", "#b9b0d6"],   // crimson, ash
        easter:      ["#ffb400", "#2fb36b", "#ff8fa3"],   // gold, new life, dawn
        ascension:   ["#4dabf7", "#ffd35a", "#d0ebff"],   // sky, glory
        pentecost:   ["#f03e3e", "#ff922b", "#ffd43b"],   // flame reds
        trinity:     ["#7c4dff", "#4dabf7", "#ffc93c"],   // three in one
        reformation: ["#e03131", "#e9d8b4", "#5c3d1e"],   // Reformation red, parchment, ink
        remembrance: ["#e03131", "#2b2b33", "#2f9e64"],   // poppy, black, green
        workers:     ["#f76707", "#868e96", "#ffd43b"],   // safety orange, steel
        children:    ["#fab005", "#4dabf7", "#ff6b6b"],   // play colours
        democracy:   ["#12b886", "#ffffff", "#ffd43b"],   // green-white
        fathers:     ["#1c7ed6", "#2f9e44", "#ffa800"],   // blue, oak
        independence:["#12b886", "#ffffff", "#0b7a4b"],   // green-white-green
        teachers:    ["#ffa800", "#7c4dff", "#03d9c5"],   // chalk and light
        eidfitr:     ["#16a34a", "#ffc44d", "#e9d8b4"],   // green, gold, table
        eidadha:     ["#16a34a", "#ffc44d", "#e9d8b4"]
    };

    // Ordered by priority: the first match wins when two days meet.
    function table(y) {
        var e = easter(y), adv = adventSunday(y);
        var fitr = hijriIn(y, 10, 1), adha = hijriIn(y, 12, 10);
        var list = [
            { id: "goodfriday", kind: "solemn", from: add(e, -2), to: add(e, -2), title: "Good Friday", accent: MUTE,
              line: "Remembering the cross, where Christ gave himself for us.",
              ref: "Isaiah 53:5", verse: "He was wounded for our transgressions, he was bruised for our iniquities… and with his stripes we are healed." },
            { id: "easter", kind: "feast", from: e, to: add(e, 1), title: "Happy Easter", accent: AMBER,
              line: "Christ is risen. Death did not have the last word.",
              ref: "Matthew 28:6", verse: "He is not here: for he is risen, as he said." },
            { id: "palmsunday", kind: "feast", from: add(e, -7), to: add(e, -7), title: "Palm Sunday", accent: LILAC,
              line: "The King came riding in humility.",
              ref: "Matthew 21:9", verse: "Hosanna to the Son of David: Blessed is he that cometh in the name of the Lord." },
            { id: "ascension", kind: "feast", from: add(e, 39), to: add(e, 39), title: "Ascension Day", accent: LILAC,
              line: "Christ reigns, and he is coming again.",
              ref: "Acts 1:11", verse: "This same Jesus, which is taken up from you into heaven, shall so come in like manner as ye have seen him go into heaven." },
            { id: "pentecost", kind: "feast", from: add(e, 49), to: add(e, 50), title: "Pentecost", accent: AMBER,
              line: "Celebrating the gift of the Holy Spirit.",
              ref: "Acts 2:4", verse: "And they were all filled with the Holy Ghost." },
            { id: "trinity", kind: "feast", from: add(e, 56), to: add(e, 56), title: "Trinity Sunday", accent: LILAC,
              line: "One God, Father, Son and Holy Spirit.",
              ref: "2 Corinthians 13:14", verse: "The grace of the Lord Jesus Christ, and the love of God, and the communion of the Holy Ghost, be with you all." },
            { id: "christmas", kind: "feast", from: ymd(y, 12, 24), to: ymd(y, 12, 30), title: "Merry Christmas", accent: AMBER,
              line: "God with us. Joy to you and yours this Christmas.",
              ref: "Luke 2:11", verse: "For unto you is born this day in the city of David a Saviour, which is Christ the Lord." },
            { id: "advent", kind: "season", from: adv, to: ymd(y, 12, 23), title: "Advent", accent: LILAC,
              line: "Waiting, with hope, for the coming of Christ.",
              ref: "Isaiah 9:2", verse: "The people that walked in darkness have seen a great light." },
            { id: "watchnight", kind: "season", from: ymd(y, 12, 31), to: ymd(y, 12, 31), title: "Goodbye, " + y, accent: AQUA,
              line: "Thank you for this year. See you in the next.",
              ref: "Psalm 90:12", verse: "So teach us to number our days, that we may apply our hearts unto wisdom." },
            { id: "newyear", kind: "feast", from: ymd(y, 1, 1), to: ymd(y, 1, 3), title: "Happy New Year", accent: AQUA,
              line: "A new year to make good things, by God’s mercy.",
              ref: "Lamentations 3:22–23", verse: "His compassions fail not. They are new every morning: great is thy faithfulness." },
            { id: "epiphany", kind: "feast", from: ymd(y, 1, 6), to: ymd(y, 1, 6), title: "Epiphany", accent: AMBER,
              line: "The light of Christ, shown to every nation.",
              ref: "Isaiah 60:3", verse: "And the Gentiles shall come to thy light, and kings to the brightness of thy rising." },
            { id: "reformation", kind: "feast", from: ymd(y, 10, 31), to: ymd(y, 10, 31), title: "Reformation Day", accent: AMBER,
              line: "Giving thanks for the recovery of the gospel of grace.",
              ref: "Romans 1:17", verse: "The just shall live by faith." },
            { id: "mothering", kind: "civic", from: add(e, -21), to: add(e, -21), title: "Happy Mothering Sunday", accent: LILAC,
              line: "To every mother: thank you.",
              ref: "Proverbs 31:28", verse: "Her children arise up, and call her blessed." },
            { id: "fathers", kind: "civic", from: nthSunday(y, 6, 3), to: nthSunday(y, 6, 3), title: "Happy Father’s Day", accent: LILAC,
              line: "To every father: thank you.",
              ref: "Psalm 103:13", verse: "Like as a father pitieth his children, so the LORD pitieth them that fear him." },
            { id: "independence", kind: "civic", from: ymd(y, 10, 1), to: ymd(y, 10, 1), title: "Happy Independence Day, Nigeria", accent: NG_GREEN,
              line: "Praying for peace and good leadership across our land.",
              ref: "Psalm 33:12", verse: "Blessed is the nation whose God is the LORD." },
            { id: "democracy", kind: "civic", from: ymd(y, 6, 12), to: ymd(y, 6, 12), title: "Happy Democracy Day", accent: NG_GREEN,
              line: "Praying for justice and freedom in Nigeria.",
              ref: "Proverbs 14:34", verse: "Righteousness exalteth a nation." },
            { id: "workers", kind: "civic", from: ymd(y, 5, 1), to: ymd(y, 5, 1), title: "Happy Workers’ Day", accent: NG_GREEN,
              line: "Here’s to everyone who builds, mends and makes.",
              ref: "Colossians 3:23", verse: "And whatsoever ye do, do it heartily, as to the Lord, and not unto men." },
            { id: "children", kind: "civic", from: ymd(y, 5, 27), to: ymd(y, 5, 27), title: "Happy Children’s Day", accent: NG_GREEN,
              line: "Every child is a gift.",
              ref: "Psalm 127:3", verse: "Lo, children are an heritage of the LORD." },
            { id: "remembrance", kind: "solemn", from: ymd(y, 1, 15), to: ymd(y, 1, 15), title: "Armed Forces Remembrance Day", accent: "",
              line: "Remembering those who served and gave their lives for Nigeria.",
              ref: "John 15:13", verse: "Greater love hath no man than this, that a man lay down his life for his friends." },
            { id: "teachers", kind: "civic", from: ymd(y, 10, 5), to: ymd(y, 10, 5), title: "Happy Teachers\u2019 Day", accent: "",
              line: "To everyone who teaches, and to the ones who taught me: thank you.",
              ref: "Proverbs 9:9", verse: "Give instruction to a wise man, and he will be yet wiser: teach a just man, and he will increase in learning." }
        ];
        // Neighbourly greetings for Nigeria's Muslim public holidays: a wish of peace to neighbours,
        // with a verse on loving one's neighbour. (Eid-el-Maulud is left out: it honours Muhammad as prophet.)
        for (var f = 0; f < fitr.length; f++) list.push({ id: "eidfitr", kind: "neighbour", from: add(fitr[f], -1), to: add(fitr[f], 1), title: "Eid al-Fitr", accent: "",
              line: "Wishing our Muslim neighbours a peaceful holiday with family and friends.",
              ref: "Romans 12:18", verse: "If it be possible, as much as lieth in you, live peaceably with all men." });
        for (var a = 0; a < adha.length; a++) list.push({ id: "eidadha", kind: "neighbour", from: add(adha[a], -1), to: add(adha[a], 1), title: "Eid al-Adha", accent: "",
              line: "Wishing our Muslim neighbours a peaceful holiday with family and friends.",
              ref: "Matthew 22:39", verse: "Thou shalt love thy neighbour as thyself." });
        // Neighbour greetings sit after the church year but before the civic days (Children's Day can share a date with Eid).
        var ordered = [], late = [];
        for (var i = 0; i < list.length; i++) {
            var it = list[i];
            if (it.kind === "civic" || it.id === "remembrance") late.push(it); else ordered.push(it);
        }
        list = ordered.concat(late);
        for (var j = 0; j < list.length; j++) {
            var c = COLORS[list[j].id];
            list[j].colors = c;
            list[j].accent = c[0];
        }
        return list;
    }

    function get(date) {
        var dt = date || new Date();
        var list = table(dt.getFullYear());
        for (var i = 0; i < list.length; i++) {
            var s = list[i];
            if (within(dt, s.from, s.to)) {
                var out = {};
                for (var k in s) if (s.hasOwnProperty(k)) out[k] = s[k];
                if (s.id === "advent") {
                    var week = Math.floor((ymd(dt.getFullYear(), dt.getMonth() + 1, dt.getDate()).getTime() - s.from.getTime()) / (7 * DAY)) + 1;
                    out.title = "Advent · week " + week;
                    out.week = week;
                }
                out.key = s.id + "-" + dt.getFullYear();   // stable per season per year (for "dismissed" flags)
                return out;
            }
        }
        return null;
    }

    // "2026-12-25" -> Date at local noon (for previews and tests).
    function parse(s) {
        var m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(s || ""));
        return m ? ymd(+m[1], +m[2], +m[3]) : null;
    }

    // Every greeting in a year, in date order (handy for checking the calendar).
    function year(y) {
        var list = table(y), out = [];
        for (var i = 0; i < list.length; i++) out.push(list[i]);
        out.sort(function (a, b) { return a.from.getTime() - b.from.getTime(); });
        return out;
    }

    return { get: get, parse: parse, year: year, easter: easter, same: same };
})();
if (typeof module !== "undefined" && module.exports) module.exports = DPSeasons;
