/* TillMate — UK Coin Weight Counter
 * Tech: Bootstrap + jQuery
 * Units: grams
 */

(function () {
    "use strict";

    const STORAGE_KEY = "tillmate_coin_weights_v1";
    const STORAGE_PREFS = "tillmate_prefs_v1";

    // Default UK coin weights (grams) — as provided/confirmed by you (10p = 6.5g).
    // Note: You can edit these in the UI and Save to localStorage.
    const DEFAULT_COINS = [
        { key: "gbp2", label: "£2", value: 2.00, weight_g: 12.00 },
        { key: "gbp1", label: "£1", value: 1.00, weight_g: 8.75 },
        { key: "p50", label: "50p", value: 0.50, weight_g: 8.00 },
        { key: "p20", label: "20p", value: 0.20, weight_g: 5.00 },
        { key: "p10", label: "10p", value: 0.10, weight_g: 6.50 },
        { key: "p5", label: "5p", value: 0.05, weight_g: 3.25 },
        { key: "p2", label: "2p", value: 0.02, weight_g: 7.12 },
        { key: "p1", label: "1p", value: 0.01, weight_g: 3.56 }
    ];

    // State
    let coins = [];
    let roundingMode = "round"; // round | floor | ceil

    // Helpers
    function toNumber(val) {
        const n = parseFloat(String(val).replace(",", "."));
        return Number.isFinite(n) ? n : 0;
    }

    function clampNonNegative(n) {
        return n < 0 ? 0 : n;
    }

    function formatGBP(amount) {
        // Keep it simple & consistent
        return "£" + amount.toFixed(2);
    }

    function roundByMode(n, mode) {
        if (mode === "floor") return Math.floor(n);
        if (mode === "ceil") return Math.ceil(n);
        return Math.round(n);
    }

    function loadWeights() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return DEFAULT_COINS.map(c => ({ ...c }));
            const parsed = JSON.parse(raw);

            // Merge safely (keep defaults for missing fields)
            const map = new Map(parsed.map(x => [x.key, x]));
            return DEFAULT_COINS.map(d => {
                const saved = map.get(d.key);
                if (!saved) return { ...d };
                return {
                    ...d,
                    weight_g: Number.isFinite(saved.weight_g) ? saved.weight_g : d.weight_g
                };
            });
        } catch {
            return DEFAULT_COINS.map(c => ({ ...c }));
        }
    }

    function loadPrefs() {
        try {
            const raw = localStorage.getItem(STORAGE_PREFS);
            if (!raw) return;
            const p = JSON.parse(raw);
            if (p && (p.roundingMode === "round" || p.roundingMode === "floor" || p.roundingMode === "ceil")) {
                roundingMode = p.roundingMode;
            }
        } catch {
            // ignore
        }
    }

    function saveAll() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(coins.map(c => ({ key: c.key, weight_g: c.weight_g }))));
        localStorage.setItem(STORAGE_PREFS, JSON.stringify({ roundingMode }));
    }

    function setRoundingUI(mode) {
        roundingMode = mode;
        $("#roundModeRound, #roundModeFloor, #roundModeCeil").removeClass("active");
        if (mode === "floor") $("#roundModeFloor").addClass("active");
        else if (mode === "ceil") $("#roundModeCeil").addClass("active");
        else $("#roundModeRound").addClass("active");
    }

    function renderTable() {
        const $tbody = $("#coinTbody");
        $tbody.empty();

        coins.forEach((c, idx) => {
            const row = `
        <tr data-key="${c.key}">
          <td>
            <span class="badge text-bg-primary coin-badge">${c.label}</span>
            <div class="small text-secondary mono">£${c.value.toFixed(2)} each</div>
          </td>

          <td class="text-end mono">
            <span>${c.weight_g.toFixed(2)}</span>
          </td>

          <td>
            <input type="number" inputmode="decimal" step="0.01"
              class="form-control form-control-sm js-weight"
              placeholder="e.g. 120"
              aria-label="${c.label} weight grams">
          </td>

          <td>
            <input type="number" inputmode="decimal" step="0.01"
              class="form-control form-control-sm js-tare"
              value="0"
              aria-label="${c.label} tare grams">
          </td>

          <td class="text-end mono js-net">0.00</td>
          <td class="text-end mono js-count">0</td>
          <td class="text-end mono js-total">£0.00</td>

          <td>
            <button class="btn btn-outline-secondary btn-sm js-reset-row">Reset</button>
          </td>
        </tr>
      `;
            $tbody.append(row);
        });

        recalcAll();
    }

    function renderWeightsEditor() {
        const $wrap = $("#weightsEditor");
        $wrap.empty();

        coins.forEach(c => {
            const col = `
        <div class="col-12 col-sm-6 col-lg-3">
          <label class="form-label small mb-1">${c.label} weight (g)</label>
          <div class="input-group input-group-sm">
            <span class="input-group-text">${c.label}</span>
            <input type="number" step="0.01" inputmode="decimal"
              class="form-control js-edit-weight"
              data-key="${c.key}"
              value="${c.weight_g}">
          </div>
        </div>
      `;
            $wrap.append(col);
        });
    }

    function recalcRow($tr) {
        const key = $tr.data("key");
        const coin = coins.find(x => x.key === key);
        if (!coin) return;

        const weight = toNumber($tr.find(".js-weight").val());
        const tare = toNumber($tr.find(".js-tare").val());
        const net = clampNonNegative(weight - tare);

        const rawCount = coin.weight_g > 0 ? (net / coin.weight_g) : 0;
        const count = clampNonNegative(roundByMode(rawCount, roundingMode));

        const total = count * coin.value;

        $tr.find(".js-net").text(net.toFixed(2));
        $tr.find(".js-count").text(String(count));
        $tr.find(".js-total").text(formatGBP(total));
    }

    function recalcAll() {
        let grandCoins = 0;
        let grandTotal = 0;

        $("#coinTbody tr").each(function () {
            const $tr = $(this);
            recalcRow($tr);

            const key = $tr.data("key");
            const coin = coins.find(x => x.key === key);
            const count = toNumber($tr.find(".js-count").text());

            grandCoins += count;
            grandTotal += count * (coin ? coin.value : 0);
        });

        $("#grandCoins").text(String(grandCoins));
        $("#grandTotal").text(formatGBP(grandTotal));
    }

    function resetRow($tr) {
        $tr.find(".js-weight").val("");
        $tr.find(".js-tare").val("0");
        recalcRow($tr);
        recalcAll();
    }

    function clearInputsAll() {
        $("#coinTbody tr").each(function () {
            $(this).find(".js-weight").val("");
            $(this).find(".js-tare").val("0");
        });
        recalcAll();
    }

    function resetAllToDefaults() {
        coins = DEFAULT_COINS.map(c => ({ ...c }));
        localStorage.removeItem(STORAGE_KEY);
        renderWeightsEditor();
        renderTable();
    }

    function fillDemo() {
        // Example demo weights (grams)
        const demo = {
            gbp2: 120, // 10 coins ~ £20
            gbp1: 176, // 20 coins ~ £20 (approx with 8.75g => 20 coins = 175g)
            p50: 160,
            p20: 250,
            p10: 130,
            p5: 65,
            p2: 71.2,
            p1: 35.6
        };

        $("#coinTbody tr").each(function () {
            const $tr = $(this);
            const key = $tr.data("key");
            if (demo[key] !== undefined) {
                $tr.find(".js-weight").val(String(demo[key]));
                $tr.find(".js-tare").val("0");
            }
        });

        recalcAll();
    }

    function init() {
        $("#year").text(String(new Date().getFullYear()));

        loadPrefs();
        setRoundingUI(roundingMode);

        coins = loadWeights();
        renderWeightsEditor();
        renderTable();

        // Events: inputs
        $("#coinTbody")
            .on("input", ".js-weight, .js-tare", function () {
                const $tr = $(this).closest("tr");
                recalcRow($tr);
                recalcAll();
            })
            .on("click", ".js-reset-row", function () {
                const $tr = $(this).closest("tr");
                resetRow($tr);
            });

        // Rounding mode buttons
        $("#roundModeRound, #roundModeFloor, #roundModeCeil").on("click", function () {
            const mode = $(this).data("rounding");
            setRoundingUI(mode);
            saveAll();
            recalcAll();
        });

        // Weights editor
        $("#weightsEditor").on("input", ".js-edit-weight", function () {
            const key = $(this).data("key");
            const val = toNumber($(this).val());
            const coin = coins.find(x => x.key === key);
            if (coin && val > 0) {
                coin.weight_g = val;
                // Update table display weight column
                $(`#coinTbody tr[data-key="${key}"] td:nth-child(2) span`).text(val.toFixed(2));
                recalcAll();
            }
        });

        $("#btnSave").on("click", function () {
            saveAll();
            // Tiny feedback
            $(this).text("Saved ✓");
            setTimeout(() => $(this).text("Save"), 900);
        });

        $("#btnResetAll").on("click", function () {
            resetAllToDefaults();
        });

        $("#btnClearInputs").on("click", function () {
            clearInputsAll();
        });

        $("#btnFillDemo").on("click", function () {
            fillDemo();
        });
    }

    $(init);
})();
