/* ==========================================================================
   AS Solutions – instellingen
   Pas hier de contactgegevens en reviews aan. Ze worden automatisch op
   alle pagina's ingevuld (telefoon, e-mail, WhatsApp-knop, regio).
   ========================================================================== */

window.SITE_CONFIG = {
  // Pas hier aan. Daarna opslaan en de pagina verversen (Ctrl + F5).
  telefoon: "06 55 82 90 48",          // wordt ook gebruikt voor de bel- en WhatsApp-knop
  email: "ronanbiggie@live.nl",
  regio: "de regio en omgeving",       // TODO: bv. "heel Flevoland en tot 80 km daarbuiten"

  // Optioneel: een formulierdienst (bv. Formspree of Web3Forms) zodat de
  // offerte direct in je mailbox komt. Laat leeg om via de mail-app te versturen.
  formEndpoint: "",

  // Reviews: vervang de voorbeelden door echte reviews van klanten.
  // Zet "voorbeeld: true" weg (of op false) zodra het een echte review is.
  reviews: [
    { tekst: "Hier komt een echte review van een klant. Vraag tevreden klanten om een paar zinnen over hun ervaring.", naam: "Naam klant", plaats: "Woonplaats", voorbeeld: true },
    { tekst: "Hier komt een echte review van een klant. Vraag tevreden klanten om een paar zinnen over hun ervaring.", naam: "Naam klant", plaats: "Woonplaats", voorbeeld: true },
    { tekst: "Hier komt een echte review van een klant. Vraag tevreden klanten om een paar zinnen over hun ervaring.", naam: "Naam klant", plaats: "Woonplaats", voorbeeld: true }
  ]
};
