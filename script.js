(() => {
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const groups = window.ENTROPIA_GLYPHS || {};
  const allGlyphs = Object.entries(groups).flatMap(([group, glyphs]) =>
    glyphs.map(glyph => ({ ...glyph, group }))
  );
  const groupLabels = {
    uppercase: "MAIÚSCULA",
    lowercase: "MINÚSCULA",
    numbers: "NÚMERO",
    accents: "CARACTERE ACENTUADO",
    punctuation: "SÍMBOLO",
    marks: "MARCA COMBINANTE",
    spaces: "ESPAÇO"
  };

  const REGULAR_ENTROPY = 0;
  const REGULAR_WEIGHT = 80;
  const DEFAULT_GLYPH = allGlyphs.find(item => item.char === "A") || allGlyphs[0];

  let pinnedGlyph = null;
  let hoveredGlyph = null;
  let entropy = REGULAR_ENTROPY;
  let weight = REGULAR_WEIGHT;
  let hoverEntropy = REGULAR_ENTROPY;
  let hoverWeight = REGULAR_WEIGHT;
  let toastTimer;

  const grid = $("#glyphGrid");
  const search = $("#glyphSearch");
  const entropyRange = $("#entropyRange");
  const weightRange = $("#weightRange");
  const toast = $("#toast");
  const axisControls = $("#axisControls");
  const resetButton = $("#resetAxes");

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2600);
  }

  function formatNumber(value) {
    return String(value).padStart(3, "0");
  }

  function variation(entp, wght) {
    return `"ENTP" ${entp}, "wght" ${wght}`;
  }

  function displayCharacter(item) {
    if (item.cp === 0x20) return { text: "␠", special: true };
    if (item.cp === 0xA0) return { text: "NBSP", special: true };
    if (item.group === "marks") return { text: `◌${item.char}`, special: false };
    return { text: item.char, special: false };
  }

  function applyVariation(node, entp = entropy, wght = weight) {
    if (node) node.style.fontVariationSettings = variation(entp, wght);
  }

  function currentDisplay() {
    if (hoveredGlyph) {
      return { glyph: hoveredGlyph, entp: hoverEntropy, wght: hoverWeight, state: "PRÉ-VISUALIZAÇÃO" };
    }
    if (pinnedGlyph) {
      return { glyph: pinnedGlyph, entp: entropy, wght: weight, state: "GLIFO FIXADO" };
    }
    return { glyph: DEFAULT_GLYPH, entp: REGULAR_ENTROPY, wght: REGULAR_WEIGHT, state: "REGULAR" };
  }

  function updateAxisUI() {
    entropyRange.value = entropy;
    weightRange.value = weight;
    $("#entropyValue").textContent = entropy;
    $("#weightValue").textContent = weight;
    $("#axisReadout").textContent = `ENTP ${formatNumber(entropy)} / WGHT ${formatNumber(weight)}`;
  }

  function updateDisplayedGlyph() {
    const displayState = currentDisplay();
    if (!displayState.glyph) return;

    const item = displayState.glyph;
    const display = displayCharacter(item);
    const glyphNode = $("#selectedGlyph");
    glyphNode.textContent = display.text;
    glyphNode.classList.toggle("tile-special", display.special);
    applyVariation(glyphNode, displayState.entp, displayState.wght);

    $("#selectedCode").textContent = item.code;
    $("#selectedUnicode").textContent = item.code;
    const name = item.name.replace(/([A-Z])/g, " $1").toUpperCase();
    $("#selectedName").textContent = `${groupLabels[item.group] || "CARACTERE"} / ${name}`;
    $("#detailState").textContent = displayState.state;
  }

  function setControlsEnabled(enabled) {
    [entropyRange, weightRange, resetButton].forEach(control => {
      control.disabled = !enabled;
    });
    axisControls.setAttribute("aria-disabled", String(!enabled));
    $("#controlsHint").textContent = enabled
      ? "Glifo fixado. Ajuste os eixos para explorar outras formas."
      : "Passe sobre um caractere para visualizar; clique para fixá-lo e liberar os controles.";
  }

  function updateGridSelection() {
    $$(".glyph-tile", grid).forEach(tile => {
      const pinned = Boolean(pinnedGlyph && tile.dataset.code === pinnedGlyph.code);
      const previewing = Boolean(hoveredGlyph && tile.dataset.code === hoveredGlyph.code);
      tile.classList.toggle("active", pinned);
      tile.classList.toggle("previewing", previewing);
      tile.setAttribute("aria-pressed", String(pinned));
    });
  }

  function updateTesterVariation() {
    applyVariation(
      $("#testerPreview"),
      pinnedGlyph ? entropy : REGULAR_ENTROPY,
      pinnedGlyph ? weight : REGULAR_WEIGHT
    );
  }

  function setAxes(nextEntropy = entropy, nextWeight = weight) {
    if (!pinnedGlyph) return;
    entropy = Math.max(0, Math.min(100, Number(nextEntropy)));
    weight = Math.max(80, Math.min(160, Number(nextWeight)));
    updateAxisUI();
    updateDisplayedGlyph();
    updateTesterVariation();
  }

  function randomizeHover(item) {
    if (!item) return;
    hoveredGlyph = item;
    hoverEntropy = Math.floor(Math.random() * 101);
    hoverWeight = REGULAR_WEIGHT + Math.floor(Math.random() * 81);
    updateDisplayedGlyph();
    updateGridSelection();
  }

  function clearHover(item) {
    // Só encerra a prévia do glifo que acabou de perder o cursor.
    if (item && hoveredGlyph && hoveredGlyph.code !== item.code) return;
    hoveredGlyph = null;
    updateDisplayedGlyph();
    updateGridSelection();
  }

  function pinGlyph(item) {
    if (!item) return;

    // Se o clique veio depois do hover, conserva a variação que a pessoa viu.
    if (hoveredGlyph && hoveredGlyph.code === item.code) {
      entropy = hoverEntropy;
      weight = hoverWeight;
    } else if (!pinnedGlyph) {
      entropy = REGULAR_ENTROPY;
      weight = REGULAR_WEIGHT;
    }

    pinnedGlyph = item;
    hoveredGlyph = null;
    setControlsEnabled(true);
    updateAxisUI();
    updateDisplayedGlyph();
    updateGridSelection();
    updateTesterVariation();
  }

  function visibleGlyphs() {
    const query = search.value.trim().toLocaleLowerCase("pt-BR");
    if (!query) return allGlyphs;
    return allGlyphs.filter(item => {
      const char = item.char.toLocaleLowerCase("pt-BR");
      const code = item.code.toLowerCase();
      const normalizedCode = code.replace("u+", "");
      const normalizedQuery = query.replace("u+", "");
      return char.includes(query)
        || item.name.toLowerCase().includes(query)
        || code.includes(query)
        || normalizedCode.includes(normalizedQuery);
    });
  }

  function renderGlyphGrid() {
    const glyphs = visibleGlyphs();
    grid.replaceChildren();

    if (!glyphs.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "Nenhum glifo encontrado.";
      grid.append(empty);
    } else {
      const fragment = document.createDocumentFragment();

      glyphs.forEach(item => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "glyph-tile";
        button.dataset.code = item.code;
        button.setAttribute(
          "aria-label",
          `${item.name}, ${item.code}. Passe o cursor para visualizar e clique para fixar e editar.`
        );
        button.setAttribute("aria-pressed", String(Boolean(pinnedGlyph && pinnedGlyph.code === item.code)));

        const visual = document.createElement("span");
        visual.className = "tile-char";
        const display = displayCharacter(item);
        visual.textContent = display.text;
        if (display.special) visual.classList.add("tile-special");
        applyVariation(visual, REGULAR_ENTROPY, REGULAR_WEIGHT);

        const label = document.createElement("span");
        label.className = "tile-label";
        label.textContent = item.code;
        button.append(visual, label);

        button.addEventListener("pointerenter", () => randomizeHover(item));
        button.addEventListener("focus", () => randomizeHover(item));
        button.addEventListener("pointerleave", () => clearHover(item));
        button.addEventListener("blur", () => clearHover(item));
        button.addEventListener("click", () => pinGlyph(item));

        fragment.append(button);
      });

      grid.append(fragment);
    }

    updateGridSelection();
    $("#glyphCount").textContent = `${glyphs.length} ${glyphs.length === 1 ? "GLIFO" : "GLIFOS"}`;
    $("#allCount").textContent = allGlyphs.length;
  }

  function initTester() {
    const input = $("#testerInput");
    const preview = $("#testerPreview");
    const sync = () => {
      preview.textContent = input.value || " ";
      updateTesterVariation();
    };
    input.addEventListener("input", sync);
    sync();
  }

  function initAnimatedBrand() {
    const parts = [
      { host: $("#brandLetters"), text: "ENTROPIA", offset: 0 },
      { host: $("#brandSub"), text: "GROTESCA", offset: 420 }
    ];

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      parts.forEach(({ host, text }) => {
        if (host) host.textContent = text;
      });
      return;
    }

    parts.forEach(({ host, text, offset }) => {
      if (!host) return;
      host.replaceChildren();
      [...text].forEach((character, index) => {
        const node = document.createElement("span");
        node.textContent = character;
        node.setAttribute("aria-hidden", "true");
        host.append(node);

        const animateIndividually = () => {
          const nextEntropy = Math.floor(Math.random() * 101);
          const nextWeight = REGULAR_WEIGHT + Math.floor(Math.random() * 81);
          node.style.fontVariationSettings = variation(nextEntropy, nextWeight);
          const delay = 760 + Math.random() * 1600 + (index % 4) * 80;
          window.setTimeout(animateIndividually, delay);
        };

        window.setTimeout(animateIndividually, offset + 220 + index * 105);
      });
    });
  }

  entropyRange.addEventListener("input", () => setAxes(entropyRange.value, weight));
  weightRange.addEventListener("input", () => setAxes(entropy, weightRange.value));
  resetButton.addEventListener("click", () => setAxes(REGULAR_ENTROPY, REGULAR_WEIGHT));
  search.addEventListener("input", renderGlyphGrid);
  search.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      search.value = "";
      renderGlyphGrid();
      search.blur();
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
      event.preventDefault();
      search.focus();
    }
  });

  initTester();
  initAnimatedBrand();
  renderGlyphGrid();
  setControlsEnabled(false);
  updateAxisUI();
  updateDisplayedGlyph();
  updateTesterVariation();

  document.fonts.ready.then(() => {
    if (!document.fonts.check('16px "Entropia Grotesca"')) {
      showToast("A Entropia não carregou. Confira o arquivo em assets/fonts.");
    }
  }).catch(() => showToast("Não foi possível verificar o carregamento da fonte."));
})();
