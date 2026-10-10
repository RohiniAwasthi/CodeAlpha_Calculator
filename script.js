'use strict';

/* =========================================================
   Calculator – script.js
   Part 1: Calculator engine (pure logic, no DOM, no eval)
   Part 2: User interface (buttons, keyboard, history)
   ========================================================= */

/* ---------------------------------------------------------
   PART 1 – ENGINE
   --------------------------------------------------------- */

const MAX_DIGITS = 15;

// Button id -> operator symbol, and the reverse
const OPERATORS = { add: '+', subtract: '−', multiply: '×', divide: '÷' };
const OPERATOR_IDS = { '+': 'add', '−': 'subtract', '×': 'multiply', '÷': 'divide' };

/*
  The calculator state:
    tokens         – finished part of the expression, e.g. ['2', '+', '3', '×']
    current        – the number being typed or shown, as a string
    typing         – true while the user is typing digits into `current`
    operandEntered – false right after an operator is pressed (until a new number is entered)
    justEvaluated  – true right after "=" was pressed
    expressionText – text shown on the small display after "="
    repeat         – last operation, so pressing "=" again repeats it
    error          – error message, or null
*/
function createState() {
  return {
    tokens: [],
    current: '0',
    typing: false,
    operandEntered: true,
    justEvaluated: false,
    expressionText: '',
    repeat: null,
    error: null,
  };
}

function resetState(state) {
  Object.assign(state, createState());
}

/* ---------- Number helpers ---------- */

// Turns a number into a clean string and removes floating-point noise (0.1 + 0.2 -> 0.3)
function numberToString(value) {
  const rounded = Number(value.toPrecision(12));
  const size = Math.abs(rounded);
  if (size >= 1e15 || (size !== 0 && size < 1e-6)) {
    return rounded.toExponential(6).replace(/\.?0+e/, 'e');
  }
  return String(rounded);
}

// Normalises a typed string such as "5." or "-0" into a clean number string
function normalize(text) {
  return String(Number(text));
}

// Adds thousands separators while keeping what the user typed (like a trailing ".")
function formatEntry(text) {
  if (text.includes('e')) return text;
  const isNegative = text.startsWith('-');
  const body = isNegative ? text.slice(1) : text;
  const [integerPart, decimalPart] = body.split('.');
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const decimals = decimalPart !== undefined ? '.' + decimalPart : '';
  return (isNegative ? '-' : '') + grouped + decimals;
}

function formatExpression(tokens) {
  return tokens
    .map((token, index) => {
      if (token in OPERATOR_IDS) return token;
      const formatted = formatEntry(token);
      return index > 0 && token.startsWith('-') ? '(' + formatted + ')' : formatted;
    })
    .join(' ');
}

/* ---------- Evaluation (operator precedence, no eval) ---------- */

// tokens look like ['2', '+', '3', '×', '4'] and must start and end with a number
function evaluateTokens(tokens) {
  // Pass 1: handle × and ÷ first (higher precedence), left to right
  const values = [Number(tokens[0])];
  const addSubtractOps = [];

  for (let i = 1; i < tokens.length; i += 2) {
    const operator = tokens[i];
    const nextValue = Number(tokens[i + 1]);
    const last = values.length - 1;

    if (operator === '×') {
      values[last] *= nextValue;
    } else if (operator === '÷') {
      if (nextValue === 0) throw new Error('Cannot divide by 0');
      values[last] /= nextValue;
    } else {
      addSubtractOps.push(operator);
      values.push(nextValue);
    }
  }

  // Pass 2: handle + and −, left to right
  let result = values[0];
  addSubtractOps.forEach((operator, index) => {
    result = operator === '+' ? result + values[index + 1] : result - values[index + 1];
  });

  if (!Number.isFinite(result)) throw new Error('Number too large');
  return result;
}

/* ---------- Actions ---------- */

function startFreshIfNeeded(state) {
  // Typing right after "=" starts a brand new calculation
  if (state.justEvaluated) {
    state.tokens = [];
    state.justEvaluated = false;
    state.typing = false;
    state.expressionText = '';
  }
  // Typing right after an operator or a percentage starts a new number
  if (!state.typing) {
    state.current = '0';
    state.typing = true;
  }
  state.operandEntered = true;
}

function countDigits(text) {
  return text.replace(/[^0-9]/g, '').length;
}

function inputDigit(state, digit) {
  startFreshIfNeeded(state);
  if (countDigits(state.current) >= MAX_DIGITS) return;

  if (state.current === '0') state.current = digit;
  else if (state.current === '-0') state.current = '-' + digit;
  else state.current += digit;
}

function inputDecimal(state) {
  startFreshIfNeeded(state);
  if (state.current.includes('.')) return; // only one decimal point
  if (countDigits(state.current) >= MAX_DIGITS) return;
  state.current += '.';
}

