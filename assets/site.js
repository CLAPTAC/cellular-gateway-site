(function () {
  "use strict";
  var root = document.documentElement;

  /* ---------- Theme ---------- */
  function currentTheme() {
    return root.getAttribute("data-theme") ||
      (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }
  var themeBtn = document.querySelector("[data-theme-toggle]");
  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("cg-theme", next); } catch (e) {}
    });
  }

  /* ---------- Mobile nav ---------- */
  var menuBtn = document.querySelector("[data-menu]");
  if (menuBtn) {
    menuBtn.addEventListener("click", function () { document.body.classList.toggle("nav-open"); });
    document.addEventListener("click", function (e) {
      if (document.body.classList.contains("nav-open") && !e.target.closest(".sidebar") && !e.target.closest("[data-menu]")) {
        document.body.classList.remove("nav-open");
      }
    });
  }

  /* ---------- Syntax highlighting (small, dependency free) ---------- */
  var KEYWORDS = {
    python: "import from as def return if else elif for in while with try except raise class lambda None True False and or not is await async",
    js: "const let var function return if else for of in while await async new throw try catch import from export class null true false typeof",
    bash: "if then fi else for do done in case esac export cd",
    nginx: "server location listen proxy_pass proxy_set_header proxy_http_version proxy_read_timeout proxy_send_timeout ssl_certificate ssl_certificate_key server_name map default",
    yaml: "true false null",
    json: "true false null",
    kotlin: "val var fun class object if else when return null true false private override",
    text: ""
  };
  function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function highlight(code, lang) {
    if (lang === "http") lang = "text";
    var kw = {};
    (KEYWORDS[lang] || "").split(" ").forEach(function (k) { if (k) kw[k] = 1; });
    var hashComment = lang === "bash" || lang === "python" || lang === "yaml" || lang === "nginx" || lang === "env";
    var slashComment = lang === "js" || lang === "kotlin";
    var out = "", i = 0, n = code.length, c;
    while (i < n) {
      c = code[i];
      if ((hashComment && c === "#" && (i === 0 || /[\s]/.test(code[i - 1]))) || (slashComment && c === "/" && code[i + 1] === "/")) {
        var e = code.indexOf("\n", i); if (e < 0) e = n;
        out += '<span class="tok-com">' + esc(code.slice(i, e)) + "</span>"; i = e; continue;
      }
      if (c === '"' || c === "'" || c === "`") {
        var j = i + 1;
        while (j < n && code[j] !== c) { if (code[j] === "\\") j++; if (code[j] === "\n" && c !== "`") break; j++; }
        var str = code.slice(i, j + 1);
        var isKey = lang === "json" && /^\s*:/.test(code.slice(j + 1, j + 4));
        out += '<span class="' + (isKey ? "tok-key" : "tok-str") + '">' + esc(str) + "</span>"; i = j + 1; continue;
      }
      if (lang === "bash" && c === "-" && /[\s\\]/.test(code[i - 1] || " ") && /[-A-Za-z]/.test(code[i + 1] || "")) {
        var f = i; while (f < n && /[-A-Za-z0-9_]/.test(code[f])) f++;
        out += '<span class="tok-flag">' + esc(code.slice(i, f)) + "</span>"; i = f; continue;
      }
      if (/[0-9]/.test(c) && !/[A-Za-z_]/.test(code[i - 1] || " ")) {
        var m = /^[0-9][0-9._]*/.exec(code.slice(i));
        out += '<span class="tok-num">' + esc(m[0]) + "</span>"; i += m[0].length; continue;
      }
      if (/[A-Za-z_]/.test(c)) {
        var w = i; while (w < n && /[A-Za-z0-9_]/.test(code[w])) w++;
        var word = code.slice(i, w);
        out += kw[word] ? '<span class="tok-kw">' + word + "</span>" : esc(word); i = w; continue;
      }
      out += esc(c); i++;
    }
    return out;
  }

  /* ---------- Code blocks: highlight + copy ---------- */
  document.querySelectorAll(".codeblock").forEach(function (block) {
    var pre = block.querySelector("pre");
    var codeEl = pre.querySelector("code");
    var raw = codeEl.textContent;
    codeEl.innerHTML = highlight(raw, block.getAttribute("data-lang") || "text");
    var btn = block.querySelector(".copy-btn");
    if (btn) {
      btn.addEventListener("click", function () {
        var done = function () { btn.textContent = "Copied"; btn.classList.add("done"); setTimeout(function () { btn.textContent = "Copy"; btn.classList.remove("done"); }, 1600); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(raw).then(done, function () {});
        } else {
          var ta = document.createElement("textarea"); ta.value = raw; document.body.appendChild(ta); ta.select();
          try { document.execCommand("copy"); done(); } catch (e) {} document.body.removeChild(ta);
        }
      });
    }
  });

  /* ---------- Tabs ---------- */
  document.querySelectorAll("[data-tabs]").forEach(function (group) {
    var buttons = group.querySelectorAll(".tab-list button");
    var panels = group.querySelectorAll(".tab-panel");
    function select(idx) {
      buttons.forEach(function (b, i) { b.setAttribute("aria-selected", i === idx ? "true" : "false"); });
      panels.forEach(function (p, i) { p.hidden = i !== idx; });
    }
    buttons.forEach(function (b, i) { b.addEventListener("click", function () { select(i); try { localStorage.setItem("cg-tab", b.textContent); } catch (e) {} }); });
    var saved = null; try { saved = localStorage.getItem("cg-tab"); } catch (e) {}
    var start = 0; buttons.forEach(function (b, i) { if (saved && b.textContent === saved) start = i; });
    select(start);
  });

  /* ---------- TOC scrollspy ---------- */
  var tocLinks = document.querySelectorAll(".toc a");
  if (tocLinks.length && "IntersectionObserver" in window) {
    var map = {};
    tocLinks.forEach(function (a) { map[a.getAttribute("href").slice(1)] = a; });
    var heads = Array.prototype.slice.call(document.querySelectorAll(".article h2[id], .article h3[id]"));
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          tocLinks.forEach(function (a) { a.classList.remove("active"); });
          var a = map[en.target.id]; if (a) a.classList.add("active");
        }
      });
    }, { rootMargin: "-70px 0px -70% 0px" });
    heads.forEach(function (h) { io.observe(h); });
  }

  /* ---------- Search ---------- */
  var modal = document.querySelector(".search-modal");
  var index = window.__CG_SEARCH__ || [];
  var base = document.body.getAttribute("data-root") || "";
  if (modal) {
    var input = modal.querySelector("input");
    var list = modal.querySelector(".search-results");
    var sel = 0, shown = [];
    var open = function () { modal.classList.add("open"); input.value = ""; render(""); setTimeout(function () { input.focus(); }, 10); };
    var close = function () { modal.classList.remove("open"); };
    function render(q) {
      q = q.trim().toLowerCase();
      var terms = q.split(/\s+/).filter(Boolean);
      var scored = index.map(function (item) {
        if (!terms.length) return { item: item, score: item.lvl === 1 ? 1 : 0 };
        var hay = (item.title + " " + item.page + " " + item.text).toLowerCase(), title = item.title.toLowerCase(), s = 0;
        for (var i = 0; i < terms.length; i++) {
          if (hay.indexOf(terms[i]) < 0) return { item: item, score: -1 };
          s += title.indexOf(terms[i]) >= 0 ? 10 : 1;
          if (item.lvl === 1) s += 3;
        }
        return { item: item, score: s };
      }).filter(function (r) { return r.score > 0; }).sort(function (a, b) { return b.score - a.score; }).slice(0, 12);
      shown = scored; sel = 0;
      if (!scored.length) { list.innerHTML = '<div class="search-empty">No results for “' + esc(q) + "”</div>"; return; }
      list.innerHTML = scored.map(function (r, i) {
        var it = r.item;
        var title = esc(it.title);
        terms.forEach(function (t) { title = title.replace(new RegExp("(" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig"), "<mark>$1</mark>"); });
        return '<a href="' + base + it.url + '" class="' + (i === 0 ? "sel" : "") + '"><div class="r-title">' + title + '</div><div class="r-sub">' + esc(it.page) + (it.lvl > 1 ? " › " + esc(it.title) : "") + "</div></a>";
      }).join("");
    }
    function move(d) {
      var links = list.querySelectorAll("a"); if (!links.length) return;
      links[sel].classList.remove("sel"); sel = (sel + d + links.length) % links.length;
      links[sel].classList.add("sel"); links[sel].scrollIntoView({ block: "nearest" });
    }
    document.querySelectorAll("[data-search]").forEach(function (b) { b.addEventListener("click", open); });
    modal.addEventListener("click", function (e) { if (e.target === modal) close(); });
    input.addEventListener("input", function () { render(input.value); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (e.key === "Enter") { var links = list.querySelectorAll("a"); if (links[sel]) location.href = links[sel].href; }
    });
    document.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); modal.classList.contains("open") ? close() : open(); }
      else if (e.key === "Escape") close();
      else if (e.key === "/" && !/input|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); open(); }
    });
  }
})();
