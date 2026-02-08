const CSV_URL = "https://docs.google.com/spreadsheets/d/1o9IzlEOipQm4TAnqqMe1MfxDvE6LFJYUEkYt2TeJ5Oc/export?format=csv";
const LOCAL_CSV = "words.csv"; // اگر خواستی آفلاین هم داشته باشی، این فایل رو هم کنار بقیه بذار

let allWords = [];
let mainQueue = [];
let reviewQueue = []; // اشتباه‌ها
let pageWords = [];

let selectedLeft = null;
let selectedRight = null;

let totalAttempts = 0;
let correct = 0;
let wrong = 0;

const germanListEl = document.getElementById("germanList");
const persianListEl = document.getElementById("persianList");
const progressEl = document.getElementById("progress");
const scoreEl = document.getElementById("score");
const nextBtn = document.getElementById("nextBtn");

function shuffle(arr) {
  // Fisher-Yates
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function parseCSV(text) {
  // ساده و کافی برای CSV گوگل (دو ستون)
  const lines = text.replace(/\r/g, "").split("\n").filter(l => l.trim().length > 0);
  const rows = [];

  for (const line of lines) {
    // اگر تو فارسی یا آلمانی ویرگول داشتی ممکنه مشکل بده.
    // فعلاً ساده: دو ستون با اولین ویرگول
    const idx = line.indexOf(",");
    if (idx === -1) continue;

    const de = line.slice(0, idx).trim().replace(/^"|"$/g, "");
    const fa = line.slice(idx + 1).trim().replace(/^"|"$/g, "");

    // رد کردن هدر احتمالی
    if (de.toLowerCase() === "deutsch" || fa.toLowerCase() === "persisch") continue;
    if (!de || !fa) continue;

    rows.push({ de, fa, mistake: 0 });
  }
  return rows;
}

async function fetchCSV(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error("CSV fetch failed");
  return await r.text();
}

async function loadWords() {
  try {
    const text = await fetchCSV(CSV_URL);
    allWords = parseCSV(text);
  } catch (e) {
    // پشتیبان آفلاین
    const text = await fetchCSV(LOCAL_CSV);
    allWords = parseCSV(text);
  }

  startGame();
}

function startGame() {
  // شروع: صف اصلی رندم
  mainQueue = shuffle([...allWords]);
  reviewQueue = [];
  totalAttempts = 0;
  correct = 0;
  wrong = 0;

  updateHeader();
  nextPage();
}

function updateHeader() {
  scoreEl.textContent = `درست: ${correct} | غلط: ${wrong}`;
}

function takeNextTen() {
  const result = [];

  // اولویت: مرور اشتباه‌ها
  while (result.length < 10 && reviewQueue.length > 0) {
    result.push(reviewQueue.shift());
  }
  // بعد از صف اصلی
  while (result.length < 10 && mainQueue.length > 0) {
    result.push(mainQueue.shift());
  }

  return result;
}

function nextPage() {
  selectedLeft = null;
  selectedRight = null;
  nextBtn.disabled = true;

  pageWords = takeNextTen();

  if (pageWords.length === 0) {
    endGame();
    return;
  }

  renderPage();
}

function clearLists() {
  germanListEl.innerHTML = "";
  persianListEl.innerHTML = "";
}

function createItem(text, onClick) {
  const div = document.createElement("div");
  div.className = "item";
  div.textContent = text;
  div.onclick = () => onClick(div);
  return div;
}

let solvedPairs = 0;

function renderPage() {
  clearLists();
  solvedPairs = 0;

  const left = pageWords; // deutsch
  const right = shuffle([...pageWords]); // persisch قاطی

  // برای هر آیتم عنصر DOM نگه می‌داریم
  const leftMap = new Map();
  const rightMap = new Map();

  left.forEach(w => {
    const el = createItem(w.de, (div) => selectLeft(w, div, leftMap));
    leftMap.set(w, el);
    germanListEl.appendChild(el);
  });

  right.forEach(w => {
    const el = createItem(w.fa, (div) => selectRight(w, div, rightMap));
    rightMap.set(w, el);
    persianListEl.appendChild(el);
  });

  progressEl.textContent = `کلمات این صفحه: ${pageWords.length}`;
  updateHeader();
}

function resetSelectedVisual(el) {
  if (!el) return;
  el.classList.remove("selected");
}

function selectLeft(word, el, map) {
  // اگر قبلاً درست شده، نادیده بگیر
  if (el.classList.contains("correct")) return;

  if (selectedLeft?.el && selectedLeft.el !== el) resetSelectedVisual(selectedLeft.el);

  selectedLeft = { word, el };
  el.classList.add("selected");
  tryMatch();
}

function selectRight(word, el, map) {
  if (el.classList.contains("correct")) return;

  if (selectedRight?.el && selectedRight.el !== el) resetSelectedVisual(selectedRight.el);

  selectedRight = { word, el };
  el.classList.add("selected");
  tryMatch();
}

function tryMatch() {
  if (!selectedLeft || !selectedRight) return;

  totalAttempts++;

  const leftEl = selectedLeft.el;
  const rightEl = selectedRight.el;

  // پاک کردن حالت selected بعد از تصمیم
  leftEl.classList.remove("selected");
  rightEl.classList.remove("selected");

  if (selectedLeft.word === selectedRight.word) {
    leftEl.classList.add("correct");
    rightEl.classList.add("correct");
    correct++;
    solvedPairs++;

    // اگر این کلمه قبلاً تو مرور بوده، mistake کم می‌شه
    selectedLeft.word.mistake = Math.max(0, selectedLeft.word.mistake - 1);
  } else {
    leftEl.classList.add("wrong");
    rightEl.classList.add("wrong");
    wrong++;

    // بعد از 600ms رنگ غلط برگرده (برای اینکه دوباره انتخاب بشه)
    setTimeout(() => {
      leftEl.classList.remove("wrong");
      rightEl.classList.remove("wrong");
    }, 600);

    // این کلمه باید دوباره بیاد
    selectedLeft.word.mistake++;
    // چند بار تکرار بر اساس میزان اشتباه
    reviewQueue.push(selectedLeft.word);
  }

  selectedLeft = null;
  selectedRight = null;

  updateHeader();

  if (solvedPairs === pageWords.length) {
    nextBtn.disabled = false;
  }
}

function endGame() {
  const score = totalAttempts === 0 ? 0 : Math.round((correct / totalAttempts) * 100);
  alert(
    `پایان بازی 🎉\n\n` +
    `امتیاز: ${score} / 100\n` +
    `کل تلاش‌ها: ${totalAttempts}\n` +
    `درست: ${correct}\n` +
    `غلط: ${wrong}\n` +
    `تعداد لغت‌ها: ${allWords.length}`
  );
}

nextBtn.addEventListener("click", nextPage);

loadWords();
