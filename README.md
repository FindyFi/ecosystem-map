# Digitaalisten todisteiden ekosysteemikartta

Interaktiivinen visualisointi digitaalisten todisteiden ja lompakoiden ekosysteemistä: roolit, käyttötapaukset, rahavirrat ja luottamusinfra. Visualisointi kattaa yleiset roolit, eIDAS-asetuksen ja EUDI-lompakon lisäämät roolit, eurooppalaisten yrityslompakoiden asetusehdotuksen lisäämät roolit sekä Findynetin verkoston. Sen tarkoitus on auttaa organisaatioita löytämään oma paikkansa ekosysteemissä.

Sivusto on suomeksi ja englanniksi. Koko sivu on yksi itsenäinen HTML-tiedosto, joka ei tee ulkoisia kutsuja eikä käytä evästeitä tai analytiikkaa.

## Rakenne

```text
data/
  meta.yaml            päivityspäivä, linkit, kielet ja käyttötapausten järjestys
  layers.yaml          kerrokset (perus, eudi, ebw, findy)
  roles.yaml           roolit
  edges.yaml           roolien väliset yhteydet
  usecases/<id>.yaml   käyttötapaukset: kuvaus, roolit, rahavirrat ja luottamusketju
  flows/<id>.yaml      yleiset rahavirtamallit (EUDI-ekosysteemi, yrityslompakko)
  trust.yaml           luottamusinfran mekanismit ja itsearviointi
  wizard.yaml          ”Löydä paikkasi” -polun tekstit
  monetisation.yaml    ansaintamallit A–E
  personas.yaml        ”Olen…”-valinnan näkökulmat
  sources.yaml         lähdeluettelo
i18n/fi.yaml, en.yaml  käyttöliittymän tekstit
glossary.yaml          sanasto molemmille kielille (ei käytetä buildissa)
src/                   sivupohja, tyylit ja sovelluslogiikka
assets/                fontti ja logo
scripts/build.js       tarkistus ja build → dist/index.html
```

## Käyttö

Vaatii Node.js 20:n tai uudemman.

```sh
npm install
npm run validate   # tarkistaa datan
npm run build      # tarkistaa ja rakentaa dist/index.html
npm run dev        # rakentaa ja käynnistää paikallisen palvelimen osoitteeseen http://localhost:8080
```

`dist/index.html` toimii myös suoraan selaimessa avattuna.

## Sisällön muokkaaminen

Kaikki sisältö on `data/`- ja `i18n/`-kansioiden YAML-tiedostoissa. Kooditiedostoihin ei tarvitse koskea.

**Kielet.** Jokainen näkyvä teksti on muodossa

```yaml
name:
  fi: Myöntäjä
  en: Issuer
```

Build pysähtyy, jos käännös puuttuu. Käytä termejä `glossary.yaml`-tiedoston mukaisesti. Suomalaisille toimijoille kirjoitetaan englanninkieliseen tekstiin ensimmäisellä mainintakerralla selite (esim. ”Kela, the Social Insurance Institution of Finland”).

**Tila-merkinnät.** Jokaisella roolilla, käyttötapauksella ja rahavirralla on tila (`status`), joka näkyy sivulla:

| Tila | Merkitys |
| --- | --- |
| `voimassa` | voimassa oleva sääntely |
| `ehdotus` | lainsäädäntöprosessissa oleva ehdotus |
| `arf` | ARF:n informatiivinen kuvaus |
| `kaytanto` | toimijoiden käytäntö tai pilotti |
| `lahde` | lähteessä esitetty arvio tai luku |
| `havainnollistava` | mahdollinen malli, ei todennettu |

Kun yrityslompakkoasetus tai täytäntöönpanosäädökset muuttuvat, käy läpi `ehdotus`-merkityt kohdat (`grep -rn "status: ehdotus" data/`).

**Päivityspäivä.** Päivitä `data/meta.yaml`-tiedoston `updated` aina, kun sisältö muuttuu.

### Uuden käyttötapauksen lisääminen

1. Kopioi `data/usecases/kela.yaml` uudeksi tiedostoksi, esimerkiksi `data/usecases/osaaminen.yaml`, ja vaihda `id`.
2. Täytä kuvaus, kulku (`steps`), roolit (`detail.cast` ja `cast_order`, roolien tunnisteet `roles.yaml`-tiedostosta), arvo, luottamusketju ja rahavirrat.
3. Rahavirtakaavion solmujen koordinaatit ovat alueella 0–900 × 0–540. Virran `bend` kaartaa viivaa, ja virta, jonka `from` ja `to` ovat sama solmu, näytetään solmun viereisenä merkintänä (`pill`).
4. Lisää tunniste `data/meta.yaml`-tiedoston `usecase_order`-listaan.
5. Aja `npm run build` ja tarkista tulos selaimessa.

Ennen julkaisua varmista, että käyttötapauksessa mainitut organisaatiot ovat hyväksyneet kuvauksen.

## Julkaisu

GitHub Actions (`.github/workflows/deploy.yml`) tarkistaa datan jokaisessa pull requestissa ja julkaisee `main`-haaran GitHub Pagesiin. Ota Pages käyttöön repositorion asetuksista: *Settings → Pages → Source: GitHub Actions*.

Oman osoitteen (esim. `ekosysteemi.findy.fi`) saa käyttöön lisäämällä sen *Settings → Pages → Custom domain* -kenttään ja DNS-palveluun CNAME-tietueen, joka osoittaa `<organisaatio>.github.io`-osoitteeseen.

**Syvälinkit.** Näkymän tila on osoitteen #-osassa, esimerkiksi
`#lang=en&v=rahavirrat&malli=kela` tai `#lang=fi&v=kartta&korosta=hankinta`.
Kieli valitaan osoitteesta tai, jos sitä ei ole annettu, selaimen kieliasetuksesta.

**Upottaminen.** Sivun voi upottaa iframella, mutta suositeltavampaa on linkittää omaan osoitteeseen, koska näkymä tarvitsee leveyttä.

```html
<iframe src="https://ekosysteemi.findy.fi/#lang=fi" style="width:100%;height:1100px;border:0" title="Digitaalisten todisteiden ekosysteemi"></iframe>
```

## Avoimet asiat

- Englanninkielinen yhteydenottolinkki osoittaa toistaiseksi suomenkieliselle yhteydenottosivulle (`data/meta.yaml`).
- Sanaston suomenkieliset viralliset termit kannattaa tarkistaa asetusten suomenkielisistä versioista.

## Lisenssit

Koodi: Apache 2.0 (`LICENSE`). Sisältö: CC BY-SA 4.0 (`LICENSE-CONTENT.md`). Fontti Archivo: SIL Open Font License 1.1. Findynet-logo on Findynet Osuuskunnan tavaramerkki.
