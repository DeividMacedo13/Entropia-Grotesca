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


  function initInteractiveCover() {
    const stage = $("#coverStage");
    const field = $("#coverGlyphField");
    if (!stage || !field) return;

    // Letras minúsculas da própria expressão, espalhadas de modo diferente a cada visita.
    const alphabet = [..."entropiagrotesca"].filter(character => character !== " ");
    let dragZ = 30;
    const stageRect = stage.getBoundingClientRect();
    // Menos caracteres, em escalas maiores, mantendo o respiro ao redor do título.
    const count = stageRect.width < 620 ? 22 : 38;

    const randomBetween = (min, max) => min + Math.random() * (max - min);
    const pick = values => values[Math.floor(Math.random() * values.length)];

    function randomPosition() {
      // Reserva a área central para o título em duas linhas; a dispersão ocupa as bordas.
      let x = 0, y = 0, attempts = 0;
      do {
        x = randomBetween(2.5, 97.5);
        y = randomBetween(4, 96);
        attempts += 1;
      } while (attempts < 80 && x > 17 && x < 83 && y > 30 && y < 70);
      return { x, y };
    }

    function applyPosition(button, x, y) {
      button.dataset.x = String(x);
      button.dataset.y = String(y);
      button.style.left = `${x}%`;
      button.style.top = `${y}%`;
    }

    function makeGlyph(index) {
      const button = document.createElement("button");
      const position = randomPosition();
      const size = pick([34, 44, 56, 70, 86, 104, 124, 146, 168, 190]);
      const entp = Math.round(randomBetween(5, 100));
      const weight = Math.round(randomBetween(80, 160));
      const rotation = Math.round(randomBetween(-32, 32));
      const color = Math.random() < 0.76 ? "magenta" : "black";

      button.type = "button";
      button.className = `cover-glyph cover-${color}`;
      button.textContent = pick(alphabet);
      button.style.fontSize = `clamp(${Math.max(12, size * 0.62)}px, ${size / 13}vw, ${size}px)`;
      button.style.fontVariationSettings = variation(entp, weight);
      button.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;
      button.style.zIndex = String(1 + Math.floor(Math.random() * 5));
      button.dataset.rotation = String(rotation);
      button.setAttribute("aria-label", `Letra minúscula ${button.textContent}. Arraste para mover.`);
      button.title = "Arraste esta letra para mover";
      applyPosition(button, position.x, position.y);

      let pointerStart = null;
      button.addEventListener("pointerdown", event => {
        if (event.button !== undefined && event.button !== 0) return;
        event.preventDefault();
        const rect = stage.getBoundingClientRect();
        pointerStart = {
          pointerId: event.pointerId,
          clientX: event.clientX,
          clientY: event.clientY,
          x: Number(button.dataset.x),
          y: Number(button.dataset.y),
          width: rect.width,
          height: rect.height
        };
        button.classList.add("is-dragging");
        button.style.zIndex = String(++dragZ);
        button.setPointerCapture(event.pointerId);
      });

      button.addEventListener("pointermove", event => {
        if (!pointerStart || event.pointerId !== pointerStart.pointerId) return;
        event.preventDefault();
        const dx = ((event.clientX - pointerStart.clientX) / pointerStart.width) * 100;
        const dy = ((event.clientY - pointerStart.clientY) / pointerStart.height) * 100;
        const nextX = Math.max(1.5, Math.min(98.5, pointerStart.x + dx));
        const nextY = Math.max(2, Math.min(98, pointerStart.y + dy));
        applyPosition(button, nextX, nextY);
      });

      const finishDrag = event => {
        if (!pointerStart || event.pointerId !== pointerStart.pointerId) return;
        pointerStart = null;
        button.classList.remove("is-dragging");
      };
      button.addEventListener("pointerup", finishDrag);
      button.addEventListener("pointercancel", finishDrag);
      button.addEventListener("lostpointercapture", () => {
        pointerStart = null;
        button.classList.remove("is-dragging");
      });

      button.addEventListener("keydown", event => {
        const step = event.shiftKey ? 3 : 1;
        let nextX = Number(button.dataset.x);
        let nextY = Number(button.dataset.y);
        if (event.key === "ArrowLeft") nextX -= step;
        else if (event.key === "ArrowRight") nextX += step;
        else if (event.key === "ArrowUp") nextY -= step;
        else if (event.key === "ArrowDown") nextY += step;
        else return;
        event.preventDefault();
        nextX = Math.max(1.5, Math.min(98.5, nextX));
        nextY = Math.max(2, Math.min(98, nextY));
        applyPosition(button, nextX, nextY);
        button.style.zIndex = String(++dragZ);
      });

      field.append(button);
    }

    field.replaceChildren();
    for (let index = 0; index < count; index += 1) makeGlyph(index);

  }

  function initIdleAsterisk() {
    const screen = $("#idleScreen");
    const asterisk = $("#idleAsterisk");
    if (!screen || !asterisk) return;

    const IDLE_DELAY = 18000;
    let idleTimer = 0;
    let animationFrame = 0;
    let visible = false;
    let lastFrame = 0;
    let x = 0;
    let y = 0;
    let vx = 0;
    let vy = 0;
    let rotation = 0;
    let scale = 1;
    let currentEntropy = 35;
    let currentWeight = 160;

    const randomBetween = (min, max) => min + Math.random() * (max - min);

    function applyShape() {
      // Cada colisão provoca uma mudança perceptível na forma do asterisco.
      let nextEntropy = Math.floor(randomBetween(0, 101));
      if (Math.abs(nextEntropy - currentEntropy) < 28) {
        nextEntropy = (nextEntropy + Math.floor(randomBetween(38, 64))) % 101;
      }

      let nextWeight = Math.floor(randomBetween(80, 161));
      if (Math.abs(nextWeight - currentWeight) < 24) {
        nextWeight = nextWeight < 120
          ? Math.min(160, nextWeight + Math.floor(randomBetween(28, 42)))
          : Math.max(80, nextWeight - Math.floor(randomBetween(28, 42)));
      }

      currentEntropy = nextEntropy;
      currentWeight = nextWeight;
      rotation = randomBetween(-32, 32);
      scale = randomBetween(.88, 1.16);
      asterisk.style.fontVariationSettings = variation(currentEntropy, currentWeight);
      // O ponto de origem coincide com o centro óptico do glifo dentro da caixa de linha.
      // Assim, a rotação não desloca o asterisco lateralmente nem cria uma margem falsa.
      asterisk.style.transformOrigin = "50% 21%";
      asterisk.style.transform = `translate(-50%, -21%) rotate(${rotation}deg) scale(${scale})`;
    }

    function getHalfBounds() {
      // A altura da caixa de linha é muito maior que o desenho visível do asterisco.
      // O glifo ocupa cerca de 0,30 em; usamos sua metade real multiplicada pela escala,
      // com apenas 2 px de segurança. Isso elimina a margem invisível das colisões.
      const fontSize = parseFloat(getComputedStyle(asterisk).fontSize) || 680;
      const visibleGlyphHalf = fontSize * .155 * scale + 2;
      return {
        halfWidth: visibleGlyphHalf,
        halfHeight: visibleGlyphHalf
      };
    }

    function keepInsideViewport() {
      const { halfWidth, halfHeight } = getHalfBounds();
      const maxX = Math.max(halfWidth, window.innerWidth - halfWidth);
      const maxY = Math.max(halfHeight, window.innerHeight - halfHeight);
      x = Math.min(maxX, Math.max(halfWidth, x));
      y = Math.min(maxY, Math.max(halfHeight, y));
      asterisk.style.left = `${x}px`;
      asterisk.style.top = `${y}px`;
    }

    function animate(now) {
      if (!visible || document.hidden) return;
      if (!lastFrame) lastFrame = now;
      const delta = Math.min((now - lastFrame) / 1000, .04);
      lastFrame = now;

      x += vx * delta;
      y += vy * delta;

      let bouncedX = false;
      let bouncedY = false;
      let bounds = getHalfBounds();
      const maxX = Math.max(bounds.halfWidth, window.innerWidth - bounds.halfWidth);
      const maxY = Math.max(bounds.halfHeight, window.innerHeight - bounds.halfHeight);

      if (x <= bounds.halfWidth) {
        x = bounds.halfWidth;
        vx = Math.abs(vx);
        bouncedX = true;
      } else if (x >= maxX) {
        x = maxX;
        vx = -Math.abs(vx);
        bouncedX = true;
      }

      if (y <= bounds.halfHeight) {
        y = bounds.halfHeight;
        vy = Math.abs(vy);
        bouncedY = true;
      } else if (y >= maxY) {
        y = maxY;
        vy = -Math.abs(vy);
        bouncedY = true;
      }

      if (bouncedX || bouncedY) {
        // O asterisco muda de desenho no exato momento em que toca uma borda.
        applyShape();
        bounds = getHalfBounds();
        const nextMaxX = Math.max(bounds.halfWidth, window.innerWidth - bounds.halfWidth);
        const nextMaxY = Math.max(bounds.halfHeight, window.innerHeight - bounds.halfHeight);
        x = Math.min(nextMaxX, Math.max(bounds.halfWidth, x));
        y = Math.min(nextMaxY, Math.max(bounds.halfHeight, y));
      }

      asterisk.style.left = `${x}px`;
      asterisk.style.top = `${y}px`;
      animationFrame = window.requestAnimationFrame(animate);
    }

    function startMotion() {
      const bounds = getHalfBounds();
      const minX = bounds.halfWidth;
      const maxX = Math.max(minX, window.innerWidth - bounds.halfWidth);
      const minY = bounds.halfHeight;
      const maxY = Math.max(minY, window.innerHeight - bounds.halfHeight);
      x = randomBetween(minX, maxX);
      y = randomBetween(minY, maxY);
      const speed = randomBetween(215, 270);
      const angle = randomBetween(-Math.PI * .42, Math.PI * .42);
      const horizontalDirection = Math.random() < .5 ? -1 : 1;
      const verticalDirection = Math.random() < .5 ? -1 : 1;
      vx = Math.cos(angle) * speed * horizontalDirection;
      vy = Math.sin(angle) * speed * verticalDirection;
      if (Math.abs(vy) < 80) vy = 80 * verticalDirection;
      lastFrame = 0;
      asterisk.style.left = `${x}px`;
      asterisk.style.top = `${y}px`;
      // A forma inicial é aleatória; depois só se transforma nas colisões.
      applyShape();
      animationFrame = window.requestAnimationFrame(animate);
    }

    function stopMotion() {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      lastFrame = 0;
    }

    function hideIdleScreen() {
      if (!visible) {
        scheduleIdle();
        return;
      }
      visible = false;
      stopMotion();
      screen.classList.remove("is-visible");
      screen.setAttribute("aria-hidden", "true");
      scheduleIdle();
    }

    function showIdleScreen() {
      if (document.hidden) return;
      visible = true;
      screen.classList.add("is-visible");
      screen.setAttribute("aria-hidden", "false");
      startMotion();
    }

    function scheduleIdle() {
      window.clearTimeout(idleTimer);
      if (document.hidden) return;
      idleTimer = window.setTimeout(showIdleScreen, IDLE_DELAY);
    }

    window.addEventListener("resize", () => {
      if (visible) keepInsideViewport();
    }, { passive: true });

    const activityEvents = ["pointermove", "pointerdown", "keydown", "wheel", "scroll", "touchstart", "click"];
    activityEvents.forEach(eventName => {
      document.addEventListener(eventName, hideIdleScreen, { passive: true, capture: true });
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        window.clearTimeout(idleTimer);
        stopMotion();
        if (visible) {
          visible = false;
          screen.classList.remove("is-visible");
          screen.setAttribute("aria-hidden", "true");
        }
      } else {
        scheduleIdle();
      }
    });

    scheduleIdle();
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

  initInteractiveCover();
  initIdleAsterisk();
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
