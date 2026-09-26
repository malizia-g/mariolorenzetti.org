const now = new Date();

export default {
  year: now.getFullYear(),
  // Data di oggi (fuso Europe/Rome) per separare eventi futuri e passati.
  today: now.toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" }),
};
