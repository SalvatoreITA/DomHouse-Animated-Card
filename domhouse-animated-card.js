console.info("%c ⏱️ DOMHOUSE-ANIMATED-CARD v33.0 (HA 2026.5+ EDITOR FIX) IS LOADED ", "color: white; background: #000000; font-weight: bold; border: 1px solid white;");

const LitElement = customElements.get("ha-panel-lovelace")
  ? Object.getPrototypeOf(customElements.get("ha-panel-lovelace"))
  : Object.getPrototypeOf(customElements.get("hc-lovelace"));
const html = LitElement.prototype.html;
const css = LitElement.prototype.css;

// Helper per lanciare eventi correttamente (CustomEvent, non Event)
function fireEvent(node, type, detail = {}) {
  const event = new CustomEvent(type, { detail, bubbles: true, composed: true });
  node.dispatchEvent(event);
  return event;
}

// =============================================================================
//  MAIN CARD CLASS
// =============================================================================
class DomHouseAnimatedCard extends LitElement {
  static get properties() {
    return {
      _config: {},
      hass: {},
    };
  }

  static getConfigElement() {
    return document.createElement("domhouse-animated-card-editor");
  }

  static getStubConfig() {
    return {
      name: "Orologio DomHouse",
      entity: "sensor.time",
      date_entity: "sensor.data_italiana",

      // Stile / dimensioni
      time_size: "2.4rem",
      date_size: "1.5rem",
      row_size: "1.1rem",
      row_height: 24,       // altezza box riga (px) - DEVE seguire il font per non tagliare
      border_radius: 12,    // angoli card (px)

      // Animazione
      slide_duration: 4,
      transition_duration: 1,

      // Clean Start
      row_1_label_1: "",
      row_1_entity_1: ""
    };
  }

  setConfig(config) {
    if (!config) throw new Error("Configurazione non valida");
    this._config = config;
  }

  // HA usa questo per il layout (masonry). Prima mancava -> veniva trattata come size 1.
  getCardSize() {
    return 2;
  }

  isEntityValid(entityId) {
    if (!entityId || entityId === "" || entityId === null) return false;
    if (!this.hass || !this.hass.states) return false;
    const stateObj = this.hass.states[entityId];
    return stateObj && stateObj.state && stateObj.state !== 'unavailable' && stateObj.state !== 'unknown';
  }

  // Helper per lo stato (spaziato o no)
  getState(entityId, spaced = false) {
    if (!this.isEntityValid(entityId)) return "--";
    const state = this.hass.states[entityId].state;
    const unit = this.hass.states[entityId].attributes.unit_of_measurement || "";

    if (spaced) {
      return `${state} ${unit}`; // Con spazio (es. "0.01 kWh")
    } else {
      return `${state}${unit}`;  // Senza spazio (es. "7.0°C")
    }
  }

  // Elenco entità effettivamente usate (per shouldUpdate)
  _usedEntityIds() {
    const ids = [];
    if (this._config.entity) ids.push(this._config.entity);
    if (this._config.date_entity) ids.push(this._config.date_entity);
    for (let i = 1; i <= 5; i++) {
      if (this._config[`row_${i}_entity_1`]) ids.push(this._config[`row_${i}_entity_1`]);
      if (this._config[`row_${i}_entity_2`]) ids.push(this._config[`row_${i}_entity_2`]);
    }
    return ids;
  }

  // Evita render inutili ad ogni tick di hass: aggiorna solo se cambia la config
  // o lo stato di una delle entità usate. L'animazione è CSS, non serve ri-renderare.
  shouldUpdate(changedProps) {
    if (changedProps.has("_config")) return true;
    const oldHass = changedProps.get("hass");
    if (!oldHass || !this.hass) return true;
    return this._usedEntityIds().some(id => oldHass.states[id] !== this.hass.states[id]);
  }

  _handleAction() {
    if (this._config.tap_action) {
      fireEvent(this, "hass-action", { config: this._config, action: "tap" });
    } else if (this._config.entity) {
      fireEvent(this, "hass-more-info", { entityId: this._config.entity });
    }
  }

