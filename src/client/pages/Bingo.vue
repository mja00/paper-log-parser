<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter, RouterLink } from "vue-router";
import { generateCard, randomSeed } from "../lib/bingo";

const route = useRoute();
const router = useRouter();

const CHIP_COLORS = ["orange", "green", "blue", "pink"] as const;
const SIZE = 5;

function parseSeed(raw: unknown): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number.parseInt(typeof value === "string" ? value : "", 10);
  return Number.isNaN(parsed) ? randomSeed() : parsed;
}

const seed = ref(parseSeed(route.query.seed));
const card = ref<string[]>([]);
const marked = ref<boolean[][]>([]);
const colors = ref<string[][]>([]);
const rowWin = ref<boolean[]>(new Array(SIZE).fill(false));
const colWin = ref<boolean[]>(new Array(SIZE).fill(false));
const diagDown = ref(false);
const diagUp = ref(false);
const saveLabel = ref("Save Current Card");
const saveDisabled = ref(false);

const rows = computed<string[][]>(() => {
  const out: string[][] = [];
  for (let i = 0; i < SIZE; i++) out.push(card.value.slice(i * SIZE, i * SIZE + SIZE));
  return out;
});

function randomColor(): string {
  return CHIP_COLORS[Math.floor(Math.random() * CHIP_COLORS.length)];
}

function emptyGrid<T>(value: T): T[][] {
  return Array.from({ length: SIZE }, () => new Array<T>(SIZE).fill(value));
}

function recomputeWins(): void {
  for (let i = 0; i < SIZE; i++) rowWin.value[i] = marked.value[i].every((v) => v);
  for (let j = 0; j < SIZE; j++) colWin.value[j] = marked.value.every((row) => row[j]);
  diagDown.value = marked.value.every((_row, i) => marked.value[i][i]);
  diagUp.value = marked.value.every((_row, i) => marked.value[i][SIZE - 1 - i]);
}

function persist(): void {
  const store = JSON.parse(localStorage.getItem("bingo") ?? "{}") as Record<string, boolean[][]>;
  store[seed.value] = marked.value;
  localStorage.setItem("bingo", JSON.stringify(store));
}

function updateStateUrl(): void {
  const bits = marked.value
    .flat()
    .map((b) => (b ? "1" : "0"))
    .join("");
  const hex = Number.parseInt(bits, 2).toString(16).padStart(7, "0");
  const url = new URL(window.location.href);
  url.searchParams.set("state", hex);
  history.replaceState(null, "", url);
}

function toggleCell(i: number, j: number): void {
  const next = !marked.value[i][j];
  marked.value[i][j] = next;
  colors.value[i][j] = next ? randomColor() : "";
  recomputeWins();
  persist();
  updateStateUrl();
}

function applyMarks(grid: boolean[][]): void {
  for (let i = 0; i < SIZE; i++) {
    for (let j = 0; j < SIZE; j++) {
      if (grid[i]?.[j]) {
        marked.value[i][j] = true;
        colors.value[i][j] = randomColor();
      }
    }
  }
}

function restoreFromState(hex: string): void {
  const binary = Number.parseInt(hex, 16).toString(2).padStart(SIZE * SIZE, "0");
  const grid = (binary.match(/.{5}/g) ?? []).map((rowStr) => rowStr.split("").map((c) => c === "1"));
  applyMarks(grid);
}

function initBoard(): void {
  card.value = generateCard(seed.value);
  marked.value = emptyGrid(false);
  colors.value = emptyGrid("");

  const stateParam = route.query.state;
  const stateHex = Array.isArray(stateParam) ? stateParam[0] : stateParam;
  if (typeof stateHex === "string" && stateHex.length > 0) {
    restoreFromState(stateHex);
  } else {
    const store = JSON.parse(localStorage.getItem("bingo") ?? "null") as Record<string, boolean[][]> | null;
    const saved = store?.[seed.value];
    if (saved) applyMarks(saved);
  }
  recomputeWins();
}

function newCard(): void {
  router.push({ path: "/bingo", query: { seed: randomSeed() } });
}

