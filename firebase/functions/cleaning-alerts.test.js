const assert = require("node:assert/strict");
const { findPotentialCleaningConflicts } = require("./cleaning-alerts");

function calendar(apartment, bookings) {
  return { apartment, bookings };
}

const potentialConflict = findPotentialCleaningConflicts([
  calendar("123", [
    { start: "2026-07-01", end: "2026-07-03" },
    { start: "2026-07-03", end: "2026-07-06" },
  ]),
  calendar("1248", [
    { start: "2026-06-30", end: "2026-07-03" },
  ]),
], "2026-07-01", 30);

assert.deepEqual(potentialConflict, [{
  key: "2026-07-03",
  date: "2026-07-03",
  turnoverApartment: "123",
  atRiskApartment: "1248",
  message: "Alerta de 2 limpezas em simultâneo",
}]);

const emptyPreviousNight = findPotentialCleaningConflicts([
  calendar("123", [
    { start: "2026-07-01", end: "2026-07-03" },
    { start: "2026-07-03", end: "2026-07-06" },
  ]),
  calendar("1248", [
    { start: "2026-06-29", end: "2026-07-02" },
    { start: "2026-07-03", end: "2026-07-05" },
  ]),
], "2026-07-01", 30);

assert.deepEqual(emptyPreviousNight, []);

const alreadyConfirmed = findPotentialCleaningConflicts([
  calendar("123", [
    { start: "2026-07-01", end: "2026-07-03" },
    { start: "2026-07-03", end: "2026-07-06" },
  ]),
  calendar("1248", [
    { start: "2026-07-01", end: "2026-07-03" },
    { start: "2026-07-03", end: "2026-07-06" },
  ]),
], "2026-07-01", 30);

assert.deepEqual(alreadyConfirmed, []);

const duplicateSources = findPotentialCleaningConflicts([
  calendar("123", [
    { start: "2026-07-01", end: "2026-07-03" },
    { start: "2026-07-03", end: "2026-07-06" },
    { start: "2026-07-03", end: "2026-07-06" },
  ]),
  calendar("1248", [
    { start: "2026-07-01", end: "2026-07-03" },
  ]),
], "2026-07-01", 30);

assert.equal(duplicateSources.length, 1);

console.log("cleaning-alerts tests passed");