  render() {
    if (!this._config || !this.hass) return html``;

    // --- SETUP ---
    const sizeTime = this._config.time_size || "2.4rem";
    const sizeDate = this._config.date_size || "1.5rem";
    const sizeRow = this._config.row_size || "1.1rem";

    // Altezza riga: usata SIA in JS (keyframes) SIA in CSS (box) -> sempre sincronizzate
    const rowHeight = parseInt(this._config.row_height, 10) || 24;

    // Border radius: se impostato uso il valore, altrimenti eredito dal tema
    const hasRadius = this._config.border_radius !== undefined
      && this._config.border_radius !== null
      && this._config.border_radius !== "";
    const radius = hasRadius
      ? `${parseInt(this._config.border_radius, 10)}px`
      : "var(--ha-card-border-radius, 12px)";

    const slideDuration = parseFloat(this._config.slide_duration) || 4;
    const transitionDuration = parseFloat(this._config.transition_duration) || 1;

    const hasDate = this.isEntityValid(this._config.date_entity);
    const hasTime = this.isEntityValid(this._config.entity);

    // --- 1. DATA ---
    let dateHtml = html``;
    if (hasDate) {
      const dateValue = this.hass.states[this._config.date_entity].state;
      dateHtml = html`<div class="date" style="font-size: ${sizeDate};">${dateValue}</div>`;
    }

    // --- 2. ORA ---
    let timeHtml = html``;
    if (hasTime) {
      const timeValue = this.hass.states[this._config.entity].state;
      timeHtml = html`<div class="time" style="font-size: ${sizeTime};">${timeValue}</div>`;
    }

    // --- 3. FLIPPER ---
    const slides = [];
    const maxRows = 5;

    for (let i = 1; i <= maxRows; i++) {
      const label1 = this._config[`row_${i}_label_1`] || "";
      const entity1 = this._config[`row_${i}_entity_1`];
      const label2 = this._config[`row_${i}_label_2`] || "";
      const entity2 = this._config[`row_${i}_entity_2`];

      if (this.isEntityValid(entity1)) {

        if (this.isEntityValid(entity2)) {
          // DUE SENSORI: Compatto + 1 Spazio
          const val1 = this.getState(entity1, false);
          const val2 = this.getState(entity2, false);

          slides.push(html`
            <span>${label1}<strong>${val1}</strong>&nbsp;${label2}<strong>${val2}</strong></span>
          `);
        } else {
          // UN SENSORE: Spaziato
          const val1 = this.getState(entity1, true);

          slides.push(html`
            <span>${label1}&nbsp;<strong>${val1}</strong></span>
          `);
        }
      }
    }

    // Fallback (fix: niente più confronto fra TemplateResult, uso flag booleani)
    if (slides.length === 0) {
      slides.push(html`<span>${(!hasDate && !hasTime) ? "DomHouse - Configura Card" : "DomHouse"}</span>`);
    }

    // --- ANIMAZIONE ---
    const count = slides.length;
    const animate = count > 1; // con 1 sola slide niente animazione (no micro-scatto)

    let keyframes = "";
    let animationStyle = "";

    if (animate) {
      const durationPerSlide = slideDuration + transitionDuration;
      const totalDuration = Math.max(count * durationPerSlide, 1);

      let transitionPercent = (transitionDuration / totalDuration) * 100;
      const stepPercent = 100 / count;
      if (transitionPercent >= stepPercent) {
        transitionPercent = stepPercent * 0.9;
      }

      keyframes = `@keyframes show {`;
      for (let i = 0; i <= count; i++) {
        const currentStepStart = i * stepPercent;
        const nextStepStart = (i + 1) * stepPercent;
        const marginTop = -(i * rowHeight);
        keyframes += `${currentStepStart}% { margin-top: ${marginTop}px; } `;
        if (i < count) {
          const startSlideTime = nextStepStart - transitionPercent;
          keyframes += `${startSlideTime}% { margin-top: ${marginTop}px; } `;
        }
      }
      keyframes += `}`;
      animationStyle = `animation: show ${totalDuration}s linear infinite;`;
    }

    const renderSlides = animate ? [...slides, slides[0]] : slides;

    return html`
      <ha-card @click="${this._handleAction}" style="border-radius: ${radius};">
        <style>
          ${keyframes}
          #flip { ${animationStyle} }
        </style>

        <div class="content">
          ${dateHtml}
          ${timeHtml}

          <div id="flipper" style="height: ${rowHeight}px;">
            <div id="flip">
              ${renderSlides.map(slideContent => html`<div class="slide" style="font-size: ${sizeRow}; height: ${rowHeight}px;">${slideContent}</div>`)}
            </div>
          </div>
        </div>
      </ha-card>
    `;
  }

