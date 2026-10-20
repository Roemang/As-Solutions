# AS Solutions website

Website die ik gemaakt heb voor AS Solutions, het bedrijf van een vriend van me. Hij doet timmerwerk, renovaties en tegelwerk.
De site is nog niet live, dat komt later. Ik host hem dan zelf op mijn pc via een Cloudflare tunnel.

![logo](assets/img/logo-groot.png)

Ik heb bewust geen framework gebruikt, gewoon HTML, CSS en JavaScript. Voor de server gebruik ik Node.js zonder extra packages, dus `npm install` is niet nodig.

## Wat zit erin

- Homepage met een video in de header, diensten, reviews, FAQ en een galerij met projectfoto's
- Voor/na slider (trap en winkelpui)
- Lightbox voor de foto's, werkt ook met pijltjestoetsen en swipen op je telefoon
- Offertepagina en contactpagina met formulier
- Een beheerpagina (`/beheer`) waar mijn vriend zelf foto's kan toevoegen, verwijderen, vervangen en in een andere volgorde kan zetten. Hij hoeft dus niet aan de code te zitten.
- Werkt op mobiel, tablet en desktop

Het logo had hij alleen als vage PNG, dus die heb ik opnieuw als SVG gemaakt. De foto's heb ik omgezet naar WebP en de video's gecomprimeerd, anders was de map bijna 200 MB.

## Starten

Je hebt Node.js nodig (18 of hoger).

```
node server.js
```

Of dubbelklik op `start-server.bat`. Daarna draait de site op http://localhost:8080 en de beheerpagina op http://localhost:8080/beheer.

Let op: met Live Server in VS Code werkt de site wel, maar het beheergedeelte niet, want dat heeft de server nodig.

## Beheerpagina

De eerste keer dat je de server start wordt er een wachtwoord aangemaakt. Dat staat in de terminal en in `admin.config.json`. Daar kan je het ook veranderen (server daarna even herstarten). Dat bestand staat in de `.gitignore`.

Foto's die je uploadt worden in de browser al kleiner gemaakt voordat ze naar de server gaan. Als je iets verwijdert gaat het naar de map `prullenbak/`, dus je kan het altijd nog terughalen.

Na 5 keer een fout wachtwoord wordt inloggen 10 minuten geblokkeerd.

## Gegevens aanpassen

Telefoonnummer, mail, werkgebied en de reviews staan in `assets/js/config.js`. Opslaan en de pagina verversen, dan zie je het meteen.

Nog te doen:
- werkgebied invullen
- echte reviews erin zetten (nu staan er nog voorbeelden)
- links naar Instagram en Facebook (zoek op `TODO` in de html bestanden)
- een beter wachtwoord voor de beheerpagina

Het formulier opent nu nog de mail app van de bezoeker. Als je wil dat aanvragen automatisch binnenkomen kan je bij `formEndpoint` in de config bijvoorbeeld een Formspree of Web3Forms link zetten.

## Online zetten

Ik gebruik cloudflared. Installeren:

```
winget install --id Cloudflare.cloudflared
```

Even snel testen (geeft een tijdelijke link):

```
cloudflared tunnel --url http://localhost:8080
```

Met een eigen domein (moet in Cloudflare staan):

```
cloudflared tunnel login
cloudflared tunnel create as-solutions
cloudflared tunnel route dns as-solutions www.jouwdomein.nl
cloudflared tunnel run --url http://localhost:8080 as-solutions
```

De site is natuurlijk alleen online als mijn pc aan staat.

## Mappen

```
index.html, offerte.html, contact.html
admin.html          beheerpagina
server.js           server + api voor het beheer
data/               projecten.json met de lijst van foto's in de galerij
assets/css          styling
assets/js           config.js, main.js en admin.js
assets/img          logo's en projectfoto's
assets/video        video's
```

## Credits

Gemaakt door Ronan voor AS Solutions.
Fonts: Poppins en Lato van Google Fonts.
Alle foto's en video's zijn van AS Solutions.