function clearStorage(): void {
  if (!confirm("Are you sure you want to clear ALL bingo boards?")) return;
  localStorage.removeItem("bingo");
  marked.value = emptyGrid(false);
  colors.value = emptyGrid("");
  recomputeWins();
  const url = new URL(window.location.href);
  url.searchParams.delete("state");
  history.replaceState(null, "", url);
}

function saveCardNumber(): void {
  localStorage.setItem("cardNumber", String(seed.value));
  saveLabel.value = "Card number saved!";
  saveDisabled.value = true;
  setTimeout(() => {
    saveLabel.value = "Save Current Card";
    saveDisabled.value = false;
  }, 5000);
}

function loadCardNumber(): void {
  const cardNumber = localStorage.getItem("cardNumber");
  if (cardNumber !== null) {
    router.push({ path: "/bingo", query: { seed: cardNumber } });
  }
}

watch(
  () => route.query.seed,
  () => {
    seed.value = parseSeed(route.query.seed);
    initBoard();
  },
);

onMounted(initBoard);
</script>

<template>
  <div class="container-fluid mt-3">
    <div class="row justify-content-center">
      <div class="col-md-3 col-lg-2">
        <div class="card">
          <div class="card-header">
            Info
          </div>
          <div class="card-body">
            <p>This is a offline mode bingo card generator created by mja00!</p>
            <p>
              All squares claimed are automatically saved to local storage. You can use the buttons below to do actions.
            </p>
            <hr>
            <div class="d-grid gap-2">
              <button
                class="btn btn-danger"
                @click="newCard"
              >
                New Card
              </button>
              <button
                class="btn btn-danger"
                title="Wipes all squares from all cards!"
                @click="clearStorage"
              >
                Clear All Cards
              </button>
              <button
                id="saveButton"
                class="btn btn-success"
                :disabled="saveDisabled"
                title="Saves the current card number!"
                @click="saveCardNumber"
              >
                {{ saveLabel }}
              </button>
              <button
                class="btn btn-success"
                title="Loads your saved card number!"
                @click="loadCardNumber"
              >
                Load Saved Card
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="col-md-7 col-lg-5">
        <div class="card">
          <div class="card-header">
            Bingo Card #<RouterLink :to="{ path: '/bingo', query: { seed: String(seed) } }">
              {{ seed }}
            </RouterLink>
          </div>
          <div class="card-body">
            <div class="flex-grid">
              <div class="flex-header">
                <div
                  class="flex-cell"
                  :class="{ win: diagDown }"
                >
                  P
                </div>
                <div class="flex-cell">
                  A
                </div>
                <div class="flex-cell">
                  P
                </div>
                <div class="flex-cell">
                  E
                </div>
                <div
                  class="flex-cell"
                  :class="{ win: diagUp }"
                >
                  R
                </div>
              </div>
              <div
                v-for="(row, i) in rows"
                :key="i"
                class="flex-row"
                :class="{ win: rowWin[i] }"
              >
                <div
                  v-for="(square, j) in row"
                  :key="j"
                  class="flex-cell"
                  :class="[
                    { chip: marked[i][j], win: i === 0 && colWin[j] },
                    marked[i][j] ? colors[i][j] : '',
                  ]"
                  @click="toggleCell(i, j)"
                >
                  <span
                    v-if="square === 'Free'"
                    class="free-space"
                  >
                    <img
                      src="https://cdn.discordapp.com/emojis/1018366673423695872.webp?size=128&quality=lossless"
                      alt="Paperchan"
                      width="100"
                      height="100"
                    >
                  </span>
                  <template v-else>
                    {{ square }}
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.flex-grid {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 560px;
  padding: 15px;
  background: #d54f34;
  border-radius: 20px;
  border: 1px solid;
  font-size: 12px;
  font-weight: 700;
  font-family: "Roboto", sans-serif;
  margin: 0 auto;
}
.flex-row,
.flex-header {
  position: relative;
  flex-direction: row;
  display: flex;
}
.flex-header .flex-cell {
  height: 50px;
  font-family: "Roboto Slab", serif;
  font-weight: 700;
  font-size: 3.5em;
  background: #d54f34;
  color: white;
  text-shadow:
    -1px -1px 0 #898989,
    1px -1px 0 #898989,
    -1px 1px 0 #898989,
    1px 1px 0 #898989;
}
.flex-cell {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
  width: 105px;
  height: 105px;
  padding: 5px;
  border: 2px solid #d54f34;
  background: white;
  cursor: pointer;
  user-select: none;
  color: black;
}
.flex-grid .free-space {
  font-size: 4em;
  color: #d54f34;
  margin-bottom: 10px;
}
.flex-cell.chip:after {
  content: "";
  position: absolute;
  width: 70px;
  height: 70px;
  border-radius: 50%;
  cursor: pointer;
}
.flex-cell.chip.orange:after {
  background:
    radial-gradient(ellipse at 53% 53%, #fff0 35px, hsla(0, 0%, 100%, 0.75) 37px, #fff0 40px),
    radial-gradient(ellipse at 47% 49%, #fff0 35px, hsla(27, 100%, 38%, 0.75) 37px, #fff0 40px),
    radial-gradient(ellipse at 40% 40%, hsla(33, 100%, 64%, 0.8) 0%, hsla(27, 93%, 47%, 0.8) 100%);
}
.flex-cell.chip.green:after {
  background:
    radial-gradient(ellipse at 53% 53%, #fff0 35px, hsla(0, 0%, 100%, 0.75) 37px, #fff0 40px),
    radial-gradient(ellipse at 47% 49%, #fff0 35px, hsla(123, 100%, 30%, 0.75) 37px, #fff0 40px),
    radial-gradient(ellipse at 40% 40%, hsla(123, 100%, 64%, 0.8) 0%, hsla(112, 93%, 47%, 0.8) 100%);
}
.flex-cell.chip.blue:after {
  background:
    radial-gradient(ellipse at 53% 53%, #fff0 35px, hsla(0, 0%, 100%, 0.75) 37px, #fff0 40px),
    radial-gradient(ellipse at 47% 49%, #fff0 35px, hsla(214, 100%, 38%, 0.75) 37px, #fff0 40px),
    radial-gradient(ellipse at 40% 40%, hsla(229, 100%, 64%, 0.8) 0%, hsla(214, 93%, 47%, 0.8) 100%);
}
.flex-cell.chip.pink:after {
  background:
    radial-gradient(ellipse at 53% 53%, #fff0 35px, hsla(0, 0%, 100%, 0.75) 37px, #fff0 40px),
    radial-gradient(ellipse at 47% 49%, #fff0 35px, hsla(303, 100%, 38%, 0.75) 37px, #fff0 40px),
    radial-gradient(ellipse at 40% 40%, hsla(309, 100%, 64%, 0.8) 0%, hsla(303, 93%, 47%, 0.8) 100%);
}
.flex-row:after {
  content: "";
  position: absolute;
  top: 49px;
  left: 10px;
  width: 0%;
  height: 10px;
  background: #00571fc4;
  border-radius: 15px;
  transition: width 0.5s ease;
  pointer-events: none;
}
.flex-row.win:after {
  width: 94%;
}
.flex-row .flex-cell:before {
  content: "";
  position: absolute;
  top: 10px;
  width: 10px;
  height: 0;
  background: #00571fc4;
  border-radius: 15px;
  transition: height 0.5s ease;
  z-index: 1;
  pointer-events: none;
}
.flex-row .flex-cell.win:before {
  height: 500%;
}
.flex-header .flex-cell:first-child:before,
.flex-header .flex-cell:last-child:before {
  content: "";
  position: absolute;
  top: 60px;
  width: 10px;
  height: 0;
  background: #00571fc4;
  border-radius: 15px;
  transition: height 0.5s ease;
  z-index: 4;
  transform: rotate(-45deg);
  transform-origin: top;
  pointer-events: none;
}
.flex-header .flex-cell:first-child:before {
  left: 5px;
  transform: rotate(-45deg);
}
.flex-header .flex-cell:last-child:before {
  right: 5px;
  transform: rotate(45deg);
}
.flex-header .flex-cell.win:before {
  height: 1540%;
}
</style>