  static get styles() {
    return css`
      :host { cursor: pointer; display: block; }
      ha-card {
        background: var(--ha-card-background, var(--card-background-color, #1c1c1c));
        color: var(--primary-text-color, #ffffff);
        padding: 16px;
        display: flex; flex-direction: column; justify-content: center; align-items: center;
        box-shadow: var(--ha-card-box-shadow, none);
        box-sizing: border-box;
      }
      .content { width: 100%; text-align: center; }

      .date {
        font-family: var(--paper-font-body1_-_font-family, sans-serif);
        margin-bottom: 5px;
        line-height: 1.2;
        color: var(--primary-text-color, #ffffff);
        font-weight: 400;
      }

      .time {
        font-family: var(--paper-font-body1_-_font-family, sans-serif);
        font-weight: 700; line-height: 1; margin-bottom: 8px;
        color: var(--primary-text-color, #fff);
        white-space: nowrap;
      }

      #flipper {
        width: 100%; overflow: hidden; position: relative;
        mask-image: linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%);
        -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%);
      }
      #flip { width: 100%; }

      .slide {
        display: flex;
        justify-content: center;
        align-items: center;
        font-family: var(--paper-font-body1_-_font-family, sans-serif);
        white-space: nowrap;
        color: var(--primary-text-color, #ffffff);
        font-weight: 400; /* NO GRASSETTO */
      }

      strong {
        margin-left: 0px;
        margin-right: 0px;
        color: inherit;
        font-weight: inherit;
      }
    `;
  }
}
customElements.define("domhouse-animated-card", DomHouseAnimatedCard);


// =============================================================================
//  EDITOR CLASS (ha-selector ovunque -> compatibile HA 2026.5+)
// =============================================================================
class DomHouseAnimatedCardEditor extends LitElement {
  static get properties() {
    return { hass: {}, _config: {}, _helpersLoaded: {} };
  }

  setConfig(config) { this._config = config; }

  // FIX ROTTURA HA 2026.5: ha-textfield rimosso. Garantisco il caricamento
  // dei componenti frontend (ha-selector & co.) prima di renderare l'editor.
  async connectedCallback() {
    super.connectedCallback();
    await this._ensureComponents();
  }

  async _ensureComponents() {
    if (!customElements.get("ha-selector")) {
      try { await window.loadCardHelpers?.(); } catch (e) { /* no-op */ }
    }
    this._helpersLoaded = !!customElements.get("ha-selector");
    this.requestUpdate();
  }

  _valueChanged(ev) {
    ev.stopPropagation();
    if (!this._config || !this.hass) return;

    const target = ev.currentTarget;
    const configValue = target.configValue;
    if (!configValue) return;

    // Gli ha-selector emettono value-changed con detail.value (stringa/numero/undefined)
    let value = (ev.detail && "value" in ev.detail) ? ev.detail.value : target.value;

    if (this._config[configValue] === value) return;

    const newConfig = { ...this._config };
    if (value === "" || value === undefined || value === null) {
      delete newConfig[configValue];
    } else {
      newConfig[configValue] = value;
    }

    this._config = newConfig;
    fireEvent(this, "config-changed", { config: newConfig });
  }

  // Selettore generico con label
  _selector(selector, configValue, label, value) {
    return html`
      <ha-selector
        .hass=${this.hass}
        .selector=${selector}
        .value=${value}
        .label=${label}
        .configValue=${configValue}
        @value-changed=${this._valueChanged}
      ></ha-selector>
    `;
  }