function chooseOperator(state, operatorSymbol) {
  const waitingForNumber = state.tokens.length > 0 && !state.operandEntered;

  if (waitingForNumber) {
    // Pressed two operators in a row: replace the previous one
    state.tokens[state.tokens.length - 1] = operatorSymbol;
  } else {
    state.tokens.push(normalize(state.current), operatorSymbol);
  }

  state.justEvaluated = false;
  state.expressionText = '';
  state.typing = false;
  state.operandEntered = false;
}

function calculate(state) {
  let tokens;

  if (state.justEvaluated && state.repeat) {
    // Pressing "=" again repeats the last operation (e.g. 2 + 3 = = -> 8)
    tokens = [normalize(state.current), state.repeat.operator, state.repeat.operand];
  } else if (state.tokens.length > 0) {
    tokens = [...state.tokens, normalize(state.current)];
  } else {
    return null; // nothing to calculate
  }

  const expression = formatExpression(tokens);

  try {
    const result = numberToString(evaluateTokens(tokens));
    state.repeat = { operator: tokens[tokens.length - 2], operand: tokens[tokens.length - 1] };
    state.current = result;
    state.tokens = [];
    state.typing = false;
    state.operandEntered = true;
    state.justEvaluated = true;
    state.expressionText = expression + ' =';
    return { expression: expression + ' =', result };
  } catch (error) {
    state.error = error.message;
    state.tokens = [];
    state.justEvaluated = false;
    state.expressionText = expression + ' =';
    return null;
  }
}

function applyPercent(state) {
  const value = Number(state.current);
  const lastOperator = state.tokens[state.tokens.length - 1];
  let result;

  try {
    if (!state.justEvaluated && (lastOperator === '+' || lastOperator === '−')) {
      // 50 + 10% means "50 + 10% of 50"
      const base = evaluateTokens(state.tokens.slice(0, -1));
      result = (base * value) / 100;
    } else {
      result = value / 100;
    }
  } catch (error) {
    state.error = error.message;
    return;
  }

  if (state.justEvaluated) {
    state.tokens = [];
    state.justEvaluated = false;
    state.expressionText = '';
  }
  state.current = numberToString(result);
  state.typing = false;
  state.operandEntered = true;
}

function toggleSign(state) {
  if (state.tokens.length > 0 && !state.operandEntered) {
    // Right after an operator, ± begins a negative number
    state.current = '-0';
    state.typing = true;
    state.operandEntered = true;
    return;
  }
  if (state.current.startsWith('-')) state.current = state.current.slice(1);
  else if (state.current !== '0') state.current = '-' + state.current;
}

function backspace(state) {
  if (!state.typing) return; // results and operators cannot be partially deleted
  const isSingleDigit =
    state.current.length <= 1 || (state.current.length === 2 && state.current.startsWith('-'));
  state.current = isSingleDigit ? '0' : state.current.slice(0, -1);
}

function clearEntry(state) {
  if (state.justEvaluated) {
    resetState(state);
    return;
  }
  state.current = '0';
  if (state.tokens.length > 0) {
    state.typing = true;
    state.operandEntered = true;
  } else {
    state.typing = false;
  }
}

// Load a value from the history list as the current number
function loadValue(state, value) {
  resetState(state);
  state.current = value;
}

/* ---------- Single entry point for every button and key ---------- */

// Returns a history entry ({ expression, result }) when a calculation finishes, otherwise null
function press(state, id) {
  const isDigit = /^[0-9]$/.test(id);

  if (state.error) {
    // After an error, any "starting" input clears it; everything else is ignored
    if (isDigit || id === '.' || id === 'clear' || id === 'allclear' || id === 'backspace') {
      resetState(state);
    } else {
      return null;
    }
  }

  if (isDigit) {
    inputDigit(state, id);
    return null;
  }

  switch (id) {
    case '.':         inputDecimal(state); break;
    case 'add':
    case 'subtract':
    case 'multiply':
    case 'divide':    chooseOperator(state, OPERATORS[id]); break;
    case 'equals':    return calculate(state);
    case 'percent':   applyPercent(state); break;
    case 'sign':      toggleSign(state); break;
    case 'backspace': backspace(state); break;
    case 'clear':     clearEntry(state); break;
    case 'allclear':  resetState(state); break;
    default: break;
  }
  return null;
}

// What the screen should show for the current state
function getView(state) {
  const showSavedExpression = state.justEvaluated || state.error;
  const lastToken = state.tokens[state.tokens.length - 1];
  return {
    main: state.error || formatEntry(state.current),
    expression: showSavedExpression ? state.expressionText : formatExpression(state.tokens),
    activeOperator:
      state.tokens.length > 0 && !state.operandEntered ? OPERATOR_IDS[lastToken] : null,
  };
}