  _renderRowEditor(index) {
    const entitySel = { entity: { domain: ["sensor", "input_number"] } };
    const textSel = { text: {} };
    return html`
      <div class="sensor-group">
        <h4>Riga Animata ${index}</h4>

        <div class="vertical-inputs">
          ${this._selector(textSel, `row_${index}_label_1`, "Testo 1", this._config[`row_${index}_label_1`] || "")}
          ${this._selector(entitySel, `row_${index}_entity_1`, "Sensore 1", this._config[`row_${index}_entity_1`] || "")}
        </div>

        <div class="vertical-inputs" style="margin-top: 15px; border-top: 1px dashed var(--divider-color); padding-top: 10px;">
          ${this._selector(textSel, `row_${index}_label_2`, "Testo 2", this._config[`row_${index}_label_2`] || "")}
          ${this._selector(entitySel, `row_${index}_entity_2`, "Sensore 2 (Opz)", this._config[`row_${index}_entity_2`] || "")}
        </div>
      </div>
    `;
  }

  render() {
    if (!this.hass || !this._config) return html``;

    // Finché i componenti HA non sono registrati, evito di montare selettori inerti
    if (!customElements.get("ha-selector")) {
      return html`<div style="padding:16px; opacity:0.7;">Caricamento editor…</div>`;
    }

    const dtSel = { entity: { domain: ["sensor", "input_datetime"] } };
    const textSel = { text: {} };
    const numSel = { number: { mode: "box", min: 0, step: 0.5 } };
    const pxSel = { number: { mode: "box", min: 0, step: 1 } };

    return html`
      <div class="card-config">
        <h3>Orologio & Data</h3>
        ${this._selector(dtSel, "entity", "Sensore Orologio (Opzionale)", this._config.entity || "")}
        <div style="margin-top: 15px;">
          ${this._selector(dtSel, "date_entity", "Sensore Data (Opzionale)", this._config.date_entity || "")}
        </div>

        <h3>Stile & Dimensioni</h3>
        <div class="grid-inputs">
          ${this._selector(textSel, "time_size", "Dim. Orologio (es. 2.4rem)", this._config.time_size || "")}
          ${this._selector(textSel, "date_size", "Dim. Data (es. 1.5rem)", this._config.date_size || "")}
        </div>
        <div class="grid-inputs">
          ${this._selector(textSel, "row_size", "Dim. Righe (es. 1.1rem)", this._config.row_size || "")}
          ${this._selector(pxSel, "row_height", "Altezza Riga (px)", this._config.row_height ?? "")}
        </div>
        <div class="grid-inputs">
          ${this._selector(pxSel, "border_radius", "Angoli / Border Radius (px)", this._config.border_radius ?? "")}
        </div>

        <h3>Animazione</h3>
        <div class="grid-inputs">
          ${this._selector(numSel, "slide_duration", "Durata Slide (s)", this._config.slide_duration ?? "")}
          ${this._selector(numSel, "transition_duration", "Durata Transiz. (s)", this._config.transition_duration ?? "")}
        </div>

        <h3>Righe Animate</h3>
        ${this._renderRowEditor(1)}
        ${this._renderRowEditor(2)}
        ${this._renderRowEditor(3)}
        ${this._renderRowEditor(4)}
        ${this._renderRowEditor(5)}

        <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid var(--divider-color); text-align: center; opacity: 0.7; font-size: 0.9em;">
          Powered <a href="https://www.domhouse.it" target="_blank" style="color: var(--primary-color); text-decoration: none; font-weight: bold;">DomHouse.it</a>
        </div>

      </div>
    `;
  }

  static get styles() {
    return css`
      .card-config { padding: 10px; }
      h3 { margin-bottom: 5px; margin-top: 20px; border-bottom: 1px solid var(--divider-color); padding-bottom: 5px; }
      h4 { margin: 0 0 10px 0; }
      .sensor-group { background: var(--secondary-background-color); padding: 10px; border-radius: 8px; margin-bottom: 10px; border: 1px solid var(--divider-color); }

      /* STILE VERTICALE PER I SENSORI */
      .vertical-inputs { display: flex; flex-direction: column; gap: 8px; width: 100%; }

      /* STILE GRIGLIA PER LE OPZIONI GENERALI */
      .grid-inputs { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; align-items: end; margin-top: 10px; }

      ha-selector { width: 100%; display: block; }
    `;
  }
}
customElements.define("domhouse-animated-card-editor", DomHouseAnimatedCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "domhouse-animated-card",
  name: "DomHouse Animated Card",
  description: "Versione 33.0 (Fix editor HA 2026.5+ + border radius regolabile)",
  preview: true,
  documentationURL: "https://www.domhouse.it",
});