/* ---------------------------------------------------------
   PART 2 – USER INTERFACE
   --------------------------------------------------------- */

const HISTORY_LIMIT = 30;
const STORAGE_KEY = 'calculator-history-v1';

// Physical keyboard key -> button id
const KEY_MAP = {
  '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
  '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
  '.': '.',
  '+': 'add', '-': 'subtract', '*': 'multiply', 'x': 'multiply', 'X': 'multiply', '/': 'divide',
  '%': 'percent',
  'Enter': 'equals', '=': 'equals',
  'Backspace': 'backspace',
  'Escape': 'allclear',
  'Delete': 'clear',
};

function loadHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!Array.isArray(saved)) return [];
    return saved
      .filter((item) => item && typeof item.expression === 'string' && typeof item.result === 'string')
      .slice(0, HISTORY_LIMIT);
  } catch (error) {
    return [];
  }
}

function saveHistory(history) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (error) {
    /* storage may be blocked – the calculator still works without it */
  }
}

function initUI() {
  const state = createState();
  let history = loadHistory();

  const calculatorEl = document.querySelector('.calculator');
  const resultEl = document.getElementById('result');
  const expressionEl = document.getElementById('expression');
  const operatorButtons = document.querySelectorAll('.btn--op');
  const historyPanel = document.getElementById('history');
  const historyToggle = document.getElementById('history-toggle');
  const historyClear = document.getElementById('history-clear');
  const historyList = document.getElementById('history-list');
  const historyEmpty = document.getElementById('history-empty');

  /* ----- Drawing the screen ----- */

  // Shrinks the font until a long number fits the display
  function fitResultText() {
    resultEl.style.fontSize = '';
    let size = parseFloat(getComputedStyle(resultEl).fontSize);
    while (resultEl.scrollWidth > resultEl.clientWidth && size > 18) {
      size -= 2;
      resultEl.style.fontSize = size + 'px';
    }
  }

  function bumpResult() {
    resultEl.classList.remove('bump');
    void resultEl.offsetWidth; // restart the CSS animation
    resultEl.classList.add('bump');
  }

  function render() {
    const view = getView(state);

    resultEl.textContent = view.main;
    resultEl.classList.toggle('is-error', Boolean(state.error));
    fitResultText();

    expressionEl.textContent = view.expression || '\u00a0';
    expressionEl.scrollLeft = expressionEl.scrollWidth; // keep the newest part visible

    operatorButtons.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.id === view.activeOperator);
    });
  }

  function renderHistory() {
    historyList.textContent = '';
    historyEmpty.hidden = history.length > 0;

    history.forEach((entry) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      const expression = document.createElement('span');
      const result = document.createElement('span');

      button.type = 'button';
      button.className = 'history-item';
      button.setAttribute('aria-label', `Use result ${entry.result} from ${entry.expression}`);
      expression.className = 'history-expression';
      expression.textContent = entry.expression;
      result.className = 'history-result';
      result.textContent = formatEntry(entry.result);

      button.append(expression, result);
      button.addEventListener('click', () => {
        loadValue(state, entry.result);
        render();
        bumpResult();
        setHistoryOpen(false);
      });

      item.appendChild(button);
      historyList.appendChild(item);
    });
  }

  function setHistoryOpen(isOpen) {
    historyPanel.classList.toggle('is-open', isOpen);
    historyToggle.setAttribute('aria-expanded', String(isOpen));
  }

  /* ----- Handling input ----- */

  function handleInput(id) {
    const previousText = resultEl.textContent;
    const entry = press(state, id);

    if (entry) {
      history = [entry, ...history].slice(0, HISTORY_LIMIT);
      saveHistory(history);
      renderHistory();
    }

    render();
    if (resultEl.textContent !== previousText) bumpResult();
  }

  // Brief highlight on the on-screen button when a keyboard key is used
  function flashButton(id) {
    const button = calculatorEl.querySelector(`[data-id="${id}"]`);
    if (!button) return;
    button.classList.add('pressed');
    setTimeout(() => button.classList.remove('pressed'), 120);
  }

  calculatorEl.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-id]');
    if (button) handleInput(button.dataset.id);
  });

  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const id = KEY_MAP[event.key];
    if (!id) return;

    event.preventDefault(); // stops "/" quick-find and stops Enter from also clicking a focused button
    handleInput(id);
    flashButton(id);
  });

  historyToggle.addEventListener('click', () => {
    setHistoryOpen(!historyPanel.classList.contains('is-open'));
  });

  historyClear.addEventListener('click', () => {
    history = [];
    saveHistory(history);
    renderHistory();
  });

  window.addEventListener('resize', fitResultText);

  renderHistory();
  render();
}

if (typeof document !== 'undefined') {
  initUI();
}

// Lets the engine be tested in Node (ignored in the browser)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createState, press, getView };
}